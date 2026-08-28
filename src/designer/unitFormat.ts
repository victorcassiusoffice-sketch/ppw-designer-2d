/**
 * unitFormat — one shared length formatter, driven by the active snap unit
 * (units brief 2026-08-28, D8).
 *
 * Before this, four call sites each hardcoded `${m.toFixed(2)} m`. That is
 * correct at 0.5 m and 0.25 m and useless at the extremes: a 3 cm segment
 * renders "0.03 m" at the 1 cm unit, and a 40 m wall renders "40.00 m" at
 * the 10 m unit. The precision shown should follow the precision the user
 * is working at.
 *
 * `wallGeometry.ts` `formatWallLengthM` is the existing adaptive formatter
 * this mirrors.
 */

/**
 * Format a world length for display at the given snap step.
 *
 * - Fine units (<= 10 cm) below a metre render in whole centimetres.
 * - Coarse units (>= 1 m) render to one decimal.
 * - Everything else renders to two decimals, which is byte-identical to
 *   the previous hardcoded output at both 0.5 m and 0.25 m.
 *
 * Centimetre output is deliberately capped at values under 1 m so the
 * longest string is "99 cm" (5 characters). The measurement plate sizes
 * itself with `halfWidth = fontSize * 2.5`, documented in blueprintTheme as
 * fitting "12.34 m"; an uncapped "1234 cm" would overflow it.
 */
export function formatLengthForUnit(lengthM: number, stepM: number): string {
  if (stepM <= 0.1 && lengthM < 1) return `${Math.round(lengthM * 100)} cm`;
  if (stepM >= 1) return `${lengthM.toFixed(1)} m`;
  return `${lengthM.toFixed(2)} m`;
}

/**
 * Visibility floor for a measurement chip at the given step.
 *
 * The old hardcoded `> 0.05` hid any segment under 5 cm, which at the 1 cm
 * unit hides the very lengths the unit exists to draw.
 */
export function chipVisibleAt(lengthM: number, stepM: number): boolean {
  return lengthM > stepM / 2;
}
