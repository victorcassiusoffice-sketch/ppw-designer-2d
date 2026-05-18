/**
 * Sims-Parity DT-28 — Konva sunset / default-engine flip surface (L2.14).
 *
 * The MASTER-BUILD-PLAN.md §2 DT-28 spec says "default engine flips
 * to Babylon" after the 2-week soak (DT-27) green-lights. That soak
 * just started; flipping today is premature.
 *
 * This module is the code-side flip point. Today
 *   `getDefaultEngine()` returns 'konva'.
 * When Vic signs off on Sentry soak data:
 *   change the const below to 'babylon' and re-deploy. One-liner.
 *
 * The flip cascades through `engineFlag.ts isBabylonActive()` so
 * that visitors without an explicit ?engine= query get the new
 * default. ?engine=konva remains the manual rollback path even
 * after the flip (Konva render code stays in the bundle per the
 * "keep store + tests for rollback safety" clause of DT-28).
 */

export type EngineId = 'konva' | 'babylon';

/**
 * SOAK GATE: change this to 'babylon' AFTER the 14-day Sentry
 * green soak. Today (2026-05-19, soak day 0): 'konva'.
 */
export const DEFAULT_ENGINE: EngineId = 'konva';

export function getDefaultEngine(): EngineId {
  return DEFAULT_ENGINE;
}
