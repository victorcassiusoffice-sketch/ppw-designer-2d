/**
 * Sims-Parity DT-20 — silhouette bbox estimation from a marker-anchored capture.
 *
 * Pure-fn: given an ImageData + the 4-corner pose returned by
 * `detectMarker.ts`, derive a precise product silhouette bbox by
 * connected-component scanning the dark pixels OUTSIDE the marker
 * quad. v2 path produces this bbox for DT-11 GL1.01b crop.
 *
 * Heuristic: pixels with luminance below `darknessThreshold` AND
 * outside the marker quad's bounding rect form the candidate
 * silhouette. The largest axis-aligned bbox of those candidates is
 * returned. This is intentionally rough — DT-29 WebXR will replace
 * with depth-anchored silhouette.
 */

import type { CornerPoint } from './scaleFromMarker';
import type { SilhouetteBboxPx } from './types';

export interface SilhouetteEstimateInput {
  image: ImageData;
  markerCorners: [CornerPoint, CornerPoint, CornerPoint, CornerPoint];
  darknessThreshold?: number; // Rec.601 luma, default 140
  /** Sample every N px for speed; default 4 px. */
  step?: number;
}

function isInsideQuadBbox(
  x: number, y: number,
  corners: [CornerPoint, CornerPoint, CornerPoint, CornerPoint],
): boolean {
  const minX = Math.min(corners[0].xPx, corners[1].xPx, corners[2].xPx, corners[3].xPx);
  const maxX = Math.max(corners[0].xPx, corners[1].xPx, corners[2].xPx, corners[3].xPx);
  const minY = Math.min(corners[0].yPx, corners[1].yPx, corners[2].yPx, corners[3].yPx);
  const maxY = Math.max(corners[0].yPx, corners[1].yPx, corners[2].yPx, corners[3].yPx);
  return x >= minX && x <= maxX && y >= minY && y <= maxY;
}

export function estimateSilhouetteBbox(input: SilhouetteEstimateInput): SilhouetteBboxPx | null {
  const { image, markerCorners } = input;
  const threshold = input.darknessThreshold ?? 140;
  const step = Math.max(1, input.step ?? 4);
  const { width, height, data } = image;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -1;
  let maxY = -1;
  let hits = 0;

  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      if (isInsideQuadBbox(x, y, markerCorners)) continue;
      const p = (y * width + x) * 4;
      const lum = 0.299 * data[p] + 0.587 * data[p + 1] + 0.114 * data[p + 2];
      if (lum < threshold) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
        hits++;
      }
    }
  }

  if (hits === 0) return null;
  return {
    x: Math.max(0, Math.floor(minX)),
    y: Math.max(0, Math.floor(minY)),
    width: Math.max(1, Math.ceil(maxX - minX)),
    height: Math.max(1, Math.ceil(maxY - minY)),
  };
}
