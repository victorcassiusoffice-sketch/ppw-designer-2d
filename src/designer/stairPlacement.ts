/** Conservative plan checks for structural stair openings, including concave rooms. */
import { pointInPolygon, type Polygon, type Vertex } from '../lib/geometry';
import type { Property } from '../store/propertyStore';
import { normaliseBuildingStairs, stairFootprint, type BuildingStair } from './building';
import { isOutdoorRoom, roomLevelId } from './levels';
import { strictPolygonsOverlap } from './roomLayout';

const EPS = 1e-8;
/** Leaves the wall lining and the stair handrail independent of the slab opening. */
export const STAIR_WALL_CLEARANCE_M = 0.06;

function pointSegmentDistance(point: Vertex, a: Vertex, b: Vertex): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSq = dx * dx + dy * dy;
  const t = lengthSq < EPS ? 0 : Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSq));
  return Math.hypot(point.x - a.x - t * dx, point.y - a.y - t * dy);
}

function segmentDistance(a: Vertex, b: Vertex, c: Vertex, d: Vertex): number {
  const ax = b.x - a.x; const ay = b.y - a.y;
  const bx = d.x - c.x; const by = d.y - c.y;
  const determinant = ax * by - ay * bx;
  if (Math.abs(determinant) > EPS) {
    const cx = c.x - a.x; const cy = c.y - a.y;
    const t = (cx * by - cy * bx) / determinant;
    const u = (cx * ay - cy * ax) / determinant;
    if (t >= -EPS && t <= 1 + EPS && u >= -EPS && u <= 1 + EPS) return 0;
  }
  return Math.min(pointSegmentDistance(a, c, d), pointSegmentDistance(b, c, d), pointSegmentDistance(c, a, b), pointSegmentDistance(d, a, b));
}

/** Corners alone are insufficient: a rectangle can span the opening of a U-shaped room. */
export function stairFootprintInsideRoom(footprint: Polygon, room: Polygon, clearanceM = STAIR_WALL_CLEARANCE_M): boolean {
  if (footprint.length < 3 || room.length < 3 || !footprint.every((point) => pointInPolygon(point, room))) return false;
  const clearance = Math.max(EPS, clearanceM);
  for (let i = 0; i < footprint.length; i++) {
    const a = footprint[i];
    const b = footprint[(i + 1) % footprint.length];
    for (let j = 0; j < room.length; j++) {
      if (segmentDistance(a, b, room[j], room[(j + 1) % room.length]) < clearance - EPS / 2) return false;
    }
  }
  return true;
}

export type StairPlacementResult = { ok: true } | {
  ok: false;
  reason: 'invalid-stair' | 'outside-room' | 'overlapping-stairs';
  message: string;
};

/** Validate both landings and prevent intersecting flights/openings on any shared floor. */
export function validateStairPlacement(property: Property, stair: BuildingStair): StairPlacementResult {
  if (normaliseBuildingStairs([stair], property).length === 0) {
    return { ok: false, reason: 'invalid-stair', message: 'Choose an upward floor connection and valid stair dimensions.' };
  }
  const footprint = stairFootprint(stair);
  const levels = new Set([stair.fromLevelId, stair.toLevelId]);
  const fits = [...levels].every((levelId) => property.rooms.some((room) =>
    roomLevelId(room) === levelId && !isOutdoorRoom(room)
    && stairFootprintInsideRoom(footprint, room.polygon),
  ));
  if (!fits) return {
    ok: false, reason: 'outside-room',
    message: 'Fit the stairs inside a room on both floors, leaving at least 6 cm from the walls.',
  };
  const overlaps = (property.stairs ?? []).some((other) =>
    other.id !== stair.id && (levels.has(other.fromLevelId) || levels.has(other.toLevelId))
    && strictPolygonsOverlap(footprint, stairFootprint(other)),
  );
  if (overlaps) return { ok: false, reason: 'overlapping-stairs', message: 'Move these stairs clear of the existing flight and its floor opening.' };
  return { ok: true };
}

export function stairPlacementFits(property: Property, stair: BuildingStair): boolean {
  return validateStairPlacement(property, stair).ok;
}
