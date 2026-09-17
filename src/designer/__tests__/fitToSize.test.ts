/**
 * fitToSize — "100% accuracy" pinned (2026-09-17).
 *
 * A model of any size, unit or facing ends up EXACTLY the catalog's
 * length × width × height, base on the floor, front where `front_edge`
 * says, and its footprint at any rotation equals the plan's
 * `rotatedFootprint`.
 */
import { describe, it, expect } from 'vitest';
import { fitToSize, fittedFootprintAt, itemPose, type FitResult } from '../fitToSize';
import { rotatedFootprint } from '../../lib/geometry';

const box = (sx: number, sy: number, sz: number, min = { x: 0, y: 0, z: 0 }) => ({ min, max: { x: min.x + sx, y: min.y + sy, z: min.z + sz } });

/** Apply scale, yaw and offset to the 8 box corners and measure the result. */
function measure(fit: FitResult, bbox: { min: { x: number; y: number; z: number }; max: { x: number; y: number; z: number } }) {
  const pts: Array<[number, number, number]> = [];
  for (const x of [bbox.min.x, bbox.max.x]) for (const y of [bbox.min.y, bbox.max.y]) for (const z of [bbox.min.z, bbox.max.z]) {
    const sx = x * fit.scale.x, sy = y * fit.scale.y, sz = z * fit.scale.z;
    const c = Math.cos(fit.yawRad), s = Math.sin(fit.yawRad);
    // rotation about +y: x' = x c + z s ; z' = -x s + z c
    const rx = sx * c + sz * s, rz = -sx * s + sz * c;
    pts.push([rx + fit.offset.x, sy + fit.offset.y, rz + fit.offset.z]);
  }
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]), zs = pts.map((p) => p[2]);
  return {
    xExtent: Math.max(...xs) - Math.min(...xs),
    yExtent: Math.max(...ys) - Math.min(...ys),
    zExtent: Math.max(...zs) - Math.min(...zs),
    minY: Math.min(...ys),
    cx: (Math.max(...xs) + Math.min(...xs)) / 2,
    cz: (Math.max(...zs) + Math.min(...zs)) / 2,
  };
}

describe('fitToSize — the fitted box IS the catalog box', () => {
  it('a unit cube becomes exactly 200 × 90 × 150 cm, base on the floor, centred', () => {
    const bbox = box(1, 1, 1, { x: -0.5, y: -0.5, z: -0.5 });
    const fit = fitToSize({ bbox, lengthCm: 200, widthCm: 90, heightCm: 150 });
    const m = measure(fit, bbox);
    expect(m.xExtent).toBeCloseTo(2.0, 9);
    expect(m.zExtent).toBeCloseTo(0.9, 9);
    expect(m.yExtent).toBeCloseTo(1.5, 9);
    expect(m.minY).toBeCloseTo(0, 9);
    expect(m.cx).toBeCloseTo(0, 9);
    expect(m.cz).toBeCloseTo(0, 9);
    expect(fit.swapped).toBe(false);
  });

  it('a model in millimetres, off-centre and floating, lands the same', () => {
    const bbox = box(1830, 1400, 620, { x: 500, y: 300, z: -2000 }); // a treadmill authored in mm, long along x
    const fit = fitToSize({ bbox, lengthCm: 205, widthCm: 95, heightCm: 165 });
    const m = measure(fit, bbox);
    expect(m.xExtent).toBeCloseTo(2.05, 9);
    expect(m.zExtent).toBeCloseTo(0.95, 9);
    expect(m.yExtent).toBeCloseTo(1.65, 9);
    expect(m.minY).toBeCloseTo(0, 9);
    expect(m.cx).toBeCloseTo(0, 9);
    expect(m.cz).toBeCloseTo(0, 9);
  });

  it('a model authored the other way round is TURNED, not squashed', () => {
    const bbox = box(0.9, 1.5, 2.0); // long along z
    const fit = fitToSize({ bbox, lengthCm: 200, widthCm: 90, heightCm: 150 });
    expect(fit.swapped).toBe(true);
    const m = measure(fit, bbox);
    expect(m.xExtent).toBeCloseTo(2.0, 9);
    expect(m.zExtent).toBeCloseTo(0.9, 9);
    // The scale stays near-uniform: nothing was stretched to force the fit.
    expect(fit.scale.x).toBeCloseTo(fit.scale.z, 9);
  });

  it('an explicit lengthAxis overrides the aspect guess', () => {
    const bbox = box(1, 1, 1);
    expect(fitToSize({ bbox, lengthCm: 100, widthCm: 100, heightCm: 100, lengthAxis: 'z' }).swapped).toBe(true);
    expect(fitToSize({ bbox, lengthCm: 100, widthCm: 100, heightCm: 100, lengthAxis: 'x' }).swapped).toBe(false);
  });

  it('a square footprint never swaps by accident', () => {
    expect(fitToSize({ bbox: box(1, 1, 1), lengthCm: 80, widthCm: 80, heightCm: 40 }).swapped).toBe(false);
  });

  it('a degenerate (flat) model still fits without dividing by zero', () => {
    const fit = fitToSize({ bbox: box(1, 0, 1), lengthCm: 100, widthCm: 50, heightCm: 2 });
    expect(Number.isFinite(fit.scale.y)).toBe(true);
    expect(fit.fittedM.height).toBeCloseTo(0.02, 9);
  });
});

