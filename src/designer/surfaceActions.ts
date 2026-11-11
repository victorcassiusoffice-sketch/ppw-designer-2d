import { getProductById } from '../data/products';
import { isRectInsidePolygon, rotatedFootprint } from '../lib/geometry';
import { strictPolygonsOverlap } from './roomLayout';
import { validateStairPlacement } from './stairPlacement';
import { nanoid } from 'nanoid';
import { usePropertyStore, type Property } from '../store/propertyStore';
import { pointInPolygon, type Vertex } from '../lib/geometry';
import { isRoofRoom, roomLevelId, GROUND_LEVEL_ID, ROOF_LEVEL_ID } from './levels';
import { stairFootprint } from './building';
import { gardenElementAt } from './garden';
import { foundationElementBounds } from './foundation';
import { serviceRunPoints3D } from './buildingServices';
import { faceLoop } from './boundaryModel';
import { sampleMeasuredPath, measuredPathFromVertices, isSimpleMeasuredPath } from './measuredPath';
import {
  removeBuildTarget,
  pickPlanRemoveTarget,
  type RemoveBuildTarget,
} from './removeBuildTarget';
import { roomEdges } from './wallEdges';
import { syncRoofRooms } from './roof';
import { decodeFloorZones } from '../store/propertyStore';
export type SurfaceTarget =
  | RemoveBuildTarget
  | {
      kind:
        | 'stair'
        | 'run'
        | 'fixture'
        | 'garden'
        | 'earth'
        | 'foundation'
        | 'bore'
        | 'component'
        | 'roof'
        | 'room'
        | 'shade';
      id: string;
    };
