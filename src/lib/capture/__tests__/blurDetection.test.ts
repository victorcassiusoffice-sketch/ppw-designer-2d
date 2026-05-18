/**
 * Sims-Parity DT-05 — Laplacian-variance blur detection unit tests.
 *
 * Empirical correctness: a synthetic high-frequency image scores
 * much higher than a flat image. Threshold semantics: sharp = above.
 */

import { describe, it, expect } from 'vitest';
import { assessBlur, laplacianVariance, DEFAULT_BLUR_THRESHOLD } from '../blurDetection';
// laplacianVariance imported for threshold-tuning in tests.

function flatImage(w: number, h: number, value = 128): ImageData {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = data[i + 1] = data[i + 2] = value;
    data[i + 3] = 255;
  }
  return { width: w, height: h, data, colorSpace: 'srgb' } as unknown as ImageData;
}

function checkerboardImage(w: number, h: number, cell = 1): ImageData {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const v = ((x / cell + y / cell) | 0) % 2 === 0 ? 0 : 255;
      const p = (y * w + x) * 4;
      data[p] = data[p + 1] = data[p + 2] = v;
      data[p + 3] = 255;
    }
  }
  return { width: w, height: h, data, colorSpace: 'srgb' } as unknown as ImageData;
}

describe('DT-05 / laplacianVariance', () => {
  it('returns zero for a flat image', () => {
    expect(laplacianVariance(flatImage(64, 64))).toBe(0);
  });

  it('returns a large variance for a high-frequency checkerboard', () => {
    const v = laplacianVariance(checkerboardImage(64, 64, 1));
    // Checkerboard with cell=1 produces saturated Laplacian responses.
    expect(v).toBeGreaterThan(10000);
  });

  it('returns zero for an image too small to convolve', () => {
    expect(laplacianVariance(flatImage(2, 2))).toBe(0);
  });

  it('checkerboard scores higher than soft blur', () => {
    const sharp = laplacianVariance(checkerboardImage(32, 32, 1));
    const soft = laplacianVariance(checkerboardImage(32, 32, 4));
    expect(sharp).toBeGreaterThan(soft);
  });
});

describe('DT-05 / assessBlur', () => {
  it('flags a flat image as blurry', () => {
    const verdict = assessBlur(flatImage(64, 64));
    expect(verdict.sharp).toBe(false);
    expect(verdict.variance).toBe(0);
    expect(verdict.threshold).toBe(DEFAULT_BLUR_THRESHOLD);
  });

  it('flags a checkerboard image as sharp', () => {
    const verdict = assessBlur(checkerboardImage(64, 64, 1));
    expect(verdict.sharp).toBe(true);
  });

  it('honours custom threshold', () => {
    // Flat image scores 0; a threshold of 1 flips to "blurry" for it.
    expect(assessBlur(flatImage(64, 64), 1).sharp).toBe(false);
    // Same checkerboard, threshold below its score = sharp; above = blurry.
    const sharpV = laplacianVariance(checkerboardImage(64, 64, 1));
    expect(assessBlur(checkerboardImage(64, 64, 1), sharpV - 1).sharp).toBe(true);
    expect(assessBlur(checkerboardImage(64, 64, 1), sharpV + 1).sharp).toBe(false);
  });
});
