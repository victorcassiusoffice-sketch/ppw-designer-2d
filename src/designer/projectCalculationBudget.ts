/** Browser calculation limits, not engineering or planning limits.
 * Refuse an expensive/incomplete summary without trimming the user's model.
 * Exact unions can have quadratic intersections and a much larger sweep. */
import type { Property } from '../store/propertyStore.js';
import type { Vertex } from '../lib/geometry.js';
import { isOutdoorRoom, isRoofRoom, levelsOf, roofSourceLevelId, roomLevelId } from './levels.js';
import {
  normaliseFoundation,
  foundationElementBounds,
  foundationExcavationBounds,
} from './foundation.js';
import { normaliseCity } from './city.js';
import { normaliseBuildingServices } from './buildingServices.js';

export const PROJECT_CALCULATION_LIMITS = {
  rooms: 300,
  levels: 100,
  vertices: 2000,
  freeWalls: 1000,
  objects: 10000,
  openings: 2000,
  servicePoints: 20000,
  serviceRuns: 2000,
  serviceFixtures: 2000,
  coordinateM: 10000,
  estimatedWorkUnits: 2_000_000,
} as const;
export interface ProjectCalculationBudget {
  ok: boolean;
  reason: string | null;
  counts: {
    rooms: number;
    vertices: number;
    freeWalls: number;
    servicePoints: number;
    estimatedWorkUnits: number;
  };
}
const record = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);
const finite = (v: unknown, max = PROJECT_CALCULATION_LIMITS.coordinateM): v is number =>
  typeof v === 'number' && Number.isFinite(v) && Math.abs(v) <= max;
const point = (v: unknown): v is Vertex => record(v) && finite(v.x) && finite(v.y);

/** Cheap validated preflight for metrics AND review, before any material/union work.
 * The work estimate covers their combined floor/base/roof unions. The caller
 * must surface reason as unavailable/incomplete, never as a zero quantity. */
