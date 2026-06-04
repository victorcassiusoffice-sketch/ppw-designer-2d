/**
 * P3-2 — paint/flooring estimate feature flag.
 *
 * The paint calculator engine (`src/lib/paintCalculator.ts`) + the
 * `/api/calc/paint` endpoint are live, but the customer-facing UI is
 * "pending product decision" (audit P3-2). The PaintEstimatePanel is
 * therefore OFF by default and only renders when `?paint=1` is on the URL,
 * so Vic can evaluate it on a real device before it goes default-on for
 * customers. Mirrors the `?ui=classic` / `?engine=*` opt-in pattern.
 */
export const PAINT_ESTIMATE_QUERY_KEY = 'paint';
export const PAINT_ESTIMATE_QUERY_VALUE = '1';

export function isPaintEstimateActive(search: string = typeof window !== 'undefined' ? window.location.search : ''): boolean {
  try {
    const params = new URLSearchParams(search);
    return params.get(PAINT_ESTIMATE_QUERY_KEY) === PAINT_ESTIMATE_QUERY_VALUE;
  } catch {
    return false;
  }
}
