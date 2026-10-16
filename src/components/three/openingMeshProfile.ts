import type { Vertex } from '../../lib/geometry';
import type { WallOpeningSolid } from '../../designer/roomSolids';

/** Clip the canonical cut profile to a cutaway wall; no rectangular infill
 * across arched or circular openings when a wall is lowered. */
export function visibleOpeningProfile(opening: WallOpeningSolid, heightM: number): Vertex[] {
  const points = opening.profile ?? [
    { x: opening.t0M, y: opening.bottomM }, { x: opening.t1M, y: opening.bottomM },
    { x: opening.t1M, y: opening.topM }, { x: opening.t0M, y: opening.topM },
  ];
  const result: Vertex[] = [];
  for (let i = 0; i < points.length; i++) {
    const a = points[i], b = points[(i + 1) % points.length];
    if (a.y <= heightM) result.push(a);
    if ((a.y <= heightM) !== (b.y <= heightM)) {
      const t = (heightM - a.y) / (b.y - a.y);
      result.push({ x: a.x + (b.x - a.x) * t, y: heightM });
    }
  }
  return result;
}
