/** Rooms are the bounded faces of the floor's wall graph, not pen-stroke rectangles.
 * World metres remain authoritative. No raster/grid conversion is involved. */
import { pointInPolygon, polygonArea, type Polygon, type Vertex } from '../lib/geometry';
import type { Property, Room } from '../store/propertyStore';
import { isOutdoorRoom, isRoofRoom, roomLevelId } from './levels';
import { pruneZone } from './floorTiles';
import { roomEdges, pointAlongEdge, projectOntoEdge, perpDistanceToEdgeLine } from './wallEdges';
import { nextRoomName } from './roomNaming';
import { runToFreeWalls, type FreeWall } from './freeWalls';

const EPS = 1e-7;
/** Join tolerance is 1 mm, matching physical shared-wall detection. */
export const WALL_JOIN_TOLERANCE_M = 0.001;
type Segment = { a: Vertex; b: Vertex };
const distance = (a: Vertex, b: Vertex) => Math.hypot(a.x - b.x, a.y - b.y);
const finite = (p: Vertex) => Number.isFinite(p.x) && Number.isFinite(p.y);
const cross = (a: Vertex, b: Vertex) => a.x * b.y - a.y * b.x;
const subtract = (a: Vertex, b: Vertex) => ({ x: a.x - b.x, y: a.y - b.y });
const at = (s: Segment, t: number) => ({ x: s.a.x + (s.b.x - s.a.x) * t, y: s.a.y + (s.b.y - s.a.y) * t });
const signedArea = (p: Polygon) => p.reduce((n, a, i) => n + cross(a, p[(i + 1) % p.length]), 0) / 2;
function projection(p: Vertex, s: Segment): number {
  const d = subtract(s.b, s.a);
  return ((p.x - s.a.x) * d.x + (p.y - s.a.y) * d.y) / (d.x * d.x + d.y * d.y);
}

/** Shared plan snapping excludes roofs, outdoors and other storeys, and includes
 * unfinished free-wall ends and midpoints as well as completed room boundaries. */
export function snapVertexToFloorWalls(property: Property, point: Vertex, levelId: string, toleranceM: number): { v: Vertex; kind: 'vertex' | 'edge' } | null {
  if (!finite(point) || !Number.isFinite(toleranceM) || toleranceM < 0) return null;
  const segments = [...property.rooms.filter(room => roomLevelId(room) === levelId && !isOutdoorRoom(room) && !isRoofRoom(room)).flatMap(room => roomEdges(room)),
    ...(property.walls ?? []).filter(wall => roomLevelId(wall) === levelId)];
  let vertex: Vertex | null = null, edge: Vertex | null = null, vertexDistance = toleranceM, edgeDistance = toleranceM;
  for (const segment of segments) {
    for (const endpoint of [segment.a, segment.b]) {
      const d = distance(point, endpoint);
      if (d <= vertexDistance) { vertex = endpoint; vertexDistance = d; }
    }
    const t = Math.max(0, Math.min(1, projection(point, segment))), candidate = at(segment, t), d = distance(point, candidate);
    if (d <= edgeDistance) { edge = candidate; edgeDistance = d; }
  }
  return vertex ? { v: { ...vertex }, kind: 'vertex' } : edge ? { v: { ...edge }, kind: 'edge' } : null;
}

/** Called only on release/tap, never per hover frame. It previews the exact store
 * operation so a snapped join commits automatically only when it forms a room. */
export function wallRunFormsRoom(property: Property, vertices: Polygon, levelId: string): boolean {
  let id = 0;
  const walls = runToFreeWalls(vertices, levelId).map(wall => ({ ...wall, id: `draft-wall-${id++}` }));
  if (!walls.length) return false;
  const next = inferConnectedRooms({ ...property, walls: [...(property.walls ?? []), ...walls] }, levelId, () => `draft-room-${id++}`);
  return next.rooms !== property.rooms;
}

/** Split intersections and endpoint-on-edge joins, remove bridge edges, then walk
 * directed half-edges. Only positive, simple bounded faces survive; the unbounded
 * outside face is negative. This handles diagonals, concavity and T junctions. */
