import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { Document, NodeIO } from '@gltf-transform/core';
import { importSketchupModel } from '../import-sketchup-model.mjs';

async function fixture(t) {
  const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'ppw-model-import-'));
  t.after(async () => {
    // Delete only this resolved fixture created under the OS temp directory.
    assert.equal(path.dirname(repoRoot), os.tmpdir());
    assert.ok(path.basename(repoRoot).startsWith('ppw-model-import-'));
    await fs.rm(repoRoot, { recursive: true, force: true });
  });
  await fs.mkdir(path.join(repoRoot, 'src/data'), { recursive: true });
  await fs.mkdir(path.join(repoRoot, 'src/demo/courts'), { recursive: true });
  await fs.writeFile(path.join(repoRoot, 'src/data/products.json'), JSON.stringify({ products: [{ id: 'test-chair', sku: 'CHAIR-1', dimensions_cm: { length: 65, width: 55, height: 90 } }] }));
  await fs.writeFile(path.join(repoRoot, 'src/demo/courts/products.json'), '{"products":[]}');
  const manifestPath = path.join(repoRoot, 'src/data/productModels.json');
  await fs.writeFile(manifestPath, '{}\n');
  const doc = new Document();
  const buffer = doc.createBuffer();
  const positions = doc.createAccessor().setType('VEC3').setArray(new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1])).setBuffer(buffer);
  const indices = doc.createAccessor().setType('SCALAR').setArray(new Uint16Array([0, 1, 2, 0, 2, 3, 0, 3, 1, 1, 3, 2])).setBuffer(buffer);
  const mesh = doc.createMesh().addPrimitive(doc.createPrimitive().setAttribute('POSITION', positions).setIndices(indices));
  doc.createScene().addChild(doc.createNode().setMesh(mesh));
  const input = path.join(repoRoot, 'original.glb');
  await new NodeIO().write(input, doc);
  return { repoRoot, input, productId: 'test-chair', source: 'Original fixture', licence: 'Original test geometry', manifestPath };
}

test('imports a GLB into the existing dimension-fitted manifest without changing product sizes', async t => {
  const args = await fixture(t);
  const result = await importSketchupModel(args);
  const manifest = JSON.parse(await fs.readFile(args.manifestPath, 'utf8'));
  assert.equal(manifest['test-chair'].url, result.url);
  assert.equal(manifest['test-chair'].source.sku, 'CHAIR-1');
  assert.equal(manifest['test-chair'].preferMesh, true);
  assert.deepEqual(result.dimensions_cm, { length: 65, width: 55, height: 90 });
  assert.ok((await fs.stat(path.join(args.repoRoot, 'public', result.url))).size > 0);
  assert.equal(result.triangles, 4);
  await assert.rejects(importSketchupModel(args), /model already exists/);
});

test('dry-run validates geometry but leaves catalog and assets untouched', async t => {
  const args = await fixture(t);
  const result = await importSketchupModel({ ...args, dryRun: true });
  assert.equal(result.dryRun, true);
  assert.equal(await fs.readFile(args.manifestPath, 'utf8'), '{}\n');
  await assert.rejects(fs.stat(path.join(args.repoRoot, 'public/models')), /ENOENT/);
});

test('rejects wrong formats, unknown products and missing provenance before mutation', async t => {
  const args = await fixture(t);
  await assert.rejects(importSketchupModel({ ...args, input: 'chair.skp' }), /Direct .skp/);
  await assert.rejects(importSketchupModel({ ...args, productId: '../chair' }), /product ID/);
  await assert.rejects(importSketchupModel({ ...args, productId: 'missing-chair' }), /Unknown catalog/);
  await assert.rejects(importSketchupModel({ ...args, licence: '' }), /--source and --licence/);
  await fs.writeFile(args.input, 'not a model');
  await assert.rejects(importSketchupModel(args), /Not a valid/);
  assert.equal(await fs.readFile(args.manifestPath, 'utf8'), '{}\n');
});

