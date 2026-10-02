/**
 * zoom — pure wheel/pinch zoom-scale math, extracted from RoomCanvas so the
 * M5 wheel-zoom fix (Customer-UI 2026-05-31) is unit-testable without a Konva
 * stage. Side-effect-free.
 */

// Leave enough room around a whole plot to draw gardens and extensions.
export const ZOOM_MIN_SCALE = 0.04;
export const ZOOM_MAX_SCALE = 3;
export const ZOOM_WHEEL_FACTOR = 1.08;

export interface ZoomViewport { x: number; y: number; scale: number }
export interface TouchPoint { x: number; y: number }
export interface PlanPinch { viewport: ZoomViewport; midpoint: TouchPoint; distance: number }

/** Zoom buttons and keyboard keep the same world point beneath their anchor. */
export function zoomViewportAt(viewport: ZoomViewport, factor: number, anchor: TouchPoint, min = ZOOM_MIN_SCALE, max = ZOOM_MAX_SCALE): ZoomViewport {
  if (!Number.isFinite(factor) || factor <= 0 || viewport.scale <= 0) return viewport;
  const scale = Math.max(Math.min(viewport.scale, min), Math.min(max, viewport.scale * factor));
  const ratio = scale / viewport.scale;
  return { scale, x: anchor.x - (anchor.x - viewport.x) * ratio, y: anchor.y - (anchor.y - viewport.y) * ratio };
}

/** The initial world point under two fingers stays beneath their midpoint. */
export function pinchPlanViewport(start: PlanPinch, midpoint: TouchPoint, distance: number, min = ZOOM_MIN_SCALE, max = ZOOM_MAX_SCALE): ZoomViewport {
  if (start.distance < 2 || distance < 2 || !Number.isFinite(distance)) return start.viewport;
  const zoomed = zoomViewportAt(start.viewport, distance / start.distance, start.midpoint, min, max);
  return { ...zoomed, x: zoomed.x + midpoint.x - start.midpoint.x, y: zoomed.y + midpoint.y - start.midpoint.y };
}

/**
 * Compute the next viewport scale for a wheel event.
 *   deltaY < 0  → wheel up   → zoom in  (scale × factor)
 *   deltaY > 0  → wheel down → zoom out (scale ÷ factor)
 * Result clamped to [min, max].
 */
export function computeZoomScale(
  oldScale: number,
  deltaY: number,
  min: number = ZOOM_MIN_SCALE,
  max: number = ZOOM_MAX_SCALE,
  factor: number = ZOOM_WHEEL_FACTOR,
): number {
  const direction = deltaY > 0 ? -1 : 1;
  const next = direction > 0 ? oldScale * factor : oldScale / factor;
  return Math.max(min, Math.min(max, next));
}
