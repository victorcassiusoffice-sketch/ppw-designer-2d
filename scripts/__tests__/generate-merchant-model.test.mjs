import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { MODEL, UNIT_USD, runJob, validateJob } from '../generate-merchant-model.mjs';

const job = {
  version: 1, productId: 'test-merchant-product', sku: 'TEST-MODEL',
  dimensions_cm: { length: 80, width: 48, height: 17 },
  photo: 'https://manufacturer.example/exact-sku.jpg',
  sourcePage: 'https://merchant.example/exact-product',
  photoReferencePage: 'https://manufacturer.example/exact-product',
  referenceReview: 'Exact SKU with one product and no accessories.',
  model: MODEL, inputOptions: { generate_type: 'Normal', enable_pbr: true }, estimatedUsd: UNIT_USD,
};
test('keeps the supported single-image PBR input free of custom priced options', () => {
  assert.deepEqual(validateJob(job), { input_image_url: job.photo, generate_type: 'Normal', enable_pbr: true });
  for (const changed of [
    { model: 'fal-ai/hunyuan3d-v21' }, { estimatedUsd: 0.3 },
    { inputOptions: { ...job.inputOptions, face_count: 100000 } },
    { photo: 'data:image/svg+xml,placeholder' }, { photo: 'https://merchant.example/images/products/preview.png' },
    { dimensions_cm: { length: 0, width: 48, height: 17 } }, { sku: '' },
  ]) assert.throws(() => validateJob({ ...job, ...changed }));
});
test('default and insufficient-budget runs cannot call the provider', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'olb-model-test-'));
  const file = path.join(directory, 'job.json');
  await fs.writeFile(file, JSON.stringify(job));
  let calls = 0;
  const neverFetch = () => { calls++; throw new Error('Network not expected'); };
  try {
    assert.equal((await runJob({ jobFile: file }, neverFetch)).dryRun, true);
    await assert.rejects(runJob({ jobFile: file, yes: true, maxUsd: 0.5 }, neverFetch), /explicit --max-usd/);
    assert.equal(calls, 0);
  } finally { await fs.unlink(file); await fs.rmdir(directory); }
});