export function assessProjectCalculationBudget(property: Property): ProjectCalculationBudget {
  const counts = { rooms: 0, vertices: 0, freeWalls: 0, servicePoints: 0, estimatedWorkUnits: 0 };
  const fail = (reason: string): ProjectCalculationBudget => ({ ok: false, reason, counts });
  const spend = (units: number) => {
    counts.estimatedWorkUnits += units;
    return counts.estimatedWorkUnits <= PROJECT_CALCULATION_LIMITS.estimatedWorkUnits;
  };
  if (!record(property) || !Array.isArray(property.rooms))
    return fail('The project room list is invalid.');
  counts.rooms = property.rooms.length;
  if (counts.rooms > PROJECT_CALCULATION_LIMITS.rooms)
    return fail(
      'The project exceeds the browser summary room limit. Review smaller coordinated sections.',
    );
  if (
    property.levels !== undefined &&
    (!Array.isArray(property.levels) ||
      property.levels.length > PROJECT_CALCULATION_LIMITS.levels ||
      property.levels.some(
        (l) =>
          !record(l) ||
          typeof l.id !== 'string' ||
          !finite(l.index) ||
          (l.heightM !== undefined && !finite(l.heightM)) ||
          (l.elevationM !== undefined && !finite(l.elevationM)),
      ))
  )
    return fail('The project floor list is invalid or exceeds the browser summary limit.');
  let objects = 0,
    openings = 0;
  const floors = new Map<string, Vertex[][]>();
  for (const room of property.rooms) {
    if (!record(room) || !Array.isArray(room.polygon) || !Array.isArray(room.placedItems))
      return fail('A room is missing its measured polygon or object list.');
    counts.vertices += room.polygon.length;
    objects += room.placedItems.length;
    if (
      counts.vertices > PROJECT_CALCULATION_LIMITS.vertices ||
      objects > PROJECT_CALCULATION_LIMITS.objects
    )
      return fail(
        'The project exceeds the browser summary geometry/object limit. Review smaller coordinated sections.',
      );
    if (!room.polygon.every(point))
      return fail('Room coordinates must be finite metres within the supported editor range.');
    if (
      room.openings !== undefined &&
      (!Array.isArray(room.openings) || room.openings.some((o) => !record(o)))
    )
      return fail('A room opening list is invalid.');
    openings += room.openings?.length ?? 0;
    if (openings > PROJECT_CALCULATION_LIMITS.openings)
      return fail('The project opening count exceeds the browser summary limit.');
    if (room.polygon.length >= 3 && !isOutdoorRoom(room) && !isRoofRoom(room)) {
      const level = roomLevelId(room);
      const polygons = floors.get(level) ?? [];
      polygons.push(room.polygon);
      floors.set(level, polygons);
    }
  }
  if (
    property.walls !== undefined &&
    (!Array.isArray(property.walls) || property.walls.length > PROJECT_CALCULATION_LIMITS.freeWalls)
  )
    return fail('The free-wall list exceeds the browser summary limit.');
  counts.freeWalls = property.walls?.length ?? 0;
  if (property.walls?.some((w) => !record(w) || !point(w.a) || !point(w.b)))
    return fail('Free-wall coordinates must be finite supported metres.');
  const wallEdges = counts.vertices + counts.freeWalls;
  // Collinear wall grouping and opening/span partitioning are also bounded.
  if (!spend(2 * (wallEdges * wallEdges + openings * (wallEdges + openings))))
    return fail(
      'Wall/opening calculation exceeds the browser work budget. Review smaller coordinated sections.',
    );

  if (property.services !== undefined) {
    const s = property.services;
    if (
      !record(s) ||
      !Array.isArray(s.runs) ||
      !Array.isArray(s.fixtures) ||
      s.runs.length > PROJECT_CALCULATION_LIMITS.serviceRuns ||
      s.fixtures.length > PROJECT_CALCULATION_LIMITS.serviceFixtures
    )
      return fail('The service model is invalid or exceeds the browser summary limit.');
    for (const run of s.runs) {
      if (!record(run) || !Array.isArray(run.points)) return fail('A service route is invalid.');
      counts.servicePoints += run.points.length;
      if (counts.servicePoints > PROJECT_CALCULATION_LIMITS.servicePoints)
        return fail(
          'Service routes exceed the browser summary point limit. Review smaller coordinated sections.',
        );
    }
    const clean = normaliseBuildingServices(s);
    if (
      !clean ||
      clean.runs.length !== s.runs.length ||
      clean.fixtures.length !== s.fixtures.length
    )
      return fail('A service route or fixture has invalid measured inputs.');
    if (!spend(s.runs.length * s.fixtures.length + counts.servicePoints))
      return fail('Service connection review exceeds the browser work budget.');
  }
  if (property.city !== undefined && !normaliseCity(property.city))
    return fail('The City model has invalid or excessive measured inputs.');
  if (property.foundation !== undefined) {
    const model = normaliseFoundation(property.foundation);
    if (!model) return fail('Foundation dimensions or reinforcement inputs are invalid.');
    if (model.enabled) {
      const boxes = model.elements.flatMap((e) =>
        [foundationElementBounds(e), foundationExcavationBounds(e)].filter((b) => b !== null),
      );
      const xs = new Set<number>(),
        zs = new Set<number>();
      for (const box of boxes) {
        xs.add(box.minX);
        xs.add(box.maxX);
        zs.add(box.minElevationM);
        zs.add(box.maxElevationM);
      }
      const work =
        3 *
        Math.max(0, xs.size - 1) *
        Math.max(0, zs.size - 1) *
        boxes.length *
        (2 + Math.ceil(Math.log2(boxes.length + 1)));
      if (!spend(work))
        return fail(
          'Foundation union calculation exceeds the browser work budget. Review smaller coordinated sections.',
        );
    }
  }

  const top = roofSourceLevelId(levelsOf(property), property.rooms);
  for (const [level, polygons] of floors) {
    const edges = polygons.flatMap((polygon, owner) =>
      polygon.map((a, index) => ({
        a,
        b: polygon[(index + 1) % polygon.length],
        owner,
        index,
        size: polygon.length,
      })),
    );
    const multiplier = 1 + (level === 'ground' ? 2 : 0) + (level === top ? 2 : 0);
    const breaks = new Set(edges.map((e) => e.a.x));
    const pairWork = (edges.length * (edges.length - 1)) / 2;
    // Every strip traverses all edges and sorts crossings/merged intervals.
    const stripWork = edges.length * (2 + Math.ceil(Math.log2(edges.length + 1)));
    if (
      counts.estimatedWorkUnits +
        multiplier * (pairWork + Math.max(0, breaks.size - 1) * stripWork) >
      PROJECT_CALCULATION_LIMITS.estimatedWorkUnits
    )
      return fail(
        'Polygon union calculation exceeds the browser work budget. Review smaller coordinated sections.',
      );
    for (let i = 0; i < edges.length; i++)
      for (let j = i + 1; j < edges.length; j++) {
        const e = edges[i],
          f = edges[j],
          { a, b } = e,
          c = f.a,
          d = f.b;
        const ux = b.x - a.x,
          uy = b.y - a.y,
          vx = d.x - c.x,
          vy = d.y - c.y;
        const cross = ux * vy - uy * vx;
        if (Math.abs(cross) < 1e-7) continue;
        const t = ((c.x - a.x) * vy - (c.y - a.y) * vx) / cross;
        const s = ((c.x - a.x) * uy - (c.y - a.y) * ux) / cross;
        if (t <= 0 || t >= 1 || s <= 0 || s >= 1) continue;
        if (
          e.owner === f.owner &&
          Math.abs(e.index - f.index) !== 1 &&
          Math.abs(e.index - f.index) !== e.size - 1
        )
          return fail(
            'A room polygon crosses itself. Correct its boundary before requesting quantities.',
          );
        breaks.add(a.x + t * ux);
        if (
          counts.estimatedWorkUnits + multiplier * (pairWork + (breaks.size - 1) * stripWork) >
          PROJECT_CALCULATION_LIMITS.estimatedWorkUnits
        )
          return fail(
            'Intersecting polygons exceed the browser sweep budget. Review smaller coordinated sections.',
          );
      }
    spend(multiplier * (pairWork + Math.max(0, breaks.size - 1) * stripWork));
  }
  return { ok: true, reason: null, counts };
}
