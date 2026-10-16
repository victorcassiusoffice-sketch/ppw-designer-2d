/** Preserve perspective pixels per metre when an inspector changes the canvas height.
 * Camera position, target and user zoom remain untouched. Bounds avoid degenerate projections. */
export function servicesFovForResize(
  currentFovDegrees: number,
  previousHeight: number,
  nextHeight: number,
): number {
  const clamp = (value: number) => Math.max(5, Math.min(120, value));
  const current = clamp(Number.isFinite(currentFovDegrees) ? currentFovDegrees : 42);
  if (
    !Number.isFinite(previousHeight) ||
    previousHeight <= 0 ||
    !Number.isFinite(nextHeight) ||
    nextHeight <= 0
  )
    return current;
  return clamp(
    (Math.atan(Math.tan((current * Math.PI) / 360) * (nextHeight / previousHeight)) * 360) /
      Math.PI,
  );
}
