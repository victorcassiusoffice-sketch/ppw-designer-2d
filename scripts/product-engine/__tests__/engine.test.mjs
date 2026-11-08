/** The pure parts of the product engine: row shapes, the raw shape check, up detection, the orientation law, the gate, the bill. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normaliseRow, photoUrlOf } from '../lib/catalog.mjs';
import { catalogueIsFlat, detectUp, pitchedExtents, rawShapeCheck } from '../lib/shape.mjs';
import { ART_HEAD, headAgreesWithArt, pickModelFront, swappedFor } from '../lib/orient.mjs';
import { evaluateGate } from '../lib/gate.mjs';
import { PERSON_TOOL, PICTURE_TOOL, TOOLS } from '../lib/prices.mjs';
import { personBill } from '../lib/people.mjs';

test('a catalogue row keeps its centimetres and its front edge', () => {
  const r = normaliseRow({ id: 'k1-x', name: 'X', dimensions_cm: { length: 205, width: 95, height: 165 }, front_edge: 'left', photo_image_url: '/products/photos/x.webp' }, 'products.json');
  assert.deepEqual(r.dimensions_cm, { length: 205, width: 95, height: 165 });
  assert.equal(r.front_edge, 'left');
  assert.equal(r.photo, '/products/photos/x.webp');
  assert.equal(r.dimsProblem, null);
});

test('a merchant add-product row arrives in millimetres: width → length (plan x), depth → width (plan y)', () => {
  const r = normaliseRow({ sku: 'K1 CDIO 2450', name: 'Treadmill', widthMm: 2050, depthMm: 950, heightMm: 1650, imageUrl: 'https://example.com/p.jpg' });
  assert.equal(r.id, 'k1-cdio-2450');
  assert.deepEqual(r.dimensions_cm, { length: 205, width: 95, height: 165 });
  assert.equal(r.front_edge, 'bottom');
  assert.equal(r.frontEdgeDeclared, false);
  assert.equal(r.photo, 'https://example.com/p.jpg');
});

test('a row without a height, or with a zero, is flagged, never guessed', () => {
  assert.match(normaliseRow({ id: 'a', widthMm: 100, depthMm: 100 }).dimsProblem, /positive/);
  assert.match(normaliseRow({ id: 'b', dimensions_cm: { length: 10, width: 0, height: 5 } }).dimsProblem, /positive/);
  assert.throws(() => normaliseRow({ name: 'no id' }), /id/);
});

test('drawings and placeholders are not photos', () => {
  assert.equal(photoUrlOf('/products/illustrations/tank.svg'), null);
  assert.equal(photoUrlOf('data:image/svg+xml;utf8,<svg/>'), null);
  assert.equal(photoUrlOf('https://placehold.co/400'), null);
  assert.equal(photoUrlOf('/products/photos/k1.webp'), '/products/photos/k1.webp');
});

test('the raw shape check: the body\'s proportions must be the product\'s within 15 %', () => {
  const dims = { length: 205, width: 95, height: 165 };
  // A body at an arbitrary scale with the right proportions passes.
  assert.equal(rawShapeCheck([2.05 * 3, 1.65 * 3, 0.95 * 3], dims).pass, true);
  // The same body authored the other way round (length along z) still passes: the check sorts the footprint.
  assert.equal(rawShapeCheck([0.95, 1.65, 2.05], dims).pass, true);
  // A body a third too long fails on the footprint aspect.
  const long = rawShapeCheck([2.05 * 1.33, 1.65, 0.95], dims);
  assert.equal(long.pass, false);
  assert.ok(long.aspectError > 0.15);
  // A body with the right footprint but half the height fails on the height.
  const squat = rawShapeCheck([2.05, 0.8, 0.95], dims);
  assert.equal(squat.pass, false);
  assert.ok(squat.heightError > 0.15);
});

test('flat products: a panel built as an upright slab is laid down by its photo face', () => {
  const panel = { length: 190.3, width: 113.4, height: 3 };
  assert.equal(catalogueIsFlat(panel), true);
  assert.equal(catalogueIsFlat({ length: 205, width: 95, height: 165 }), false);
  // Upright slab, thin along z (the September Hunyuan case): the photo face (−z) turns up, no bake.
  const upright = detectUp([1.9, 1.13, 0.03], panel, -1);
  assert.equal(upright.up, '-z');
  assert.equal(upright.bakeYaw, false);
  // The same slab with its photo on +z.
  assert.equal(detectUp([1.9, 1.13, 0.03], panel, 1).up, '+z');
  // Thin along x: needs the quarter turn first.
  assert.equal(detectUp([0.03, 1.13, 1.9], panel, -1).bakeYaw, true);
  // Already lying down: y stays up.
  assert.equal(detectUp([1.9, 0.03, 1.13], panel, -1).up, '+y');
  // The pitched extents swap y and z, so the shape check sees the lying-down body.
  assert.deepEqual(pitchedExtents([1.9, 1.13, 0.03], '-z'), [1.9, 0.03, 1.13]);
  assert.equal(rawShapeCheck(pitchedExtents([1.9, 1.13, 0.03], '-z'), panel).pass, true);
});

test('the orientation law: the head lands where the art puts it', () => {
  // A head at +x in the body's own frame, art "right", front edge bottom, no swap → +z (no turn).
  const pick = pickModelFront({ head: { x: 0.53, z: -0.01 }, art: 'right', swapped: false, frontEdge: 'bottom' });
  assert.equal(pick.front, '+z');
  assert.equal(pick.weak, false);
  // The same head with art "left" needs a half turn.
  assert.equal(pickModelFront({ head: { x: 0.53, z: -0.01 }, art: 'left', swapped: false, frontEdge: 'bottom' }).front, '-z');
  // The check agrees with the pick, and disagrees with the opposite front.
  assert.equal(headAgreesWithArt({ head: { x: 0.53, z: -0.01 }, art: 'right', modelFront: '+z', swapped: false, frontEdge: 'bottom' }).agrees, true);
  assert.equal(headAgreesWithArt({ head: { x: 0.53, z: -0.01 }, art: 'right', modelFront: '-z', swapped: false, frontEdge: 'bottom' }).agrees, false);
  // No clear head: weak, the default is kept and the eye decides.
  assert.equal(pickModelFront({ head: { x: 0.05, z: 0.02 }, art: 'top', swapped: false }).weak, true);
  // The swap decision is the fit's: by aspect.
  assert.equal(swappedFor({ ex: 2.05, ez: 0.95, lengthCm: 205, widthCm: 95 }), false);
  assert.equal(swappedFor({ ex: 0.95, ez: 2.05, lengthCm: 205, widthCm: 95 }), true);
  assert.equal(Object.keys(ART_HEAD).length, 13);
});

test('the gate passes only when every check passes', () => {
  const good = {
    photo: { status: 'usable' },
    shape: { pass: true, aspectError: 0.02, heightError: 0.03 },
    measure: {
      envelope: { lengthCm: 205, widthCm: 95, heightCm: 165, errCm: { length: 0.001, width: 0.002, height: 0.001 } },
      floorM: 0.0001, pivotOffsetM: { x: 0.0005, z: -0.0002 },
      served: { triangles: 19800, texturesTotal: 2, texturesLoaded: 2, baseColorMaps: 1 },
      phone: { ok: true, triangles: 4900, texturesTotal: 2, texturesLoaded: 2 },
      plan: { coverage: { x: 0.995, y: 0.99, opaqueFraction: 0.6 } },
    },
    copies: { served: { bytes: 160 * 1024, triangles: 19800 }, phone: { bytes: 60 * 1024, triangles: 4900 } },
    facing: { pass: true, detail: 'art law: on' },
  };
  assert.equal(evaluateGate(good).pass, true);
  const offByTwoCm = { ...good, measure: { ...good.measure, envelope: { ...good.measure.envelope, errCm: { length: 2, width: 0, height: 0 } } } };
  const g2 = evaluateGate(offByTwoCm);
  assert.equal(g2.pass, false);
  assert.deepEqual(g2.failed, ['envelope within 1 cm']);
  const noPhone = { ...good, measure: { ...good.measure, phone: { ok: false, error: 'nope' } } };
  assert.ok(evaluateGate(noPhone).failed.includes('phone copy loads'));
  const emptyPlan = { ...good, measure: { ...good.measure, plan: { coverage: { x: 0.5, y: 0.99, opaqueFraction: 0.01 } } } };
  assert.deepEqual(evaluateGate(emptyPlan).failed, ['plan picture not empty', 'plan footprint within 2 %']);
  const wrongPhoto = { ...good, photo: { status: 'wrong', why: 'a bracket' } };
  assert.deepEqual(evaluateGate(wrongPhoto).failed, ['photo usable']);
});

test('the bill: three products through three tools is $6.08, one person is $1.55', () => {
  const perProduct = TOOLS.tripo.price + TOOLS.meshy.price + TOOLS.hunyuan.price;
  assert.equal(+(perProduct).toFixed(3), 2.025);
  assert.equal(+(3 * perProduct).toFixed(3), 6.075);
  const bill = personBill([{ id: 'nadia', label: 'Nadia' }]);
  assert.equal(+bill[0].total.toFixed(3), 1.545);
  assert.equal(PICTURE_TOOL.price + PERSON_TOOL.price, bill[0].total);
  // The request builders put the picture in the right field for each tool.
  assert.equal(TOOLS.tripo.input('https://x/p.png').image_url, 'https://x/p.png');
  assert.equal(TOOLS.meshy.input('https://x/p.png').image_url, 'https://x/p.png');
  assert.equal(TOOLS.hunyuan.input('https://x/p.png').input_image_url, 'https://x/p.png');
  assert.equal(TOOLS.hunyuan.input('u').face_count, undefined, 'a custom face count would add $0.15');
  assert.equal(PERSON_TOOL.input('u', 1.68).rigging_height_meters, 1.68);
  assert.equal(PERSON_TOOL.input('u', 1.68).animation_action_id, 0);
});