describe('fitToSize — facing', () => {
  const front = (fit: FitResult): [number, number] => {
    // The model's +z (glTF front) after the yaw, on the plan (x east, y south = three z).
    const c = Math.cos(fit.yawRad), s = Math.sin(fit.yawRad);
    return [Math.round(s * 1000) / 1000, Math.round(c * 1000) / 1000]; // (x, z) of rotated (0,0,1): x' = z s, z' = z c
  };
  it("front_edge 'bottom' (default) faces plan +y — no turn", () => {
    expect(front(fitToSize({ bbox: box(1, 1, 1), lengthCm: 100, widthCm: 50, heightCm: 50 }))).toEqual([0, 1]);
  });
  it("front_edge 'top' faces plan −y", () => {
    expect(front(fitToSize({ bbox: box(1, 1, 1), lengthCm: 100, widthCm: 50, heightCm: 50, frontEdge: 'top' }))).toEqual([0, -1]);
  });
  it("front_edge 'left' faces plan −x, 'right' faces +x", () => {
    expect(front(fitToSize({ bbox: box(1, 1, 1), lengthCm: 100, widthCm: 50, heightCm: 50, frontEdge: 'left' }))).toEqual([-1, 0]);
    expect(front(fitToSize({ bbox: box(1, 1, 1), lengthCm: 100, widthCm: 50, heightCm: 50, frontEdge: 'right' }))).toEqual([1, 0]);
  });
  it('a model that was authored facing −x is first brought to +z', () => {
    const fit = fitToSize({ bbox: box(1, 1, 1), lengthCm: 100, widthCm: 50, heightCm: 50, modelFront: '-x' });
    // Rotate the model's OWN front (−x) by the yaw: x' = x c + z s ; z' = −x s + z c.
    const c = Math.cos(fit.yawRad), s = Math.sin(fit.yawRad);
    const fx = -1 * c, fz = -(-1) * s;
    // `+ 0` folds a −0 into 0 for the deep-equality check.
    expect([Math.round(fx * 1000) / 1000 + 0, Math.round(fz * 1000) / 1000 + 0]).toEqual([0, 1]);
  });
});

describe('the fitted footprint equals the plan’s rotatedFootprint at every rotation', () => {
  const fit = fitToSize({ bbox: box(2, 1, 1), lengthCm: 200, widthCm: 90, heightCm: 150 });
  for (const deg of [0, 90, 180, 270, 45, 30, 135]) {
    it(`${deg}°`, () => {
      const plan = rotatedFootprint({ lengthM: 2.0, widthM: 0.9 }, deg);
      const mine = fittedFootprintAt(fit, deg);
      expect(mine.w).toBeCloseTo(plan.w, 9);
      expect(mine.h).toBeCloseTo(plan.h, 9);
    });
  }
});

describe('itemPose — where the body goes', () => {
  it('centres the body on the rotated footprint and turns it the plan’s way', () => {
    const fp = rotatedFootprint({ lengthM: 2.0, widthM: 0.9 }, 90);
    const pose = itemPose({ x: 1, y: 1, footprintW: fp.w, footprintH: fp.h, rotationDeg: 90 });
    expect(pose.centre).toEqual({ x: 1 + 0.45, y: 1 + 1.0, z: 0 });
    expect(pose.yawRad).toBeCloseTo(-Math.PI / 2, 9);
  });
  it('a wall item keeps its mount height', () => {
    expect(itemPose({ x: 0, y: 0, footprintW: 1, footprintH: 0.1, rotationDeg: 0, z0: 1.1 }).centre.z).toBe(1.1);
  });
});