export function closedWallFaces(input: readonly Segment[]): Polygon[] {
  const segments = input.filter(s => finite(s.a) && finite(s.b) && Number.isFinite(distance(s.a, s.b)) && distance(s.a, s.b) > EPS);
  // Bound interactive work on malformed/imported files, without changing the plan.
  if (segments.length > 2048) return [];
  const splits = segments.map(() => [0, 1]);
  let splitCount = segments.length * 2;
  for (let i = 0; i < segments.length; i++) for (let j = i + 1; j < segments.length; j++) {
    const a = segments[i], b = segments[j];
    for (const [source, target, targetIndex] of [[a, b, j], [b, a, i]] as const) {
      for (const point of [source.a, source.b]) {
        const t = projection(point, target);
        if (t >= -EPS && t <= 1 + EPS && distance(point, at(target, t)) <= WALL_JOIN_TOLERANCE_M) { splits[targetIndex].push(Math.max(0, Math.min(1, t))); splitCount++; }
      }
    }
    const u = subtract(a.b, a.a), v = subtract(b.b, b.a), denominator = cross(u, v);
    if (Math.abs(denominator) <= EPS) { if (splitCount > 16000) return []; continue; }
    const delta = subtract(b.a, a.a), t = cross(delta, v) / denominator, q = cross(delta, u) / denominator;
    if (t >= -EPS && t <= 1 + EPS && q >= -EPS && q <= 1 + EPS) {
      splits[i].push(Math.max(0, Math.min(1, t))); splits[j].push(Math.max(0, Math.min(1, q)));
      splitCount += 2;
    }
    if (splitCount > 16000) return [];
  }
  const nodes: Vertex[] = [];
  const node = (p: Vertex) => {
    const found = nodes.findIndex(other => distance(p, other) <= WALL_JOIN_TOLERANCE_M);
    if (found >= 0) return found;
    nodes.push({ ...p }); return nodes.length - 1;
  };
  const edgeKeys = new Set<string>(), edges: [number, number][] = [];
  segments.forEach((segment, i) => {
    const ts = [...new Set(splits[i])].sort((a, b) => a - b);
    for (let k = 1; k < ts.length; k++) {
      const a = node(at(segment, ts[k - 1])), b = node(at(segment, ts[k]));
      if (a === b) continue;
      const key = [Math.min(a, b), Math.max(a, b)].join(':');
      if (!edgeKeys.has(key)) { edgeKeys.add(key); edges.push([a, b]); }
    }
  });
  const adjacency = nodes.map(() => [] as { node: number; edge: number }[]);
  edges.forEach(([a, b], edge) => { adjacency[a].push({ node: b, edge }); adjacency[b].push({ node: a, edge }); });
  const discovered = nodes.map(() => -1), low = nodes.map(() => -1), bridges = new Set<number>();
  let time = 0;
  const visit = (n: number, parentEdge: number) => {
    discovered[n] = low[n] = time++;
    for (const next of adjacency[n]) {
      if (next.edge === parentEdge) continue;
      if (discovered[next.node] < 0) {
        visit(next.node, next.edge); low[n] = Math.min(low[n], low[next.node]);
        if (low[next.node] > discovered[n]) bridges.add(next.edge);
      } else low[n] = Math.min(low[n], discovered[next.node]);
    }
  };
  nodes.forEach((_, n) => { if (discovered[n] < 0) visit(n, -1); });
  const neighbours = adjacency.map((list, n) => list.filter(e => !bridges.has(e.edge)).map(e => e.node)
    .sort((a, b) => Math.atan2(nodes[a].y - nodes[n].y, nodes[a].x - nodes[n].x) - Math.atan2(nodes[b].y - nodes[n].y, nodes[b].x - nodes[n].x)));
  const used = new Set<string>(), faces: Polygon[] = [];
  neighbours.forEach((list, start) => list.forEach(second => {
    if (used.has(`${start}:${second}`)) return;
    const ring: number[] = [];
    let a = start, b = second;
    for (let count = 0; count <= edges.length * 2; count++) {
      if (used.has(`${a}:${b}`)) break;
      used.add(`${a}:${b}`); ring.push(a);
      const choices = neighbours[b], incoming = choices.indexOf(a);
      const next = choices[(incoming - 1 + choices.length) % choices.length];
      a = b; b = next;
      if (a === start && b === second) {
        const polygon = ring.map(index => ({ ...nodes[index] }));
        const area = signedArea(polygon);
        if (new Set(ring).size === ring.length && polygon.length >= 3 && Number.isFinite(area) && area >= 0.01) faces.push(polygon);
        break;
      }
    }
  }));
  return faces;
}

