import type { Viewport } from './geometry';

// Distance from the outside wall to the dimension line, then to its outermost tick.
export const PLAN_DIMENSION_OFFSET_M = 0.5;
export const PLAN_DIMENSION_TICK_M = 0.1;

/** Fit world-pixel bounds inside the actual drawable canvas, including its gutters. */
export function fitPlanViewport(
  bounds: { minX: number; minY: number; maxX: number; maxY: number },
  availableWidth: number,
  availableHeight: number,
  dimensionMin?: { x: number; y: number },
): Viewport | null {
  const width = bounds.maxX - bounds.minX;
  const height = bounds.maxY - bounds.minY;
  if (![availableWidth, availableHeight, width, height].every(value => Number.isFinite(value) && value > 0)
    || ![bounds.minX, bounds.minY].every(Number.isFinite)) return null;
  const paddingX = Math.min(40, availableWidth * 0.15);
  const paddingY = Math.min(40, availableHeight * 0.15);
  // A whole building on a phone can legitimately need less than 30% zoom.
  // Fit must honor available pixels, rather than the manual zoom preference.
  const minX = Math.min(bounds.minX, dimensionMin?.x ?? bounds.minX);
  const minY = Math.min(bounds.minY, dimensionMin?.y ?? bounds.minY);
  // Dimension ticks can extend farther than the centred footprint gutter.
  // Use the opposite gutter to keep the existing zoom whenever the ink fits.
  const edge = Math.min(8, paddingX, paddingY);
  const scale = Math.min(
    1,
    (availableWidth - 2 * paddingX) / width,
    (availableHeight - 2 * paddingY) / height,
    (availableWidth - 2 * edge) / (bounds.maxX - minX),
    (availableHeight - 2 * edge) / (bounds.maxY - minY),
  );
  return {
    scale,
    x: Math.max((availableWidth - width * scale) / 2 - bounds.minX * scale, edge - minX * scale),
    y: Math.max((availableHeight - height * scale) / 2 - bounds.minY * scale, edge - minY * scale),
  };
}