async function existingModel(args) {
  const directory = path.join(args.repoRoot, 'public/models');
  await fs.mkdir(directory, { recursive: true });
  await fs.writeFile(path.join(directory, 'existing.glb'), 'preserved supplier asset');
  const manifest = JSON.stringify({ 'test-chair': { url: '/models/existing.glb' } }) + '\n';
  await fs.writeFile(args.manifestPath, manifest);
  return { directory, manifest };
}

async function assertExistingModelUnchanged(args, prior, expectedManifest = prior.manifest) {
  assert.deepEqual(await fs.readdir(prior.directory), ['existing.glb']);
  assert.equal(await fs.readFile(path.join(prior.directory, 'existing.glb'), 'utf8'), 'preserved supplier asset');
  assert.equal(await fs.readFile(args.manifestPath, 'utf8'), expectedManifest);
  assert.equal((await fs.readdir(path.join(args.repoRoot, 'models-raw'))).some(name => name.startsWith('.sketchup-import-')), false);
  await assert.rejects(fs.stat(`${args.manifestPath}.import.lock`), /ENOENT/);
}

test('a failed optimizer leaves the existing public asset and manifest untouched', async t => {
  const args = await fixture(t);
  const prior = await existingModel(args);
  await assert.rejects(importSketchupModel({ ...args, replace: true }, async (_input, output) => {
    assert.equal(path.dirname(path.dirname(output)), path.join(args.repoRoot, 'models-raw'));
    await fs.writeFile(output, 'partial failed output');
    throw new Error('fixture optimization failure');
  }), /fixture optimization failure/);
  await assertExistingModelUnchanged(args, prior);
});

test('oversized optimized output is rejected before anything is published, regardless of reported statistics', async t => {
  const args = await fixture(t);
  const prior = await existingModel(args);
  await assert.rejects(importSketchupModel({ ...args, replace: true }, async (_input, output) => {
    await fs.writeFile(output, Buffer.alloc(12 * 1024 * 1024 + 1));
    return { inBytes: 1, outBytes: 1, triangles: 4 };
  }), /exceeds 12 MiB/);
  await assertExistingModelUnchanged(args, prior);
});

test('a concurrent manifest edit survives and no candidate is published', async t => {
  const args = await fixture(t);
  const prior = await existingModel(args);
  const editedManifest = JSON.stringify({ 'test-chair': { url: '/models/existing.glb', licence: 'New supplier review' } }) + '\n';
  await assert.rejects(importSketchupModel({ ...args, replace: true }, async (input, output) => {
    await fs.copyFile(input, output);
    await fs.writeFile(args.manifestPath, editedManifest);
    return { inBytes: 1, outBytes: 1, triangles: 4 };
  }), /manifest changed/);
  await assertExistingModelUnchanged(args, prior, editedManifest);
});

test('re-optimizing the same source publishes a separate content-addressed asset and preserves the old version', async t => {
  const args = await fixture(t);
  const first = await importSketchupModel(args);
  const firstAsset = path.join(args.repoRoot, 'public', first.url);
  const originalBytes = await fs.readFile(firstAsset);
  const copyOptimizer = async (input, output) => {
    // Original fixture and compressed output are both valid GLBs but have different bytes.
    await fs.copyFile(input, output);
    const size = (await fs.stat(input)).size;
    return { inBytes: size, outBytes: size, triangles: 4 };
  };
  const second = await importSketchupModel({ ...args, replace: true }, copyOptimizer);
  assert.notEqual(second.url, first.url);
  assert.deepEqual(await fs.readFile(firstAsset), originalBytes);
  assert.equal(JSON.parse(await fs.readFile(args.manifestPath, 'utf8'))['test-chair'].url, second.url);
  const third = await importSketchupModel({ ...args, replace: true }, copyOptimizer);
  assert.equal(third.url, second.url);
  assert.equal((await fs.readdir(path.join(args.repoRoot, 'public/models'))).length, 2);
  assert.deepEqual(await fs.readFile(firstAsset), originalBytes);
});
