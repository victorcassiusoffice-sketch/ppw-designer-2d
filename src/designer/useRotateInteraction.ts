/**
 * Sims-Parity DT-16 — rotation interaction helpers (GL1.11).
 *
 * Pure helpers:
 *   • cycleRotation(deg, dirCW) — 0/90/180/270° cycle.
 *   • nudgeRotation(deg, dirCW, freeFloat) — R key step (15° CW;
 *     Shift+R 15° CCW; freeFloat skips snap).
 *   • snapRotationDeg(deg, freeFloat) — round to nearest 15°.
 *
 * Engine-agnostic — Konva Layer 1 and Babylon Layer 2 share these.
 */

export const ROTATION_STEP_DEG = 15;

/** Cycle through 4 cardinal angles. */
export function cycleRotation(currentDeg: number, dirCW: boolean): number {
  const normalised = ((Math.round(currentDeg / 90) * 90) % 360 + 360) % 360;
  const delta = dirCW ? 90 : -90;
  return (((normalised + delta) % 360) + 360) % 360;
}

/** R key / Shift+R key — 15° step. */
export function nudgeRotation(currentDeg: number, dirCW: boolean, freeFloat: boolean = false): number {
  const step = ROTATION_STEP_DEG;
  const delta = dirCW ? step : -step;
  const next = currentDeg + delta;
  if (freeFloat) return mod360(next);
  return snapRotationDeg(next, false);
}

/** Round to nearest 15° unless freeFloat. */
export function snapRotationDeg(deg: number, freeFloat: boolean): number {
  if (freeFloat) return mod360(deg);
  return mod360(Math.round(deg / ROTATION_STEP_DEG) * ROTATION_STEP_DEG);
}

function mod360(d: number): number {
  return ((d % 360) + 360) % 360;
}
