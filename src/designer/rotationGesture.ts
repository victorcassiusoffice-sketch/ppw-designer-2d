/** Shared input math only. Product dimensions and placement validation stay in
 * the existing placement engine. Screen angles grow clockwise. */
export const ROTATION_SNAP_DEG = 45;
export const ROTATION_FINE_DEG = 1;
export interface RotationPoint { x: number; y: number }
export function normaliseRotation(angle: number): number {
  return Number.isFinite(angle) ? ((angle % 360) + 360) % 360 : 0;
}
export function rotationDetent(angle: number, free = false): number {
  const step = free ? ROTATION_FINE_DEG : ROTATION_SNAP_DEG;
  return normaliseRotation(Math.round(angle / step) * step);
}
export function pointerAngle(point: RotationPoint, centre: RotationPoint): number {
  return Math.atan2(point.y - centre.y, point.x - centre.x) * 180 / Math.PI;
}
/** Shortest signed change avoids a jump when crossing the ±180° seam. */
export function rotationDelta(start: number, current: number): number {
  return ((current - start + 540) % 360) - 180;
}
export function gestureRotation(startRotation: number, startAngle: number, currentAngle: number, free = false): number {
  return rotationDetent(startRotation + rotationDelta(startAngle, currentAngle), free);
}
