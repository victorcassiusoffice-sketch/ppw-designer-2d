/**
 * Sims-Parity DT-06 — scaleFromMarker pure-fn tests.
 *
 * Six golden-input fixtures for pixelsPerMm ±0.5% tolerance.
 * Plus correctness checks for the homography + rms + bbox shape.
 */
import { describe, it, expect } from 'vitest';
import { scaleFromMarker, applyHomography, type CornerPoint } from '../scaleFromMarker';

function quad(scale: number, originX: number, originY: number): [CornerPoint, CornerPoint, CornerPoint, CornerPoint] {
  // A4 portrait quad: 210×297 mm scaled into px at (originX, originY) origin.
  return [
    { xPx: originX, yPx: originY },                          // TL
    { xPx: originX + 210 * scale, yPx: originY },            // TR
    { xPx: originX + 210 * scale, yPx: originY + 297 * scale }, // BR
    { xPx: originX, yPx: originY + 297 * scale },            // BL
  ];
}

describe('DT-06 / scaleFromMarker — 6 golden fixtures', () => {
  const fixtures: Array<{ name: string; ppmm: number; corners: [CornerPoint, CornerPoint, CornerPoint, CornerPoint]; imgW: number; imgH: number }> = [
    { name: 'tight 4 px/mm centred', ppmm: 4, corners: quad(4, 200, 200), imgW: 1920, imgH: 1080 },
    { name: '5.2 px/mm typical phone capture', ppmm: 5.2, corners: quad(5.2, 100, 100), imgW: 1920, imgH: 1080 },
    { name: '3.0 px/mm low-res webcam', ppmm: 3.0, corners: quad(3.0, 50, 50), imgW: 800, imgH: 600 },
    { name: '10 px/mm 4K capture', ppmm: 10, corners: quad(10, 400, 400), imgW: 3840, imgH: 2160 },
    { name: '0.5 px/mm extreme low-res', ppmm: 0.5, corners: quad(0.5, 30, 30), imgW: 320, imgH: 240 },
    { name: '7.7 px/mm offset', ppmm: 7.7, corners: quad(7.7, 250, 150), imgW: 2880, imgH: 1620 },
  ];

  for (const fx of fixtures) {
    it(`${fx.name}: pixelsPerMm ≈ ${fx.ppmm} within ±0.5%`, () => {
      const result = scaleFromMarker({
        corners: fx.corners,
        imageWidthPx: fx.imgW,
        imageHeightPx: fx.imgH,
      });
      const tolerance = fx.ppmm * 0.005;
      expect(Math.abs(result.pixelsPerMm - fx.ppmm)).toBeLessThanOrEqual(tolerance);
    });
  }
});

describe('DT-06 / scaleFromMarker — homography correctness', () => {
  it('homography projects mm-corners back to image corners (sub-px)', () => {
    const corners = quad(5, 100, 200);
    const result = scaleFromMarker({ corners, imageWidthPx: 1920, imageHeightPx: 1080 });
    const mmCorners: Array<[number, number]> = [
      [0, 0], [210, 0], [210, 297], [0, 297],
    ];
    for (let i = 0; i < 4; i++) {
      const proj = applyHomography(result.homography, mmCorners[i][0], mmCorners[i][1]);
      expect(Math.abs(proj.xPx - corners[i].xPx)).toBeLessThan(0.5);
      expect(Math.abs(proj.yPx - corners[i].yPx)).toBeLessThan(0.5);
    }
  });

  it('rmsCalibrationError is ≤ 0.5 px on a perfect rectangle', () => {
    const result = scaleFromMarker({
      corners: quad(5, 100, 200),
      imageWidthPx: 1920, imageHeightPx: 1080,
    });
    expect(result.rmsCalibrationError).toBeLessThanOrEqual(0.5);
  });
});

describe('DT-06 / scaleFromMarker — silhouette_bbox_px', () => {
  it('returns a positive-sized bbox', () => {
    const result = scaleFromMarker({
      corners: quad(5, 100, 100), imageWidthPx: 1920, imageHeightPx: 1080,
    });
    expect(result.silhouette_bbox_px.width).toBeGreaterThan(0);
    expect(result.silhouette_bbox_px.height).toBeGreaterThan(0);
  });

  it('places the bbox below the A4 quad when the quad sits in the top half', () => {
    const result = scaleFromMarker({
      corners: quad(2, 200, 50), // A4 quad in top portion
      imageWidthPx: 1920, imageHeightPx: 1080,
    });
    // Quad bottom is at y = 50 + 297*2 = 644. Bbox should start at >= 644 + 8.
    expect(result.silhouette_bbox_px.y).toBeGreaterThanOrEqual(644 + 8);
  });

  it('places the bbox above the A4 quad when the quad sits in the bottom half', () => {
    const imgH = 1080;
    const result = scaleFromMarker({
      corners: quad(2, 200, 700), // A4 quad in bottom portion (y=700..1294 — clipped logically, but ok for synth)
      imageWidthPx: 1920, imageHeightPx: imgH,
    });
    // Quad top is at y = 700. Bbox should end at < 700.
    expect(result.silhouette_bbox_px.y + result.silhouette_bbox_px.height).toBeLessThanOrEqual(700);
  });
});
