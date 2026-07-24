/**
 * Pure wall-render geometry — no React / Konva imports, so it is unit-testable
 * in the node vitest env. Shared by WallDrawMode's live draw layer and the
 * persistent CommittedWallsLayer (2026-07-24 "walls vanish on exit" fix).
 */
import type { WallSegment } from '../store/wallStore';

/** Wall endpoints (mm) → Konva Line points (px) at pxPerMetre. */
export function wallLinePoints(w: WallSegment, pxPerMetre: number): number[] {
  return [
    (w.start.x_mm / 1000) * pxPerMetre,
    (w.start.y_mm / 1000) * pxPerMetre,
    (w.end.x_mm / 1000) * pxPerMetre,
    (w.end.y_mm / 1000) * pxPerMetre,
  ];
}

/** Wall thickness (mm) → Konva stroke width (px), floored at 3px. */
export function wallStrokeWidthPx(w: WallSegment, pxPerMetre: number): number {
  return Math.max(3, (w.thickness_mm / 1000) * pxPerMetre);
}