const distance = (a: Vertex, b: Vertex) => Math.hypot(a.x - b.x, a.y - b.y);
function segmentDistance(p: Vertex, a: Vertex, b: Vertex) {
  const dx = b.x - a.x,
    dy = b.y - a.y,
    t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1)));
  return distance(p, { x: a.x + t * dx, y: a.y + t * dy });
}
export function surfaceTargets(
  p: Property,
  level: string,
  at: Vertex,
  tolerance: number,
  front?: RemoveBuildTarget | null,
): SurfaceTarget[] {
  const hits: SurfaceTarget[] = [];
  const native = front === undefined ? pickPlanRemoveTarget(p, level, at, tolerance) : front;
  if (native && native.kind !== 'floor') hits.push(native);
  for (const stair of p.stairs ?? [])
    if (
      [stair.fromLevelId, stair.toLevelId].includes(level) &&
      pointInPolygon(at, stairFootprint(stair))
    )
      hits.push({ kind: 'stair', id: stair.id });
  for (const part of p.boundaryComponents ?? [])
    if (
      part.faces.some((f) => pointInPolygon(at, faceLoop(part, f))) ||
      part.edges.some(
        ([a, b]) => segmentDistance(at, part.vertices[a], part.vertices[b]) <= tolerance,
      )
    )
      hits.push({ kind: 'component', id: part.id });
  for (const f of p.services?.fixtures ?? []) {
    if (f.levelId !== level) continue;
    const r = (f.rotation * Math.PI) / 180,
      x = at.x - f.x,
      y = at.y - f.y;
    if (
      Math.abs(x * Math.cos(r) + y * Math.sin(r)) <= f.widthM / 2 + tolerance &&
      Math.abs(-x * Math.sin(r) + y * Math.cos(r)) <= f.depthM / 2 + tolerance
    )
      hits.push({ kind: 'fixture', id: f.id });
  }
  for (const run of p.services?.runs ?? [])
    if (
      run.levelId === level &&
      run.points.some(
        (b, i) =>
          i > 0 && segmentDistance(at, run.points[i - 1], b) <= tolerance + run.diameterMm / 2000,
      )
    )
      hits.push({ kind: 'run', id: run.id });
  for (const room of p.rooms.filter(
    (r) => roomLevelId(r) === level && pointInPolygon(at, r.polygon),
  )) {
    if (isRoofRoom(room)) hits.push({ kind: 'roof', id: room.id });
    if (room.floorFinish || room.floorTiles?.length)
      hits.push({ kind: 'floor', roomId: room.id, point: at });
    if (!isRoofRoom(room) && room.kind !== 'outdoor') hits.push({ kind: 'room', id: room.id });
  }
  if (level === GROUND_LEVEL_ID) {
    for (const sail of p.shade?.sails ?? [])
      if (pointInPolygon(at, sail.anchors)) hits.push({ kind: 'shade', id: sail.id });
    const garden = gardenElementAt(p.garden, at, tolerance);
    if (garden) hits.push({ kind: 'garden', id: garden });
    const cell = p.terrainCuts?.find((c) => c.x === Math.floor(at.x) && c.y === Math.floor(at.y));
    if (cell) hits.push({ kind: 'earth', id: cell.id });
    for (const bore of p.foundation?.bores ?? [])
      if (distance(bore, at) <= bore.diameterM / 2) hits.push({ kind: 'bore', id: bore.id });
    for (const e of p.foundation?.elements ?? []) {
      const b = foundationElementBounds(e);
      if (at.x >= b.minX && at.x <= b.maxX && at.y >= b.minY && at.y <= b.maxY)
        hits.push({ kind: 'foundation', id: e.id });
    }
  }
  return hits;
}
export function surfaceName(t: SurfaceTarget): string {
  const p = usePropertyStore.getState().property;
  switch (t.kind) {
    case 'wall':
      return t.hit.kind === 'free' ? 'Drawn wall' : 'Room wall';
    case 'floor':
      return 'Floor finish';
    case 'item':
      return 'Product';
    case 'opening':
      return 'Door or window';
    case 'run':
      return (p.services?.runs.find((r) => r.id === t.id)?.system ?? 'Service') + ' run';
    case 'fixture':
      return p.services?.fixtures.find((f) => f.id === t.id)?.kind ?? 'Fixture';
    case 'earth':
      return 'Excavation cell';
    case 'shade':
      return 'Shade sail';
    case 'garden':
      return p.garden?.surfaces.find((s) => s.id === t.id)?.kind ?? 'Fence';
    case 'component':
      return p.boundaryComponents?.find((c) => c.id === t.id)?.name ?? 'Component';
    case 'room':
      return p.rooms.find((r) => r.id === t.id)?.name ?? 'Room';
    default:
      return t.kind === 'stair'
        ? 'Stairs'
        : t.kind === 'roof'
          ? 'Roof'
          : t.kind === 'bore'
            ? 'Foundation bore'
            : 'Foundation';
  }
}
export function removeSurface(t: SurfaceTarget): boolean {
  const s = usePropertyStore.getState(),
    p = s.property;
  if (!('id' in t)) return removeBuildTarget(t).ok;
  switch (t.kind) {
    case 'shade':
      return s.removeShadeSail(t.id);
    case 'stair':
      s.removeStair(t.id);
      break;
    case 'room':
      s.removeRoom(t.id);
      break;
    case 'roof':
      return s.removeLevel(ROOF_LEVEL_ID);
    case 'earth':
      return s.setTerrainCuts((p.terrainCuts ?? []).filter((c) => c.id !== t.id));
    case 'component':
      return s.setBoundaryComponents((p.boundaryComponents ?? []).filter((c) => c.id !== t.id));
    case 'garden':
      s.removeGardenElement(t.id);
      break;
    case 'foundation':
    case 'bore':
      return (
        !!p.foundation &&
        s.setFoundation({
          ...p.foundation,
          elements: p.foundation.elements.filter((e) => t.kind === 'bore' || e.id !== t.id),
          bores: p.foundation.bores?.filter((e) => t.kind === 'foundation' || e.id !== t.id),
        })
      );
    case 'run':
    case 'fixture': {
      if (!p.services) return false;
      const fixtures = p.services.fixtures.filter((f) => t.kind !== 'fixture' || f.id !== t.id);
      const runs = p.services.runs
        .filter((r) => t.kind !== 'run' || r.id !== t.id)
        .map((r) =>
          t.kind !== 'fixture'
            ? r
            : {
                ...r,
                startConnection:
                  r.startConnection?.fixtureId === t.id ? undefined : r.startConnection,
                endConnection: r.endConnection?.fixtureId === t.id ? undefined : r.endConnection,
              },
        );
      return s.setServices({ ...p.services, fixtures, runs });
    }
  }
  return true;
}
export function sameSurfaceGroup(
  t: SurfaceTarget,
  p: Property,
  level: string,
): { label: string; targets: SurfaceTarget[] } | null {
  const rooms = p.rooms.filter(
    (r) => roomLevelId(r) === level && !isRoofRoom(r) && r.kind !== 'outdoor',
  );
  if (t.kind === 'item') {
    const product = rooms
      .flatMap((r) => r.placedItems)
      .find((i) => i.instanceId === t.instanceId)?.productId;
    return {
      label: 'Remove matching products on this floor',
      targets: rooms.flatMap((r) =>
        r.placedItems
          .filter((i) => i.productId === product)
          .map((i) => ({ kind: 'item', instanceId: i.instanceId })),
      ),
    };
  }
  if (t.kind === 'wall') {
    if (t.hit.kind === 'free')
      return {
        label: 'Remove all drawn walls on this floor',
        targets: (p.walls ?? [])
          .filter((w) => roomLevelId(w) === level)
          .map((w) => ({ kind: 'wall', hit: { kind: 'free', wallId: w.id } })),
      };
    const room = rooms.find((r) => r.id === t.hit.roomId);
    return room
      ? {
          label: 'Remove all walls of this room',
          targets: roomEdges(room).map((e) => ({
            kind: 'wall',
            hit: { kind: 'edge', roomId: room.id, edgeIndex: e.index },
          })),
        }
      : null;
  }
  if (t.kind === 'opening') {
    const type = rooms.flatMap((r) => r.openings ?? []).find((o) => o.id === t.openingId)?.kind;
    return {
      label: 'Remove matching openings on this floor',
      targets: rooms.flatMap((r) =>
        (r.openings ?? [])
          .filter((o) => o.kind === type)
          .map((o) => ({ kind: 'opening', openingId: o.id })),
      ),
    };
  }
  const group = (label: string, ids: string[]) =>
    'id' in t ? { label, targets: ids.map((id) => ({ ...t, id })) } : null;
  switch (t.kind) {
    case 'stair':
      return group(
        'Remove all stairs connected to this floor',
        (p.stairs ?? [])
          .filter((s) => [s.fromLevelId, s.toLevelId].includes(level))
          .map((s) => s.id),
      );
    case 'earth':
      return group(
        'Fill all excavated cells',
        (p.terrainCuts ?? []).map((c) => c.id),
      );
    case 'bore':
      return group(
        'Remove all foundation bores',
        (p.foundation?.bores ?? []).map((b) => b.id),
      );
    case 'foundation':
      return group(
        'Remove all foundation elements',
        (p.foundation?.elements ?? []).map((e) => e.id),
      );
    case 'run':
      return group(
        'Remove matching runs on this floor',
        (p.services?.runs ?? [])
          .filter(
            (r) =>
              r.levelId === level &&
              r.system === p.services?.runs.find((f) => f.id === t.id)?.system,
          )
          .map((r) => r.id),
      );
    case 'fixture':
      return group(
        'Remove matching fixtures on this floor',
        (p.services?.fixtures ?? [])
          .filter(
            (r) =>
              r.levelId === level &&
              r.kind === p.services?.fixtures.find((f) => f.id === t.id)?.kind,
          )
          .map((r) => r.id),
      );
    case 'component':
      return group(
        'Remove all measured components',
        (p.boundaryComponents ?? []).map((c) => c.id),
      );
    case 'shade':
      return group(
        'Remove all shade sails',
        (p.shade?.sails ?? []).map((s) => s.id),
      );
    case 'garden': {
      const s = p.garden?.surfaces.find((g) => g.id === t.id);
      return group(
        s ? 'Remove matching landscape surfaces' : 'Remove all fences',
        (s ? p.garden?.surfaces.filter((g) => g.kind === s.kind) : p.garden?.fences)?.map(
          (g) => g.id,
        ) ?? [],
      );
    }
    default:
      return null;
  }
}
export interface Bend {
  target: SurfaceTarget;
  index: number;
  a: Vertex;
  b: Vertex;
}
export function bendAt(p: Property, t: SurfaceTarget, at: Vertex): Bend | null {
  let points: Vertex[] | undefined,
    closed = false;
  if (t.kind === 'wall') {
    if (t.hit.kind === 'edge') {
      const edge = roomEdges(
        p.rooms.find((r) => r.id === t.hit.roomId) ?? { polygon: [], id: '' },
      ).find((e) => e.index === t.hit.edgeIndex);
      return edge ? { target: t, index: edge.index, a: edge.a, b: edge.b } : null;
    }
    const w = p.walls?.find((w) => w.id === t.hit.wallId);
    if (w) points = [w.a, w.b];
  } else if (t.kind === 'run') points = p.services?.runs.find((r) => r.id === t.id)?.points;
  else if (t.kind === 'roof') {
    points = p.rooms.find((r) => r.id === t.id)?.polygon;
    closed = true;
  }
  if (!points || points.length < 2) return null;
  let nearest = Infinity,
    choice: Bend | null = null;
  for (let i = 0; i < points.length - (closed ? 0 : 1); i++) {
    const a = points[i],
      b = points[(i + 1) % points.length],
      d = segmentDistance(at, a, b);
    if (d < nearest) {
      nearest = d;
      choice = { target: t, index: i, a, b };
    }
  }
  return choice;
}
export const bendShape = (edge: Bend, at: Vertex) =>
  sampleMeasuredPath({
    start: edge.a,
    segments: [
      {
        kind: 'quadratic',
        control: {
          x: 2 * at.x - (edge.a.x + edge.b.x) / 2,
          y: 2 * at.y - (edge.a.y + edge.b.y) / 2,
        },
        to: edge.b,
      },
    ],
  });