function containsPolygon(outer: Polygon, inner: Polygon): boolean {
  return inner.every((p, i) => pointInPolygon(p, outer, WALL_JOIN_TOLERANCE_M)
    && pointInPolygon(at({ a: p, b: inner[(i + 1) % inner.length] }, 0.5), outer, WALL_JOIN_TOLERANCE_M));
}
/** A concave face's vertex-average may lie in its neighbour. Probe just inside
 * a boundary instead; graph faces cannot cross the original room boundaries. */
function interiorWitness(polygon: Polygon): Vertex {
  const orientation = signedArea(polygon) >= 0 ? 1 : -1;
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i], b = polygon[(i + 1) % polygon.length], length = distance(a, b);
    const offset = Math.min(0.001, length * 0.001) * orientation;
    const point = { x: (a.x + b.x) / 2 - (b.y - a.y) / length * offset, y: (a.y + b.y) / 2 + (b.x - a.x) / length * offset };
    if (pointInPolygon(point, polygon, EPS)) return point;
  }
  return polygon[0];
}
function remapRoom(source: Room, polygon: Polygon, id: string): Room {
  const edges = roomEdges({ id, polygon }), oldEdges = roomEdges(source);
  const correspondence = edges.map(edge => oldEdges.find(old => Math.abs(perpDistanceToEdgeLine(old, edge.a)) < WALL_JOIN_TOLERANCE_M
    && Math.abs(perpDistanceToEdgeLine(old, edge.b)) < WALL_JOIN_TOLERANCE_M
    && projectOntoEdge(old, edge.a) >= -EPS && projectOntoEdge(old, edge.b) >= -EPS
    && projectOntoEdge(old, edge.a) <= old.lengthM + EPS && projectOntoEdge(old, edge.b) <= old.lengthM + EPS));
  const remap = <T extends { edgeIndex: number }>(entries?: T[]) => entries?.flatMap(entry => correspondence.flatMap((old, edgeIndex) =>
    old?.index === entry.edgeIndex ? [{ ...entry, edgeIndex }] : []));
  const openings = (source.openings ?? []).flatMap(opening => {
    const old = oldEdges.find(edge => edge.index === opening.edgeIndex);
    if (!old) return [];
    const centre = pointAlongEdge(old, opening.offsetM);
    return edges.flatMap((edge, edgeIndex) => {
      if (correspondence[edgeIndex]?.index !== old.index) return [];
      const offsetM = projectOntoEdge(edge, centre);
      if (offsetM - opening.widthM / 2 < -EPS || offsetM + opening.widthM / 2 > edge.lengthM + EPS) return [];
      const reversed = edge.dx * old.dx + edge.dy * old.dy < 0;
      return [{ ...opening, edgeIndex, offsetM, ...(reversed ? { flipFacing: !opening.flipFacing, flipHand: !opening.flipHand } : {}) }];
    });
  });
  return { ...source, id, polygon, placedItems: [], ...(source.openings ? { openings } : {}),
    ...(source.wallPaint ? { wallPaint: remap(source.wallPaint) } : {}),
    ...(source.wallCladding ? { wallCladding: remap(source.wallCladding) } : {}),
    ...(source.wallConstruction ? { wallConstruction: remap(source.wallConstruction) } : {}),
    ...(source.floorTiles ? { floorTiles: source.floorTiles.map(zone => pruneZone(zone, polygon)).filter(zone => zone.runs.length) } : {}) };
}

/** Subtract just the boundary spans which became rooms. Any unclosed tail,
 * including its finish metadata, survives as a free wall. */
