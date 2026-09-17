/**
 * fitToSize — the `modelUp` pitch (2026-09-17, hero bodies).
 *
 * An image-to-3D generator builds a flat product (a solar panel) as an
 * UPRIGHT slab: the Jinko 475 W panel came out as x ±0.56, y ±1.0, z ±0.11
 * with its photo face on −z. Laying it down = pitch about x so that face
 * points up; the fit then maps the long side to the length and the thin
 * side to the 3 cm height — exactly, like every other body.
 */
import { describe, expect, it } from 'vitest';
import { fitToSize, pitchedBox, upPitchRad } from '../fitToSize';

const JINKO_RAW = { min: { x: -0.56841, y: -0.99764, z: -0.11424 }, max: { x: 0.5596, y: 0.98984, z: 0.10371 } };

describe('upPitchRad', () => {
  it('is 0 for a y-up model and ±90° about x for a photo-face slab', () => {
    expect(upPitchRad(undefined)).toBe(0);
    expect(upPitchRad('+y')).toBe(0);
    expect(upPitchRad('+z')).toBeCloseTo(-Math.PI / 2, 12);
    expect(upPitchRad('-z')).toBeCloseTo(Math.PI / 2, 12);
  });
});

describe('pitchedBox', () => {
  it('leaves a y-up box alone', () => {
    expect(pitchedBox(JINKO_RAW, '+y')).toEqual(JINKO_RAW);
    expect(pitchedBox(JINKO_RAW, undefined)).toEqual(JINKO_RAW);
  });

  it("'-z' up: the thin z extent becomes the height, the tall y extent lies along z (y' = −z, z' = y)", () => {
    const b = pitchedBox(JINKO_RAW, '-z');
    expect(b.max.y - b.min.y).toBeCloseTo(JINKO_RAW.max.z - JINKO_RAW.min.z, 12);
    expect(b.max.z - b.min.z).toBeCloseTo(JINKO_RAW.max.y - JINKO_RAW.min.y, 12);
    expect(b.min.y).toBeCloseTo(-JINKO_RAW.max.z, 12);
    expect(b.max.z).toBeCloseTo(JINKO_RAW.max.y, 12);
    expect(b.min.x).toBe(JINKO_RAW.min.x);
  });

  it("'+z' up: y' = z, z' = −y", () => {
    const b = pitchedBox(JINKO_RAW, '+z');
    expect(b.min.y).toBeCloseTo(JINKO_RAW.min.z, 12);
    expect(b.max.y).toBeCloseTo(JINKO_RAW.max.z, 12);
    expect(b.min.z).toBeCloseTo(-JINKO_RAW.max.y, 12);
    expect(b.max.z).toBeCloseTo(-JINKO_RAW.min.y, 12);
  });
});

describe('a photo-slab panel laid flat fits the catalog box exactly', () => {
  it('190.3 × 113.4 × 3 cm: 3 cm tall, 1.903 m along the length, 1.134 m along the width', () => {
    const fit = fitToSize({ bbox: pitchedBox(JINKO_RAW, '-z'), lengthCm: 190.3, widthCm: 113.4, heightCm: 3 });
    const pitched = pitchedBox(JINKO_RAW, '-z');
    // Height: the thin axis.
    expect((pitched.max.y - pitched.min.y) * fit.scale.y).toBeCloseTo(0.03, 12);
    // The long model side (now z) carries the length: swapped, 90° yaw.
    expect(fit.swapped).toBe(true);
    expect((pitched.max.z - pitched.min.z) * fit.scale.z).toBeCloseTo(1.903, 12);
    expect((pitched.max.x - pitched.min.x) * fit.scale.x).toBeCloseTo(1.134, 12);
    expect(Math.abs(fit.yawRad)).toBeCloseTo(Math.PI / 2, 12);
    expect(fit.fittedM.length).toBeCloseTo(1.903, 12);
    expect(fit.fittedM.width).toBeCloseTo(1.134, 12);
    expect(fit.fittedM.height).toBeCloseTo(0.03, 12);
  });
});