export function commitBend(edge: Bend, at: Vertex): boolean {
  const store = usePropertyStore.getState(),
    p = store.property,
    t = edge.target;
  const mid = { x: (edge.a.x + edge.b.x) / 2, y: (edge.a.y + edge.b.y) / 2 },
    live = bendAt(p, t, mid);
  if (
    !live ||
    live.index !== edge.index ||
    distance(edge.a, live.a) > 0.0001 ||
    distance(edge.b, live.b) > 0.0001
  )
    return false;
  const shape = bendShape(edge, at);
  if (!shape) return false;
  const v = shape.vertices,
    inside = v.slice(1, -1);
  if (
    p.site &&
    v.some(
      (q) =>
        q.x < p.site!.originM.x ||
        q.y < p.site!.originM.y ||
        q.x > p.site!.originM.x + p.site!.widthM ||
        q.y > p.site!.originM.y + p.site!.depthM,
    )
  )
    return false;
  if (t.kind === 'roof') {
    const room = p.rooms.find((r) => r.id === t.id);
    if (!room) return false;
    const loop = [...room.polygon];
    loop.splice(edge.index + 1, 0, ...inside);
    const path = measuredPathFromVertices(loop, true);
    return !!path && store.setRoofOutline(path);
  }
  if (t.kind === 'run' && p.services) {
    const run = p.services.runs.find((r) => r.id === t.id);
    if (!run || run.points.length + inside.length > 500) return false;
    const old = serviceRunPoints3D(run),
      points = run.points.map((q, i) => ({ ...q, elevationM: old[i].elevationM }));
    const z = old[edge.index].elevationM,
      dz = old[edge.index + 1].elevationM - z;
    let travelled = 0;
    points.splice(
      edge.index + 1,
      0,
      ...inside.map((q, i) => {
        travelled += distance(v[i], q);
        return { ...q, elevationM: z + (dz * travelled) / shape.lengthM };
      }),
    );
    return store.setServices({
      ...p.services,
      runs: p.services.runs.map((r) => (r === run ? { ...r, points } : r)),
    });
  }
  if (t.kind !== 'wall') return false;
  if (t.hit.kind === 'free') {
    const wall = p.walls?.find((w) => w.id === t.hit.wallId);
    if (!wall) return false;
    const pieces = v
      .slice(1)
      .map((b, i) => ({ ...wall, id: i ? nanoid(10) : wall.id, a: v[i], b }));
    usePropertyStore.setState({
      property: { ...p, walls: p.walls!.flatMap((w) => (w === wall ? pieces : [w])) },
    });
    return true;
  }
  const owner = p.rooms.find((r) => r.id === t.hit.roomId);
  if (!owner) return false;
  const rooms = [...p.rooms],
    changed = new Set<string>();
  for (const [i, r] of rooms.entries()) {
    if (roomLevelId(r) !== roomLevelId(owner) || isRoofRoom(r) || r.kind === 'outdoor') continue;
    const index = r.polygon.findIndex((a, j) => {
      const b = r.polygon[(j + 1) % r.polygon.length];
      return (
        (distance(a, edge.a) < 0.001 && distance(b, edge.b) < 0.001) ||
        (distance(a, edge.b) < 0.001 && distance(b, edge.a) < 0.001)
      );
    });
    if (index < 0) continue;
    if (r.openings?.some((o) => o.edgeIndex === index)) return false;
    const polygon = [...r.polygon];
    polygon.splice(
      index + 1,
      0,
      ...(distance(polygon[index], edge.a) < 0.001 ? inside : [...inside].reverse()),
    );
    if (!isSimpleMeasuredPath(polygon, true)) return false;
    if (
      r.placedItems.some((item) => {
        const prod = getProductById(item.productId);
        if (!prod) return false;
        const size = rotatedFootprint(
          { lengthM: prod.dimensions_cm.length / 100, widthM: prod.dimensions_cm.width / 100 },
          item.rotation,
        );
        return (
          isRectInsidePolygon({ x: item.x, y: item.y, ...size }, r.polygon) &&
          !isRectInsidePolygon({ x: item.x, y: item.y, ...size }, polygon)
        );
      })
    )
      return false;
    changed.add(r.id);
    const shift = (n: number) => (n > index ? n + inside.length : n);
    const spans = <T extends { edgeIndex: number }>(list?: T[]) =>
      list?.flatMap((e) =>
        e.edgeIndex === index
          ? v.slice(1).map((_, j) => ({ ...e, edgeIndex: index + j }))
          : [{ ...e, edgeIndex: shift(e.edgeIndex) }],
      );
    rooms[i] = {
      ...r,
      polygon,
      openings: r.openings?.map((o) => ({ ...o, edgeIndex: shift(o.edgeIndex) })),
      wallPaint: spans(r.wallPaint),
      wallCladding: spans(r.wallCladding),
      wallConstruction: spans(r.wallConstruction),
      removedWallEdges: r.removedWallEdges?.map(shift),
      floorTiles: decodeFloorZones(r.floorTiles, polygon),
    };
  }
  const next = { ...p, rooms };
  for (const r of rooms.filter((r) => changed.has(r.id))) {
    for (const o of rooms)
      if (
        o.id !== r.id &&
        o.kind !== 'outdoor' &&
        !isRoofRoom(o) &&
        roomLevelId(o) === roomLevelId(r) &&
        strictPolygonsOverlap(r.polygon, o.polygon)
      )
        return false;
  }
  if (p.stairs?.some((s) => validateStairPlacement(p, s).ok && !validateStairPlacement(next, s).ok))
    return false;
  usePropertyStore.setState({ property: syncRoofRooms(next) });
  return true;
}
