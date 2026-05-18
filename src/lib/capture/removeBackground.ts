/**
 * Sims-Parity DT-08 — v1 background removal.
 *
 * Rough A4-rect mask: pixels INSIDE the user-tapped A4 quad are alpha=0
 * (the printed reference page is erased from the saved photo); pixels
 * OUTSIDE the quad — where the actual product sits beside the page —
 * stay opaque. This is intentionally "good-enough" per the master plan;
 * v2 (DT-20) auto-pose + later integration of `@imgly/background-removal`
 * will produce a true alphaClean=true photo.
 *
 * The packet emitted from this DT carries `alphaClean: false` because
 * the photo still contains the floor / surface behind the product —
 * only the printed reference is gone.
 *
 * Pure-fn for testability: accepts ImageData + four corner points,
 * returns a new ImageData with alpha cleared on the A4-quad interior.
 */

import type { CornerPoint } from './scaleFromMarker';

/**
 * Convex quad even-odd inside-test (4 vertices in TL→TR→BR→BL order
 * produce a convex polygon for typical taps).
 */
function pointInQuad(
  x: number, y: number,
  q: [CornerPoint, CornerPoint, CornerPoint, CornerPoint],
): boolean {
  let inside = false;
  for (let i = 0, j = 3; i < 4; j = i++) {
    const xi = q[i].xPx;
    const yi = q[i].yPx;
    const xj = q[j].xPx;
    const yj = q[j].yPx;
    const intersect = ((yi > y) !== (yj > y))
      && x < ((xj - xi) * (y - yi)) / (yj - yi + 1e-12) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/**
 * Build a new ImageData with the A4 quad interior masked to alpha=0.
 * The source ImageData is not mutated.
 */
export function removeBackground(
  source: ImageData,
  quad: [CornerPoint, CornerPoint, CornerPoint, CornerPoint],
): ImageData {
  const { width, height, data } = source;
  const out = new Uint8ClampedArray(data); // copy
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (pointInQuad(x + 0.5, y + 0.5, quad)) {
        const p = (y * width + x) * 4;
        out[p + 3] = 0; // alpha
      }
    }
  }
  return { width, height, data: out, colorSpace: source.colorSpace } as ImageData;
}

/**
 * Convenience: returns true if the four points are a non-degenerate
 * quad (no two within 4 px). Used by the UI to enable submit.
 */
export function quadIsValid(quad: [CornerPoint, CornerPoint, CornerPoint, CornerPoint]): boolean {
  for (let i = 0; i < 4; i++) {
    for (let j = i + 1; j < 4; j++) {
      const dx = quad[i].xPx - quad[j].xPx;
      const dy = quad[i].yPx - quad[j].yPx;
      if (dx * dx + dy * dy < 16) return false; // < 4 px apart
    }
  }
  return true;
}
