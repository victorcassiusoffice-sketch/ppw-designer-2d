/**
 * Sims-Parity DT-06 — corner-tap homography + pixelsPerMm derivation.
 *
 * Given 4 image-space points that the merchant tapped on the corners
 * of the printed A4 reference page (DT-02 PDF), compute:
 *
 *   • pixelsPerMm        — scalar conversion factor
 *   • homography         — 3×3 matrix mapping (xMm, yMm) → (xPx, yPx)
 *   • rmsCalibrationError — pixel residual of the four-corner fit
 *   • silhouette_bbox_px  — rough product bbox derived from the
 *                           captured image edges (v1: image-extent
 *                           minus the A4 quad's bounding rect).
 *
 * Approach: 4 corners of a known-size rectangle (210 × 297 mm) yield
 * an exactly-determined homography via the standard direct linear
 * transform (DLT), 8 equations in 8 unknowns (h33 fixed at 1).
 * pixelsPerMm is averaged over the four edge measurements; rmsError
 * is the RMS deviation between each tapped corner and the corner
 * that the recovered homography projects from the mm-plane.
 *
 * Bbox extraction is a v1 rough heuristic: the captured image
 * dimensions minus the axis-aligned bounding rectangle of the
 * four-corner quad, with a 5% margin trimmed. Replaced by precise
 * silhouette detection in the DT-20 v2 auto-pose path.
 */

import type { SilhouetteBboxPx } from './types';

export interface CornerPoint {
  xPx: number;
  yPx: number;
}

export interface ScaleFromMarkerInput {
  /** Image-space corners tapped by the merchant. Order: TL, TR, BR, BL. */
  corners: [CornerPoint, CornerPoint, CornerPoint, CornerPoint];
  /** Full captured image dimensions in px. */
  imageWidthPx: number;
  imageHeightPx: number;
  /** Reference page size in mm. Defaults to A4 portrait (210 × 297). */
  referenceWidthMm?: number;
  referenceHeightMm?: number;
}

export interface ScaleFromMarkerOutput {
  pixelsPerMm: number;
  /** Row-major 3×3 matrix: [h11 h12 h13 h21 h22 h23 h31 h32 h33]. */
  homography: [number, number, number, number, number, number, number, number, number];
  rmsCalibrationError: number;
  silhouette_bbox_px: SilhouetteBboxPx;
}

/**
 * Compute the homography 3×3 mapping (xMm, yMm) ↔ (xPx, yPx) for the
 * four corners of the A4 page.
 *
 * The DLT formulation: for each correspondence (x, y) ↔ (u, v),
 *   u = (h11·x + h12·y + h13) / (h31·x + h32·y + 1)
 *   v = (h21·x + h22·y + h23) / (h31·x + h32·y + 1)
 * Rearranging produces 2 linear equations in 8 unknowns. Four
 * correspondences → 8 equations → unique solution.
 */
function computeHomography(
  mmCorners: [CornerPoint, CornerPoint, CornerPoint, CornerPoint],
  pxCorners: [CornerPoint, CornerPoint, CornerPoint, CornerPoint],
): [number, number, number, number, number, number, number, number, number] {
  // Build the 8×8 matrix A and 8-vector b such that A·h = b, h = [h11..h32].
  const A: number[][] = [];
  const b: number[] = [];
  for (let i = 0; i < 4; i++) {
    const { xPx: x, yPx: y } = mmCorners[i];
    const { xPx: u, yPx: v } = pxCorners[i];
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]);
    b.push(u);
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y]);
    b.push(v);
  }
  const h = solveLinearSystem(A, b);
  return [h[0], h[1], h[2], h[3], h[4], h[5], h[6], h[7], 1];
}

/**
 * Solve A·x = b for an 8×8 system via Gaussian elimination with
 * partial pivoting. Throws on singular input — should only happen
 * when corners are collinear, which the UI guards against.
 */
function solveLinearSystem(A: number[][], b: number[]): number[] {
  const n = A.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let k = 0; k < n; k++) {
    let maxRow = k;
    let maxVal = Math.abs(M[k][k]);
    for (let r = k + 1; r < n; r++) {
      if (Math.abs(M[r][k]) > maxVal) {
        maxRow = r;
        maxVal = Math.abs(M[r][k]);
      }
    }
    if (maxVal < 1e-12) throw new Error('singular homography system (collinear corners?)');
    if (maxRow !== k) {
      const tmp = M[k];
      M[k] = M[maxRow];
      M[maxRow] = tmp;
    }
    for (let r = k + 1; r < n; r++) {
      const f = M[r][k] / M[k][k];
      for (let c = k; c <= n; c++) {
        M[r][c] -= f * M[k][c];
      }
    }
  }
  const x = new Array<number>(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    let s = M[i][n];
    for (let j = i + 1; j < n; j++) s -= M[i][j] * x[j];
    x[i] = s / M[i][i];
  }
  return x;
}

