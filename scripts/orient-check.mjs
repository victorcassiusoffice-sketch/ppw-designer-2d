#!/usr/bin/env node
/**
 * orient-check — where is a generated body's "head" in its own frame?
 *
 * Image-to-3D output faces whichever way the photo was taken, so the fit
 * needs `modelFront` per body. For gym machines the tallest part (console,
 * screen, handlebars, weight tower) marks the business end. This prints, per
 * raw body: the bounding box, and the centroid of the vertices in the top
 * 25 % of the height along x and z, as a fraction of the half-extent — a
 * strong + x means "the head is at +x", etc. Nothing is written.
 *
 *   node scripts/orient-check.mjs                 # every raw body
 *   node scripts/orient-check.mjs k1-nordictrack-2450
 */
import fs from 'node:fs';
import path from 'node:path';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';

const ROOT = path.resolve(new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const RAW_DIR = path.join(ROOT, 'models-raw');
const ids = process.argv.slice(2);
const files = fs.readdirSync(RAW_DIR).filter((f) => f.endsWith('.glb')).filter((f) => !ids.length || ids.includes(f.replace(/\.glb$/, '')));
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);

for (const f of files) {
  const doc = await io.read(path.join(RAW_DIR, f));
  let min = [Infinity, Infinity, Infinity];
  let max = [-Infinity, -Infinity, -Infinity];
  const pts = [];
  for (const mesh of doc.getRoot().listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      const pos = prim.getAttribute('POSITION');
      const arr = pos.getArray();
      for (let i = 0; i < arr.length; i += 3) {
        const p = [arr[i], arr[i + 1], arr[i + 2]];
        pts.push(p);
        for (let k = 0; k < 3; k++) {
          if (p[k] < min[k]) min[k] = p[k];
          if (p[k] > max[k]) max[k] = p[k];
        }
      }
    }
  }
  const half = [0, 1, 2].map((k) => (max[k] - min[k]) / 2 || 1);
  const mid = [0, 1, 2].map((k) => (max[k] + min[k]) / 2);
  const yCut = min[1] + 0.75 * (max[1] - min[1]);
  let n = 0;
  let sx = 0;
  let sz = 0;
  for (const p of pts) {
    if (p[1] < yCut) continue;
    n++;
    sx += (p[0] - mid[0]) / half[0];
    sz += (p[2] - mid[2]) / half[2];
  }
  const hx = n ? sx / n : 0;
  const hz = n ? sz / n : 0;
  const fmt = (v) => (v >= 0 ? '+' : '') + v.toFixed(2);
  console.log(
    `${f.replace(/\.glb$/, '').padEnd(34)} bbox x ${fmt(min[0])}..${fmt(max[0])}  y ${fmt(min[1])}..${fmt(max[1])}  z ${fmt(min[2])}..${fmt(max[2])}  top25% head: x ${fmt(hx)}  z ${fmt(hz)}  (${n} verts)`,
  );
}
