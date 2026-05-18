/**
 * Sims-Parity DT-20 — detectMarker + silhouetteEstimate unit tests.
 *
 * The js-aruco2 dep is heavy + js-canvas-bound; the detector tests
 * here exercise the no-match graceful path. The marker-anchored
 * silhouette estimator has its own fixture tests.
 */
import { describe, it, expect } from 'vitest';
import { ARUCO_MARKER_IDS, __resetDetectorCacheForTests, detectMarker } from '../detectMarker';
import { estimateSilhouetteBbox } from '../silhouetteEstimate';
import type { CornerPoint } from '../scaleFromMarker';

function flatImage(w: number, h: number, value = 255): ImageData {
  const d = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < d.length; i += 4) {
    d[i] = d[i + 1] = d[i + 2] = value;
    d[i + 3] = 255;
  }
  return { width: w, height: h, data: d, colorSpace: 'srgb' } as unknown as ImageData;
}

function imageWithDarkBoxAt(
  w: number, h: number,
  box: { x: number; y: number; w: number; h: number },
): ImageData {
  const img = flatImage(w, h, 255);
  for (let y = box.y; y < box.y + box.h; y++) {
    for (let x = box.x; x < box.x + box.w; x++) {
      const p = (y * w + x) * 4;
      img.data[p] = img.data[p + 1] = img.data[p + 2] = 30;
    }
  }
  return img;
}

describe('DT-20 / detectMarker', () => {
  it('VC-1 locked marker IDs are [0, 1, 2, 3]', () => {
    expect(ARUCO_MARKER_IDS).toEqual([0, 1, 2, 3]);
  });

  it('returns ok=false + empty IDs on a flat image (no markers detected)', async () => {
    __resetDetectorCacheForTests();
    const result = await detectMarker(flatImage(64, 64));
    expect(result.ok).toBe(false);
    expect(result.detectedIds).toEqual([]);
  });
});

describe('DT-20 / estimateSilhouetteBbox', () => {
  const markerCorners: [CornerPoint, CornerPoint, CornerPoint, CornerPoint] = [
    { xPx: 100, yPx: 100 },
    { xPx: 300, yPx: 100 },
    { xPx: 300, yPx: 300 },
    { xPx: 100, yPx: 300 },
  ];

  it('returns null when no dark pixels outside the marker quad', () => {
    const r = estimateSilhouetteBbox({
      image: flatImage(400, 400, 255),
      markerCorners,
    });
    expect(r).toBeNull();
  });

  it('finds a bbox around a dark product blob outside the quad', () => {
    const img = imageWithDarkBoxAt(800, 600, { x: 500, y: 200, w: 120, h: 200 });
    const r = estimateSilhouetteBbox({ image: img, markerCorners });
    expect(r).not.toBeNull();
    if (r) {
      // The blob's centroid is around (560, 300), well outside the A4 quad.
      expect(r.x).toBeGreaterThanOrEqual(496); // step=4 quantises
      expect(r.x).toBeLessThanOrEqual(508);
      expect(r.width).toBeGreaterThan(100);
      expect(r.height).toBeGreaterThan(180);
    }
  });

  it('ignores dark pixels INSIDE the marker quad (the printed page itself)', () => {
    // Dark blob entirely inside the quad → no bbox out.
    const img = imageWithDarkBoxAt(400, 400, { x: 150, y: 150, w: 80, h: 80 });
    const r = estimateSilhouetteBbox({ image: img, markerCorners });
    expect(r).toBeNull();
  });
});