/**
 * Apply a 3×3 homography to a point.
 */
export function applyHomography(
  h: [number, number, number, number, number, number, number, number, number],
  x: number,
  y: number,
): { xPx: number; yPx: number } {
  const w = h[6] * x + h[7] * y + h[8];
  return {
    xPx: (h[0] * x + h[1] * y + h[2]) / w,
    yPx: (h[3] * x + h[4] * y + h[5]) / w,
  };
}

function distance(a: CornerPoint, b: CornerPoint): number {
  const dx = a.xPx - b.xPx;
  const dy = a.yPx - b.yPx;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Pure entry-point. Computes all four outputs.
 */
export function scaleFromMarker(input: ScaleFromMarkerInput): ScaleFromMarkerOutput {
  const refW = input.referenceWidthMm ?? 210;
  const refH = input.referenceHeightMm ?? 297;
  const [tl, tr, br, bl] = input.corners;

  // Edge-length-based pixelsPerMm average. Each edge sweeps a known
  // physical length (refW for top/bottom, refH for left/right).
  const topPx = distance(tl, tr);
  const rightPx = distance(tr, br);
  const bottomPx = distance(br, bl);
  const leftPx = distance(bl, tl);
  const ppmmTop = topPx / refW;
  const ppmmRight = rightPx / refH;
  const ppmmBottom = bottomPx / refW;
  const ppmmLeft = leftPx / refH;
  const pixelsPerMm = (ppmmTop + ppmmRight + ppmmBottom + ppmmLeft) / 4;

  // Solve the homography from mm-plane → image-plane.
  const mmCorners: [CornerPoint, CornerPoint, CornerPoint, CornerPoint] = [
    { xPx: 0, yPx: 0 },
    { xPx: refW, yPx: 0 },
    { xPx: refW, yPx: refH },
    { xPx: 0, yPx: refH },
  ];
  const homography = computeHomography(mmCorners, input.corners);

  // RMS pixel residual: project mm corners through H, compare to taps.
  let sse = 0;
  for (let i = 0; i < 4; i++) {
    const proj = applyHomography(homography, mmCorners[i].xPx, mmCorners[i].yPx);
    const dx = proj.xPx - input.corners[i].xPx;
    const dy = proj.yPx - input.corners[i].yPx;
    sse += dx * dx + dy * dy;
  }
  const rmsCalibrationError = Math.sqrt(sse / 4);

  // v1 rough bbox: axis-aligned bbox of the captured image area
  // OUTSIDE the A4 quad's bounding rectangle (where the product
  // lives in the merchant's framing). Trims a 5% margin so the
  // bbox doesn't include the image borders themselves.
  const quadMinX = Math.min(tl.xPx, tr.xPx, br.xPx, bl.xPx);
  const quadMinY = Math.min(tl.yPx, tr.yPx, br.yPx, bl.yPx);
  const quadMaxX = Math.max(tl.xPx, tr.xPx, br.xPx, bl.xPx);
  const quadMaxY = Math.max(tl.yPx, tr.yPx, br.yPx, bl.yPx);

  const marginX = Math.round(input.imageWidthPx * 0.05);
  const marginY = Math.round(input.imageHeightPx * 0.05);
  let bx = marginX;
  let by = marginY;
  let bw = input.imageWidthPx - marginX * 2;
  let bh = input.imageHeightPx - marginY * 2;

  // If the A4 quad is in the top half of the image, place the rough
  // product bbox below it; otherwise above. Same logic for left/right
  // when the quad is in an off-centre lateral position.
  const imgCx = input.imageWidthPx / 2;
  const imgCy = input.imageHeightPx / 2;
  const quadCx = (quadMinX + quadMaxX) / 2;
  const quadCy = (quadMinY + quadMaxY) / 2;

  if (quadCy < imgCy) {
    by = Math.round(quadMaxY + 8);
    bh = Math.max(1, input.imageHeightPx - by - marginY);
  } else {
    bh = Math.max(1, Math.round(quadMinY - 8 - marginY));
  }
  if (Math.abs(quadCx - imgCx) > input.imageWidthPx * 0.1) {
    // Quad is laterally biased — trim the bbox to the opposite half.
    if (quadCx < imgCx) {
      bx = Math.round(quadMaxX + 8);
      bw = Math.max(1, input.imageWidthPx - bx - marginX);
    } else {
      bw = Math.max(1, Math.round(quadMinX - 8 - marginX));
    }
  }

  const silhouette_bbox_px: SilhouetteBboxPx = {
    x: Math.max(0, bx),
    y: Math.max(0, by),
    width: Math.max(1, bw),
    height: Math.max(1, bh),
  };

  return { pixelsPerMm, homography, rmsCalibrationError, silhouette_bbox_px };
}
