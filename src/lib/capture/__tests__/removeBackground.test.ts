/**
 * Sims-Parity DT-08 — removeBackground v1 unit tests.
 *
 * Verifies the A4-rect mask: pixels inside the quad become alpha=0,
 * pixels outside retain their alpha. Pure-fn so easily exercised
 * with a synthetic ImageData.
 */

import { describe, it, expect } from 'vitest';
import { removeBackground, quadIsValid } from '../removeBackground';
import type { CornerPoint } from '../scaleFromMarker';

function makeImage(w: number, h: number, rgba: [number, number, number, number] = [200, 100, 50, 255]): ImageData {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = rgba[0];
    data[i + 1] = rgba[1];
    data[i + 2] = rgba[2];
    data[i + 3] = rgba[3];
  }
  return { width: w, height: h, data, colorSpace: 'srgb' } as unknown as ImageData;
}

const QUAD: [CornerPoint, CornerPoint, CornerPoint, CornerPoint] = [
  { xPx: 20, yPx: 20 },
  { xPx: 80, yPx: 20 },
  { xPx: 80, yPx: 80 },
  { xPx: 20, yPx: 80 },
];

function alphaAt(img: ImageData, x: number, y: number): number {
  return img.data[(y * img.width + x) * 4 + 3];
}

describe('DT-08 / removeBackground', () => {
  it('clears alpha for a point inside the quad', () => {
    const out = removeBackground(makeImage(100, 100), QUAD);
    expect(alphaAt(out, 50, 50)).toBe(0);
  });

  it('preserves alpha for a point outside the quad', () => {
    const out = removeBackground(makeImage(100, 100), QUAD);
    expect(alphaAt(out, 5, 5)).toBe(255);
    expect(alphaAt(out, 95, 95)).toBe(255);
  });

  it('preserves alpha just outside an edge', () => {
    const out = removeBackground(makeImage(100, 100), QUAD);
    expect(alphaAt(out, 19, 50)).toBe(255); // 1 px left of the quad
    expect(alphaAt(out, 50, 81)).toBe(255); // 1 px below the quad
  });

  it('does not mutate the source ImageData', () => {
    const src = makeImage(100, 100);
    removeBackground(src, QUAD);
    expect(src.data[(50 * 100 + 50) * 4 + 3]).toBe(255);
  });

  it('returns same dimensions', () => {
    const out = removeBackground(makeImage(40, 80), QUAD);
    expect(out.width).toBe(40);
    expect(out.height).toBe(80);
  });

  it('quadIsValid accepts well-separated corners', () => {
    expect(quadIsValid(QUAD)).toBe(true);
  });

  it('quadIsValid rejects degenerate (two corners on top of each other)', () => {
    expect(quadIsValid([
      { xPx: 10, yPx: 10 },
      { xPx: 10, yPx: 10 },
      { xPx: 80, yPx: 80 },
      { xPx: 10, yPx: 80 },
    ])).toBe(false);
  });
});
