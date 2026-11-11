/** The accuracy refinements of 8 November: extra views, the photo cleaner, the level check, the re-roll rule, the fine yaw, catalogue file style. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { cleanProductShot, components, multiviewPlan, viewsOf } from '../lib/views.mjs';
import { bakeQuat, baseTilt, footprintYaw, levelCorrection, rotatePoint } from '../lib/shape.mjs';
import { GATE_LIMITS, evaluateGate, rerollWorth } from '../lib/gate.mjs';
import { TOOLS } from '../lib/prices.mjs';
import { jsonStyle, readJson, writeJson } from '../lib/catalog.mjs';

const identity = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
const bodyOf = (pts) => ({ prims: [{ positions: Float32Array.from(pts.flat()), world: identity }] });

test('extra views: the multiview list is a prefix of front, left, back, right; the main photo stands in for the front', () => {
  assert.deepEqual(viewsOf({ raw: { photo_views: { left: ' /v/l.webp ', back: '', right: 'r' } } }), { left: '/v/l.webp', right: 'r' });
  assert.deepEqual(viewsOf({ raw: {} }), {});
  const two = multiviewPlan({ front: 'f', left: 'l' }, 'main');
  assert.equal(two.use, true);
  assert.deepEqual(two.names, ['front', 'left']);
  assert.deepEqual(two.photos, ['f', 'l']);
  const mainFront = multiviewPlan({ left: 'l' }, 'main');
  assert.equal(mainFront.use, true);
  assert.deepEqual(mainFront.photos, ['main', 'l']);
  assert.equal(mainFront.frontFromMain, true);
  // A right view alone cannot be sent: the second slot means "left".
  const rightOnly = multiviewPlan({ right: 'r' }, 'main');
  assert.equal(rightOnly.use, false);
  assert.deepEqual(rightOnly.skipped, ['right']);
  assert.match(rightOnly.why, /positions are front, left, back, right/);
  // A gap in the order stops the list there.
  const gap = multiviewPlan({ front: 'f', left: 'l', right: 'r' }, 'main');
  assert.deepEqual(gap.names, ['front', 'left']);
  assert.deepEqual(gap.skipped, ['right']);
  assert.equal(multiviewPlan({}, null).use, false);
  // The request carries the list in order, the same options as the one-photo call, the same price.
  const input = TOOLS.tripo.multiview.input(['f', 'l']);
  assert.deepEqual(input.image_urls, ['f', 'l']);
  assert.equal(input.orientation, 'align_image');
  assert.equal(TOOLS.tripo.multiview.endpoint, 'tripo3d/h3.1/multiview-to-3d');
});

test('a listing\'s spec drawing is cleaned: arrows and callouts go, the product stays, the crop is square', async () => {
  // A white 800 × 600 picture: the product (a black box), a grey dimension arrow under it inside the crop, a blue callout left of it.
  const png = await sharp({ create: { width: 800, height: 600, channels: 3, background: '#ffffff' } }).composite([
    { input: { create: { width: 300, height: 200, channels: 3, background: '#111111' } }, left: 250, top: 200 },
    { input: { create: { width: 280, height: 4, channels: 3, background: '#999999' } }, left: 260, top: 430 },
    { input: { create: { width: 20, height: 120, channels: 3, background: '#2b86d6' } }, left: 60, top: 300 },
  ]).png().toBuffer();
  const r = await cleanProductShot(png, { size: 256 });
  assert.deepEqual([r.product.left, r.product.top, r.product.width, r.product.height], [250, 200, 300, 200]);
  assert.equal(r.patches, 3);
  assert.ok(r.paintedPixels > 1000, `painted ${r.paintedPixels}`);
  assert.ok(r.keptFraction > 0.9 && r.keptFraction < 1, `kept ${r.keptFraction}`);
  assert.equal(r.square.side, 330);
  const { data, info } = await sharp(r.buffer).raw().toBuffer({ resolveWithObject: true });
  assert.equal(info.width, 256);
  assert.equal(info.height, 256);
  const px = (x, y) => { const o = (y * info.width + x) * info.channels; return [data[o], data[o + 1], data[o + 2]]; };
  const centre = px(128, 128);
  assert.ok(centre.every((c) => c < 40), `the product is at the centre: ${centre}`);
  // The arrow sat at y = 432 in the source: (432 − 135) / 330 × 256 ≈ 230. White now.
  const arrow = px(128, 230);
  assert.ok(arrow.every((c) => c > 245), `the arrow is painted out: ${arrow}`);
  const corner = px(2, 2);
  assert.ok(corner.every((c) => c > 245), `the corner is white: ${corner}`);
  // The labelling itself (4-neighbours): three patches on a 4 × 3 grid, sizes in scan order.
  const mask = Uint8Array.from([1, 1, 0, 0, 0, 0, 0, 1, 1, 0, 0, 1]);
  const { sizes } = components(mask, 4, 3);
  assert.deepEqual(sizes, [2, 2, 1]);
});

test('a tilted body is measured by the plane through its feet and levelled', () => {
  // A slab 2 × 1 on the floor with a block on top, then handed back pitched 5° and rolled 3°.
  const pts = [];
  for (let i = 0; i <= 40; i++) for (let j = 0; j <= 20; j++) pts.push([-1 + i / 20, 0, -0.5 + j / 20]);
  for (let i = 0; i <= 10; i++) for (let k = 0; k <= 4; k++) pts.push([-0.5 + i / 10, 0.2 + k / 5, 0]);
  const level = baseTilt(bodyOf(pts));
  assert.ok(Math.abs(level.pitchDeg) < 0.01 && Math.abs(level.rollDeg) < 0.01, `a level slab measures level: ${level.pitchDeg}, ${level.rollDeg}`);
  const q = bakeQuat({ pitchRad: (5 * Math.PI) / 180, rollRad: (3 * Math.PI) / 180 });
  const tilted = pts.map((p) => rotatePoint(q, p));
  const t = baseTilt(bodyOf(tilted));
  assert.ok(Math.hypot(t.pitchDeg, t.rollDeg) > 4.5, `the tilt is seen: ${t.pitchDeg}, ${t.rollDeg}`);
  assert.ok(Math.abs(Math.abs(t.pitchDeg) - 5) < 0.6, `pitch about 5°: ${t.pitchDeg}`);
  assert.ok(Math.abs(Math.abs(t.rollDeg) - 3) < 0.6, `roll about 3°: ${t.rollDeg}`);
  const fixed = baseTilt(bodyOf(tilted.map((p) => rotatePoint(bakeQuat(levelCorrection(t)), p))));
  assert.ok(Math.abs(fixed.pitchDeg) < 0.3 && Math.abs(fixed.rollDeg) < 0.3, `levelled: ${fixed.pitchDeg}, ${fixed.rollDeg}`);
  // The gate line.
  const base = { photo: { status: 'usable' }, shape: { pass: true, aspectError: 0.02, heightError: 0.03 }, measure: { envelope: { lengthCm: 1, widthCm: 1, heightCm: 1, errCm: { length: 0, width: 0, height: 0 } }, floorM: 0, pivotOffsetM: { x: 0, z: 0 }, served: { triangles: 1, texturesTotal: 1, texturesLoaded: 1, baseColorMaps: 1 }, phone: { ok: true, triangles: 1, texturesTotal: 1, texturesLoaded: 1 }, plan: { coverage: { x: 1, y: 1, opaqueFraction: 0.5 } } }, copies: { served: { bytes: 1, triangles: 1 }, phone: { bytes: 1, triangles: 1 } }, facing: { pass: true, detail: '' } };
  assert.equal(evaluateGate({ ...base, level: { pitchDeg: 0.4, rollDeg: -1.2, n: 500 } }).pass, true);
  const leaning = evaluateGate({ ...base, level: { pitchDeg: 3.1, rollDeg: 0, n: 500 } });
  assert.equal(leaning.pass, false);
  assert.deepEqual(leaning.failed, [`stands level (base within ${GATE_LIMITS.levelDeg}°)`]);
  assert.equal(evaluateGate(base).checks.some((c) => c.name.startsWith('stands level')), false, 'no level record, no level line');
});

test('a re-roll is bought only for a near miss', () => {
  assert.equal(rerollWorth({ pass: false, aspectError: 0.195, heightError: 0.095, heightJudged: true }), true, 'the test treadmill, 19.5 %: within 20 %');
  assert.equal(rerollWorth({ pass: false, aspectError: 0.22, heightError: 0.095, heightJudged: true }), false, '22 % is not a near miss');
  assert.equal(rerollWorth({ pass: false, aspectError: 0.32, heightError: 0.15, heightJudged: true }), false);
  assert.equal(rerollWorth({ pass: false, aspectError: 0.16, heightError: 0.3, heightJudged: true }), false, 'the height counts too');
  assert.equal(rerollWorth({ pass: false, aspectError: 0.16, heightError: 3.2, heightJudged: false }), true, 'a flat product is judged on its footprint only');
  assert.equal(rerollWorth({ pass: true, aspectError: 0.01, heightError: 0.01 }), false);
  assert.equal(rerollWorth(null), false);
});

test('the fine yaw pass lands within a twentieth of a degree', () => {
  const turn = (31.3 * Math.PI) / 180;
  const pts = [];
  for (let i = 0; i <= 40; i++) for (let j = 0; j <= 20; j++) {
    const x = -1.025 + (i / 40) * 2.05;
    const z = -0.475 + (j / 20) * 0.95;
    pts.push([Math.cos(turn) * x + Math.sin(turn) * z, 0.5, -Math.sin(turn) * x + Math.cos(turn) * z]);
  }
  const y = footprintYaw(bodyOf(pts));
  assert.ok(Math.abs(Math.abs(y.degrees) - 31.3) <= 0.06, `found ${y.degrees}°`);
  assert.equal(footprintYaw(bodyOf([[-1, 0, -0.5], [1, 0, -0.5], [1, 0, 0.5], [-1, 0, 0.5]])).degrees, 0);
});

test('writing a catalogue file keeps its own indent and line ends', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'engine-json-'));
  const file = path.join(dir, 'products.json');
  fs.writeFileSync(file, '{\r\n "version": "1",\r\n "products": [\r\n  {\r\n   "id": "a"\r\n  }\r\n ]\r\n}\r\n');
  assert.deepEqual(jsonStyle(fs.readFileSync(file, 'utf8')), { indent: ' ', eol: '\r\n', finalNewline: true });
  const data = readJson(file);
  data.products[0].note = 'x';
  writeJson(file, data);
  const text = fs.readFileSync(file, 'utf8');
  assert.equal(text, '{\r\n "version": "1",\r\n "products": [\r\n  {\r\n   "id": "a",\r\n   "note": "x"\r\n  }\r\n ]\r\n}\r\n');
  const fresh = path.join(dir, 'new.json');
  writeJson(fresh, { a: 1 });
  assert.equal(fs.readFileSync(fresh, 'utf8'), '{\n  "a": 1\n}\n');
  fs.rmSync(dir, { recursive: true, force: true });
});
