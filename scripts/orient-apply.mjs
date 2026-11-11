#!/usr/bin/env node
/**
 * orient-apply — set `modelFront` per generated body so its head lands where
 * the plan's TOP-DOWN art puts it at rotation 0 (2026-09-17).
 *
 * Inputs: the raw body (its head side in its own frame — the centroid of the
 * top-25 %-height vertices, see orient-check.mjs) and a per-product table of
 * where the top-down art shows the head: 'right' (+x), 'left' (−x),
 * 'top' (−y), 'bottom' (+y). The fit turns the model by
 * modelFrontYaw + swapYaw (+ front-edge yaw); this tries the four fronts and
 * keeps the one whose rotated head vector best matches the art.
 *
 *   node scripts/orient-apply.mjs --dry-run
 *   node scripts/orient-apply.mjs            # writes productModels.json
 */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';

const ROOT = path.resolve(new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const RAW_DIR = path.join(ROOT, 'models-raw');
const CATALOG = path.join(ROOT, 'src', 'data', 'products.json');
const MANIFEST = path.join(ROOT, 'src', 'data', 'productModels.json');
const dryRun = process.argv.includes('--dry-run');

// The law itself (ART_HEAD, the yaw tables, the scoring) lives in
// scripts/product-engine/lib/orient.mjs since 2026-11-08, so the product engine
// and this script share one copy. This script keeps its behaviour.
import { ART_HEAD, EPS, pickModelFront } from './product-engine/lib/orient.mjs';

const catalog = JSON.parse(fs.readFileSync(CATALOG, 'utf8'));
const products = Array.isArray(catalog) ? catalog : catalog.products;
const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);

for (const [id, art] of Object.entries(ART_HEAD)) {
  const entry = manifest[id];
  const p = products.find((q) => q.id === id);
  const raw = path.join(RAW_DIR, `${id}.glb`);
  if (!entry || !p || !fs.existsSync(raw)) {
    console.log(`${id.padEnd(34)} skipped (no body)`);
    continue;
  }
  const doc = await io.read(raw);
  let min = [Infinity, Infinity, Infinity];
  let max = [-Infinity, -Infinity, -Infinity];
  const pts = [];
  for (const mesh of doc.getRoot().listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      const arr = prim.getAttribute('POSITION').getArray();
      for (let i = 0; i < arr.length; i += 3) {
        const v = [arr[i], arr[i + 1], arr[i + 2]];
        pts.push(v);
        for (let k = 0; k < 3; k++) {
          if (v[k] < min[k]) min[k] = v[k];
          if (v[k] > max[k]) max[k] = v[k];
        }
      }
    }
  }
  const half = [0, 1, 2].map((k) => (max[k] - min[k]) / 2 || 1);
  const mid = [0, 1, 2].map((k) => (max[k] + min[k]) / 2);
  const yCut = min[1] + 0.75 * (max[1] - min[1]);
  let n = 0;
  let hx = 0;
  let hz = 0;
  for (const v of pts) {
    if (v[1] < yCut) continue;
    n++;
    hx += (v[0] - mid[0]) / half[0];
    hz += (v[2] - mid[2]) / half[2];
  }
  hx /= n || 1;
  hz /= n || 1;
  // The fit's swap decision (lengthAxis auto): by aspect.
  const ex = max[0] - min[0];
  const ez = max[2] - min[2];
  const L = p.dimensions_cm.length / 100;
  const W = p.dimensions_cm.width / 100;
  let swapped;
  if (entry.lengthAxis === 'x') swapped = false;
  else if (entry.lengthAxis === 'z') swapped = true;
  else {
    const catalogAspect = L / W;
    swapped = Math.abs(Math.log(ez / ex / catalogAspect)) + EPS < Math.abs(Math.log(ex / ez / catalogAspect));
  }
  const best = pickModelFront({ head: { x: hx, z: hz }, art, swapped, frontEdge: p.front_edge || 'bottom' });
  const weak = best.weak;
  const line = `${id.padEnd(34)} head(model) x ${hx.toFixed(2)} z ${hz.toFixed(2)}${swapped ? ' swapped' : ''} · art ${art.padEnd(6)} → modelFront ${best.front}${weak ? '  (weak signal — check the render)' : ''}`;
  console.log(line);
  if (!dryRun && !weak) {
    entry.modelFront = best.front;
    entry.source = { ...(entry.source || {}), orient: { art, head: { x: +hx.toFixed(3), z: +hz.toFixed(3) }, set: new Date().toISOString() } };
  }
}
if (!dryRun) {
  fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + '\n');
  console.log(`written ${path.relative(ROOT, MANIFEST)}`);
} else console.log('--dry-run: nothing written');
