#!/usr/bin/env node
/** Connect a supplier's SketchUp GLB export to the existing, dimension-fitted model renderer. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { getBounds } from '@gltf-transform/functions';
import draco3d from 'draco3dgltf';
import { optimizeGlb } from './optimize-models.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Exported for integration tests against a disposable repository, never a live catalog. */
export async function importSketchupModel({
  repoRoot = ROOT, input, productId, source, licence,
  front = '+z', lengthAxis = 'auto', replace = false, dryRun = false,
}, optimize = optimizeGlb) {
  if (!input || path.extname(input).toLowerCase() !== '.glb') throw new Error('Export the SketchUp product as GLTF Binary (.glb) first. Direct .skp files are not supported.');
  if (!/^[a-z0-9][a-z0-9-]*$/.test(productId ?? '')) throw new Error('Use an existing catalog product ID (letters, numbers and hyphens).');
  if (!source?.trim() || !licence?.trim()) throw new Error('Record --source and --licence for the supplier-approved model.');
  if (!['+z', '-z', '+x', '-x'].includes(front) || !['x', 'z', 'auto'].includes(lengthAxis)) throw new Error('Invalid --front or --length-axis.');
  const rows = [];
  for (const relative of ['src/data/products.json', 'src/demo/courts/products.json']) {
    const catalog = JSON.parse(await fs.readFile(path.join(repoRoot, relative), 'utf8'));
    rows.push(...catalog.products);
  }
  const product = rows.find(row => row.id === productId);
  if (!product) throw new Error(`Unknown catalog product: ${productId}. Add the real product and its measured dimensions before importing its model.`);
  if (product.mesh_url) throw new Error('This product already has a mesh_url override. Update that catalog source instead of adding a shadowed manifest entry.');
  const dimensions = product.dimensions_cm;
  if (!dimensions || !['length', 'width', 'height'].every(axis => Number.isFinite(dimensions[axis]) && dimensions[axis] > 0)) throw new Error('Product dimensions must be positive measured centimetres.');
  const manifestPath = path.join(repoRoot, 'src/data/productModels.json');
  const originalManifest = await fs.readFile(manifestPath, 'utf8');
  const manifest = JSON.parse(originalManifest);
  if (manifest[productId] && !replace) throw new Error('A model already exists. Review it and use --replace to change the mapping; the old asset is preserved.');
  const stat = await fs.stat(input);
  if (stat.size > 80 * 1024 * 1024) throw new Error('GLB exceeds 80 MiB; simplify the SketchUp component before import.');
  const bytes = await fs.readFile(input);
  if (bytes.length < 20 || bytes.readUInt32LE(0) !== 0x46546c67 || bytes.readUInt32LE(4) !== 2 || bytes.readUInt32LE(8) !== bytes.length || bytes.readUInt32LE(16) !== 0x4e4f534a) throw new Error('Not a valid binary glTF 2.0 file.');
  const jsonLength = bytes.readUInt32LE(12);
  if (20 + jsonLength > bytes.length) throw new Error('Truncated GLB JSON chunk.');
  const gltf = JSON.parse(bytes.subarray(20, 20 + jsonLength).toString('utf8'));
  for (const resource of [...(gltf.buffers ?? []), ...(gltf.images ?? [])]) {
    if (resource.uri && !resource.uri.startsWith('data:')) throw new Error('Use a self-contained GLB with embedded textures; external resources are not imported.');
  }
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'draco3d.decoder': await draco3d.createDecoderModule() });
  const document = await io.readBinary(bytes);
  const scene = document.getRoot().getDefaultScene() ?? document.getRoot().listScenes()[0];
  if (!scene) throw new Error('The GLB contains no scene.');
  if (document.getRoot().listSkins().length || document.getRoot().listAnimations().length) throw new Error('Export a static product component, without animation or rigging.');
  const bounds = getBounds(scene);
  if (!bounds.min.every((min, i) => Number.isFinite(min) && Number.isFinite(bounds.max[i]) && bounds.max[i] - min > 0.000001)) throw new Error('The product must contain visible geometry with width, depth and height.');
  const hash = createHash('sha256').update(bytes).digest('hex').slice(0, 12);
  const filename = `${productId}-sketchup-${hash}.glb`;
  const report = { productId, dimensions_cm: dimensions, modelBounds: bounds, source: source.trim(), licence: licence.trim() };
  if (dryRun) return { ...report, dryRun: true };
  const rawDirectory = path.join(repoRoot, 'models-raw');
  await fs.mkdir(rawDirectory, { recursive: true });
  const rawPath = path.join(rawDirectory, filename);
  await fs.writeFile(rawPath, bytes);
  // A failed optimizer must never touch a served asset. Both candidates stay
  // in ignored storage until geometry/size and the current manifest are checked.
  const stagingDirectory = await fs.mkdtemp(path.join(rawDirectory, '.sketchup-import-'));
  const candidatePath = path.join(stagingDirectory, 'candidate.glb');
  const stagedManifestPath = path.join(stagingDirectory, 'manifest.json');
  const lockPath = `${manifestPath}.import.lock`;
  let lock;
  let createdAssetPath;
  let committed = false;
  const removeFile = async file => { await fs.unlink(file).catch(error => { if (error.code !== 'ENOENT') throw error; }); };
  try {
    const stats = await optimize(rawPath, candidatePath);
    const candidateStat = await fs.stat(candidatePath);
    if (candidateStat.size > 12 * 1024 * 1024) throw new Error('Optimized GLB exceeds 12 MiB. Simplify further; catalog mapping was not changed.');
    const optimizedBytes = await fs.readFile(candidatePath);
    await io.readBinary(optimizedBytes);
    // Use the optimized bytes, not only the source hash: re-optimizing the same
    // source never overwrites a previously served version with different bytes.
    const outputHash = createHash('sha256').update(optimizedBytes).digest('hex').slice(0, 20);
    const outputFilename = `${productId}-sketchup-${outputHash}.glb`;
    const assetPath = path.join(repoRoot, 'public/models', outputFilename);
    const url = `/models/${outputFilename}`;
    try { lock = await fs.open(lockPath, 'wx'); }
    catch (error) { if (error.code === 'EEXIST') throw new Error('Another model import is publishing. Retry after it completes.'); throw error; }
    // Detect another importer changing this map while optimization was running.
    if (await fs.readFile(manifestPath, 'utf8') !== originalManifest) throw new Error('Model manifest changed during import. Retry after reviewing the other change; catalog mapping was not overwritten.');
    manifest[productId] = {
      url, modelFront: front, modelUp: '+y', lengthAxis, licence: report.licence, preferMesh: true,
      source: { model: 'SketchUp GLB export', reference: report.source, imported_at: new Date().toISOString(), bytes: candidateStat.size, raw_bytes: stats.inBytes, triangles: stats.triangles, sku: product.sku },
    };
    await fs.writeFile(stagedManifestPath, JSON.stringify(manifest, null, 2) + '\n');
    await fs.mkdir(path.dirname(assetPath), { recursive: true });
    try {
      // An exclusive hard link publishes a complete file atomically on the same
      // repository volume. Existing assets are reused only if their bytes match.
      await fs.link(candidatePath, assetPath);
      createdAssetPath = assetPath;
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
      if (!(await fs.readFile(assetPath)).equals(optimizedBytes)) throw new Error('An existing asset differs from its content hash. No asset or mapping was overwritten.');
    }
    await fs.rename(stagedManifestPath, manifestPath);
    committed = true;
    return { ...report, url, ...stats, outBytes: candidateStat.size, dryRun: false };
  } finally {
    if (!committed && createdAssetPath) await removeFile(createdAssetPath);
    if (lock) { await lock.close(); await removeFile(lockPath); }
    await removeFile(candidatePath);
    await removeFile(stagedManifestPath);
    // No recursive removal: only this import's two known temporary files.
    await fs.rmdir(stagingDirectory);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const option = name => { const i = args.indexOf(name); return i < 0 ? undefined : args[i + 1]; };
  if (args.includes('--help')) {
    console.log('npm run models:import-sketchup -- --in "C:/Models/product.glb" --product catalog-id --source "Supplier / original model reference" --licence "Supplier permission" [--front +z|-z|+x|-x] [--length-axis x|z|auto] [--dry-run] [--replace]');
  } else {
    try {
      console.log(JSON.stringify(await importSketchupModel({ input: option('--in'), productId: option('--product'), source: option('--source'), licence: option('--licence'), front: option('--front'), lengthAxis: option('--length-axis'), replace: args.includes('--replace'), dryRun: args.includes('--dry-run') }), null, 2));
    } catch (error) { console.error(error.message); process.exitCode = 1; }
  }
}