function remainingWalls(walls: FreeWall[], rooms: Room[], id: () => string): FreeWall[] {
  const boundaries = rooms.flatMap(room => roomEdges(room));
  return walls.flatMap(wall => {
    const length = distance(wall.a, wall.b);
    const cuts: [number, number][] = [];
    for (const edge of boundaries) {
      if (Math.abs(perpDistanceToEdgeLine(edge, wall.a)) > WALL_JOIN_TOLERANCE_M || Math.abs(perpDistanceToEdgeLine(edge, wall.b)) > WALL_JOIN_TOLERANCE_M) continue;
      const a = projection(edge.a, wall), b = projection(edge.b, wall);
      const lo = Math.max(0, Math.min(a, b)), hi = Math.min(1, Math.max(a, b));
      if (hi - lo > EPS) cuts.push([lo, hi]);
    }
    if (!cuts.length) return [wall];
    cuts.sort((a, b) => a[0] - b[0]);
    const kept: [number, number][] = []; let cursor = 0;
    for (const [lo, hi] of cuts) { if (lo - cursor > EPS) kept.push([cursor, lo]); cursor = Math.max(cursor, hi); }
    if (cursor < 1 - EPS) kept.push([cursor, 1]);
    return kept.filter(([a, b]) => (b - a) * length > WALL_JOIN_TOLERANCE_M).map(([a, b], i) => ({ ...wall, id: i ? id() : wall.id, a: at(wall, a), b: at(wall, b) }));
  });
}

function applyFreeWallFinishes(room: Room, walls: FreeWall[], allRooms: Room[]): Room {
  const result = { ...room, wallPaint: [...(room.wallPaint ?? [])], wallConstruction: [...(room.wallConstruction ?? [])], wallCladding: [...(room.wallCladding ?? [])] };
  for (const edge of roomEdges(room)) {
    const wall = walls.find(w => Math.abs(perpDistanceToEdgeLine(edge, w.a)) < WALL_JOIN_TOLERANCE_M && Math.abs(perpDistanceToEdgeLine(edge, w.b)) < WALL_JOIN_TOLERANCE_M
      && projection(edge.a, w) >= -EPS && projection(edge.b, w) >= -EPS && projection(edge.a, w) <= 1 + EPS && projection(edge.b, w) <= 1 + EPS);
    if (!wall) continue;
    const midpoint = pointAlongEdge(edge, edge.lengthM / 2);
    const owners = allRooms.filter(candidate => roomEdges(candidate).some(other => Math.abs(perpDistanceToEdgeLine(other, midpoint)) < WALL_JOIN_TOLERANCE_M
      && projectOntoEdge(other, midpoint) >= -EPS && projectOntoEdge(other, midpoint) <= other.lengthM + EPS));
    const faceIndex = owners.findIndex(candidate => candidate.id === room.id);
    const finish = { edgeIndex: edge.index, paintId: wall.paintId!, colourHex: wall.paintColourHex, colourName: wall.paintColourName };
    if (wall.paintId && faceIndex < (wall.paintFaces ?? 1) && !result.wallPaint.some(p => p.edgeIndex === edge.index)) {
      result.wallPaint.push(finish);
      if (wall.paintFaces === 2 && owners.length === 1) result.wallPaint.push({ ...finish, side: 'exterior' });
    }
    if (wall.exteriorPaint && owners.length === 1 && !result.wallPaint.some(p => p.edgeIndex === edge.index && p.side === 'exterior')) result.wallPaint.push({ ...wall.exteriorPaint, edgeIndex: edge.index, side: 'exterior' });
    if (wall.construction && !result.wallConstruction.some(p => p.edgeIndex === edge.index)) result.wallConstruction.push({ edgeIndex: edge.index, kind: wall.construction });
    if (wall.claddingId && faceIndex < (wall.claddingFaces ?? 1) && !result.wallCladding.some(p => p.edgeIndex === edge.index)) result.wallCladding.push({ edgeIndex: edge.index, productId: wall.claddingId });
  }
  return result;
}

/** Atomic room inference used by both plan and 3D wall commits. A partition only
 * replaces its parent when all area and all existing openings survive. An isolated
 * inner ring is retained as walls: the current Room model cannot represent holes. */
