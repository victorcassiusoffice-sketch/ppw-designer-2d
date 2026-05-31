/**
 * zoom — pure wheel/pinch zoom-scale math, extracted from RoomCanvas so the
 * M5 wheel-zoom fix (Customer-UI 2026-05-31) is unit-testable without a Konva
 * stage. Side-effect-free.
 */

export const ZOOM_MIN_SCALE = 0.3;
export const ZOOM_MAX_SCALE = 3;
export const ZOOM_WHEEL_FACTOR = 1.08;

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
