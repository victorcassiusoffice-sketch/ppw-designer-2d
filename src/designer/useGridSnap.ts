/**
 * Sims-Parity DT-12 — pure 50 cm snap-to-grid (V-GAME-3).
 *
 * Engine-agnostic: same pure-fn is consumed by Konva Layer 1 (DT-12)
 * and Babylon Layer 2 (DT-23) per data-flow §8 P7.
 *
 * Snap step is in mm at 500 (= 50 cm). The renderer converts mm to
 * pixels through the room scale (pxPerMm) outside this fn.
 */

export const SNAP_STEP_MM = 500;

export interface SnapInput {
  xMm: number;
  yMm: number;
  /** True when Shift held — bypass snap (free-place). */
  freeFloat?: boolean;
  /** Override step for tests. */
  stepMm?: number;
}

export interface SnappedPosition {
  xMm: number;
  yMm: number;
  /** True when the snap shifted the position by ≥1 mm. */
  snapped: boolean;
}

export function snapToGrid(input: SnapInput): SnappedPosition {
  if (input.freeFloat) {
    return { xMm: input.xMm, yMm: input.yMm, snapped: false };
  }
  const step = input.stepMm ?? SNAP_STEP_MM;
  const sx = Math.round(input.xMm / step) * step;
  const sy = Math.round(input.yMm / step) * step;
  return {
    xMm: sx,
    yMm: sy,
    snapped: sx !== input.xMm || sy !== input.yMm,
  };
}
