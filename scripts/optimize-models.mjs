#!/usr/bin/env node
/**
 * optimize-models — a generated body (4 MB, 40 k triangles, 2048² PNG
 * textures straight out of Hunyuan3D) → a phone-sized GLB (2026-09-17).
 *
 *   node scripts/optimize-models.mjs --in models-raw/x.glb --out public/models/x.glb
 *   node scripts/optimize-models.mjs --all          # every raw body → served body
 *
 * Steps: sniff the real image format (the generator labels a JPEG as
 * image/png, which breaks every resizer that trusts the label) → base colour
 * to 1024² WebP, metal/rough to 512² WebP → weld + simplify to `--ratio` of
 * the triangles (error-bounded, the silhouette stays) → Draco. The stage
 * already loads Draco (public/draco). Raw bodies stay in `models-raw/` (ignored
 * by git, outside public/) so a re-run never costs another generation.
 */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, draco, prune, simplify, textureCompress, weld } from '@gltf-transform/functions';
import { MeshoptSimplifier } from 'meshoptimizer';
import draco3d from 'draco3dgltf';
import sharp from 'sharp';

const ROOT = path.resolve(new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const RAW_DIR = path.join(ROOT, 'models-raw');
const OUT_DIR = path.join(ROOT, 'public', 'models');

function sniffMime(bytes) {
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return 'image/png';
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 && bytes[8] === 0x57 && bytes[9] === 0x45) return 'image/webp';
  return null;
}

let io;
async function getIO() {
  if (!io) {
    io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
      'draco3d.decoder': await draco3d.createDecoderModule(),
      'draco3d.encoder': await draco3d.createEncoderModule(),
    });
  }
  return io;
}

/** @returns {Promise<{inBytes:number,outBytes:number,triangles:number}>} */
export async function optimizeGlb(inPath, outPath, opts = {}) {
  const base = opts.base ?? 1024;
  const mr = opts.mr ?? 512;
  const io = await getIO();
  const doc = await io.read(inPath);
  // Triangle budget per body (a phone draws twenty of these at once): the
  // simplify ratio is derived from the raw count so every body lands at
  // about `target`, whatever the generator produced.
  const target = opts.target ?? 20000;
  let rawTriangles = 0;
  for (const mesh of doc.getRoot().listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      const idx = prim.getIndices();
      rawTriangles += idx ? idx.getCount() / 3 : prim.getAttribute('POSITION').getCount() / 3;
    }
  }
  const ratio = opts.ratio ?? Math.min(1, target / Math.max(1, rawTriangles));
  // 1. Trust the bytes, not the label.
  for (const tex of doc.getRoot().listTextures()) {
    const real = sniffMime(tex.getImage() ?? new Uint8Array());
    if (real && real !== tex.getMimeType()) tex.setMimeType(real);
  }
  // 2. Textures: colour at `base`, metal/rough (near-flat) at `mr`, both WebP.
  await doc.transform(
    textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [base, base], slots: /baseColor/i, quality: 82 }),
    textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [mr, mr], slots: /metallicRoughness|normal|occlusion|emissive/i, quality: 70 }),
  );
  // 3. Geometry: weld, simplify (bounded error), then Draco.
  await MeshoptSimplifier.ready;
  await doc.transform(dedup(), weld(), simplify({ simplifier: MeshoptSimplifier, ratio, error: 0.001 }), prune(), draco({ method: 'edgebreaker' }));
  await io.write(outPath, doc);
  let triangles = 0;
  for (const mesh of doc.getRoot().listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      const idx = prim.getIndices();
      triangles += idx ? idx.getCount() / 3 : prim.getAttribute('POSITION').getCount() / 3;
    }
  }
  return { inBytes: fs.statSync(inPath).size, outBytes: fs.statSync(outPath).size, triangles };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
if (isMain) {
  const args = process.argv.slice(2);
  const opt = (n, d) => {
    const i = args.indexOf(n);
    return i >= 0 ? args[i + 1] : d;
  };
  const opts = { base: Number(opt('--base', '1024')), mr: Number(opt('--mr', '512')), target: Number(opt('--target', '20000')) };
  if (opt('--ratio')) opts.ratio = Number(opt('--ratio'));
  const jobs = [];
  if (args.includes('--all')) {
    for (const f of fs.readdirSync(RAW_DIR).filter((f) => f.endsWith('.glb'))) jobs.push([path.join(RAW_DIR, f), path.join(OUT_DIR, f)]);
  } else {
    jobs.push([opt('--in'), opt('--out')]);
  }
  for (const [inPath, outPath] of jobs) {
    const r = await optimizeGlb(inPath, outPath, opts);
    console.log(`${path.basename(inPath)}: ${(r.inBytes / 1024).toFixed(0)} KB → ${(r.outBytes / 1024).toFixed(0)} KB, ${r.triangles} triangles → ${path.relative(ROOT, outPath)}`);
  }
}