export function inferConnectedRooms(property: Property, levelId: string, makeId: () => string): Property {
  const oldRooms = property.rooms.filter(room => roomLevelId(room) === levelId && !isOutdoorRoom(room) && !isRoofRoom(room) && room.polygon.length >= 3);
  const walls = (property.walls ?? []).filter(wall => roomLevelId(wall) === levelId);
  const faces = closedWallFaces([...oldRooms.flatMap(room => roomEdges(room)), ...walls]);
  const witnesses = new Map(faces.map(face => [face, interiorWitness(face)]));
  const replacements = new Map<string, Room[]>(), occupied = new Set<Polygon>();
  for (const room of oldRooms) {
    const pieces = faces.filter(face => containsPolygon(room.polygon, face) && pointInPolygon(witnesses.get(face)!, room.polygon, EPS));
    pieces.forEach(face => occupied.add(face));
    if (pieces.length < 2 || Math.abs(pieces.reduce((n, p) => n + polygonArea(p), 0) - polygonArea(room.polygon)) > Math.max(1e-5, polygonArea(room.polygon) * 1e-6)) continue;
    pieces.sort((a, b) => polygonArea(b) - polygonArea(a));
    const children = pieces.map((polygon, i) => remapRoom(room, polygon, i ? makeId() : room.id));
    const retainedOpenings = new Set(children.flatMap(child => (child.openings ?? []).map(opening => opening.id)));
    if ((room.openings ?? []).some(opening => !retainedOpenings.has(opening.id))) continue;
    // Children of a table stay with their parent, while all coordinates remain unchanged.
    const owners = new Map<string, Room>();
    for (const item of room.placedItems.filter(item => !item.parentInstanceId)) owners.set(item.instanceId, children.find(child => pointInPolygon(item, child.polygon)) ?? children[0]);
    for (const item of room.placedItems) (owners.get(item.parentInstanceId ?? item.instanceId) ?? children.find(child => pointInPolygon(item, child.polygon)) ?? children[0]).placedItems.push(item);
    replacements.set(room.id, children);
  }
  const additions = faces.filter(face => !occupied.has(face)
    && !oldRooms.some(room => pointInPolygon(witnesses.get(face)!, room.polygon, EPS) || pointInPolygon(interiorWitness(room.polygon), face, EPS))
    // Disconnected nested cycles require floor holes. Keep the enclosing cycle
    // as walls instead of adding an overlapping outer room across the inner one.
    && !faces.some(other => other !== face && pointInPolygon(witnesses.get(other)!, face, EPS)));
  if (!replacements.size && !additions.length) return property;
  let rooms = property.rooms.flatMap(room => replacements.get(room.id) ?? [room]);
  // Keep the parent's name on its largest face; assign normal room names to the rest.
  for (const children of replacements.values()) for (const child of children.slice(1)) child.name = nextRoomName(rooms.filter(room => room.id !== child.id));
  for (const polygon of additions) {
    const blank = rooms.find(room => roomLevelId(room) === levelId && !isOutdoorRoom(room) && !isRoofRoom(room) && room.polygon.length < 3);
    const room: Room = { ...(blank ?? { id: makeId(), name: nextRoomName(rooms), placedItems: [], ...(levelId === 'ground' ? {} : { levelId }) }), polygon };
    if (blank) rooms = rooms.map(existing => existing.id === blank.id ? room : existing); else rooms.push(room);
  }
  const changedIds = new Set([...replacements.values()].flat().map(room => room.id));
  const finishRooms = rooms.filter(room => roomLevelId(room) === levelId && !isOutdoorRoom(room) && !isRoofRoom(room));
  rooms = rooms.map(room => (changedIds.has(room.id) || additions.includes(room.polygon)) ? applyFreeWallFinishes(room, walls, finishRooms) : room);
  const levelRooms = rooms.filter(room => roomLevelId(room) === levelId && !isOutdoorRoom(room) && !isRoofRoom(room));
  const keptWalls = remainingWalls(walls, levelRooms, makeId);
  const activeRoomId = rooms.some(room => room.id === property.activeRoomId && room.polygon.length >= 3) ? property.activeRoomId : levelRooms.find(room => room.polygon.length >= 3)?.id ?? property.activeRoomId;
  return { ...property, rooms, activeRoomId, walls: [...(property.walls ?? []).filter(wall => roomLevelId(wall) !== levelId), ...keptWalls] };
}
