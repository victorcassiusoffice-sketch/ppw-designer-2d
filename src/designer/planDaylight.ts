import type { Vertex } from '../lib/geometry';
import { dayOfYear, sunAt } from './sunPosition';

/** Presentation only: world-metre shadow projection from the same sun used by
 * 3D. It never changes a wall, opening, product or a solar calculation. */
export interface PlanDaylight { offset: Vertex; strength: number; daylight: number }
export function planDaylight(hour: number | null, heightM: number, doy?: number): PlanDaylight {
  const height = Number.isFinite(heightM) && heightM > 0 ? heightM : 2.7;
  if (hour === null || !Number.isFinite(hour)) return { offset: { x: height * 0.45, y: height * 0.55 }, strength: 0.16, daylight: 1 };
  const today = new Date();
  const sun = sunAt(hour, doy ?? dayOfYear(today.getMonth() + 1, today.getDate()));
  if (sun.direction.z <= 0) return { offset: { x: 0, y: 0 }, strength: 0, daylight: sun.daylight };
  const x = -sun.direction.x * height / Math.max(0.15, sun.direction.z);
  const y = -sun.direction.y * height / Math.max(0.15, sun.direction.z);
  // Long sunset shadows are visually capped to keep a plan legible. Energy
  // and physical shadow algorithms use their unmodified solar positions.
  const gain = Math.min(1, 3 / Math.max(0.001, Math.hypot(x, y)));
  return { offset: { x: x * gain, y: y * gain }, strength: 0.16 * sun.daylight, daylight: sun.daylight };
}

export function planShadowPoints(a: Vertex, b: Vertex, offset: Vertex, pxPerMetre: number): number[] {
  return [a, b, { x: b.x + offset.x, y: b.y + offset.y }, { x: a.x + offset.x, y: a.y + offset.y }]
    .flatMap(point => [point.x * pxPerMetre, point.y * pxPerMetre]);
}
