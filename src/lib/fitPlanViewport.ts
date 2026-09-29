import type { Viewport } from './geometry';

/** Fit world-pixel bounds inside the actual drawable canvas, including its gutters. */
export function fitPlanViewport(
  bounds: { minX: number; minY: number; maxX: number; maxY: number },
  availableWidth: number,
  availableHeight: number,
): Viewport | null {
  const width = bounds.maxX - bounds.minX;
  const height = bounds.maxY - bounds.minY;
  if (![availableWidth, availableHeight, width, height].every(value => Number.isFinite(value) && value > 0)
    || ![bounds.minX, bounds.minY].every(Number.isFinite)) return null;
  const paddingX = Math.min(40, availableWidth * 0.15);
  const paddingY = Math.min(40, availableHeight * 0.15);
  // A whole building on a phone can legitimately need less than 30% zoom.
  // Fit must honor available pixels, rather than the manual zoom preference.
  const scale = Math.min(1, (availableWidth - 2 * paddingX) / width, (availableHeight - 2 * paddingY) / height);
  return {
    scale,
    x: (availableWidth - width * scale) / 2 - bounds.minX * scale,
    y: (availableHeight - height * scale) / 2 - bounds.minY * scale,
  };
}
