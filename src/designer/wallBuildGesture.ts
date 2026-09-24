/** Snapping and validation for a connected run of directly drawn 3D walls. */
import { polygonArea, type Polygon, type Vertex } from '../lib/geometry';
import type { Property } from '../store/propertyStore';
import { levelElevationM } from './building';
import { axisLockVertex, quantiseVertex } from './drawLength';
import { activeLevelIdOf, isOutdoorRoom, isRoofLevel, isRoofRoom, levelsOf, roomLevelId } from './levels';
import { closeThresholdM, isDrawnPolygon, strictPolygonsOverlap, wallSnapTolM } from './roomLayout';

const EPS = 1e-7;
export const MIN_WALL_BUILD_LENGTH_M = 0.1;

export interface WallBuildChain {
  propertyId: string;
  levelId: string;
  /** One more vertex than walls. A single point is an uncommitted anchor. */
  vertices: Vertex[];
  /** Only walls made by this run may be replaced when it closes into a room. */
  wallIds: string[];
}

export interface WallBuildOptions {
  levelId?: string;
  stepM?: number;
  freeAngle?: boolean;
  chain?: WallBuildChain | null;
}

export type WallBuildFailureReason = 'invalid-point' | 'invalid-snap' | 'level-changed' | 'roof-level'
  | 'too-short' | 'off-plot' | 'duplicate-wall' | 'self-crossing' | 'overlapping-room' | 'stale-chain';
export interface WallBuildFailure { ok: false; reason: WallBuildFailureReason; message: string }

interface WallBuildGeometry {
  from: Vertex;
  to: Vertex;
  a: Vertex;
  b: Vertex;
  stepM: number;
  freeAngle: boolean;
  levelId: string;
  elevationM: number;
  lengthM: number;
  angleDeg: number;
  snapped: boolean;
  closesRoom: boolean;
  roomPolygon: Polygon | null;
}
export type WallBuildPreview = WallBuildGeometry & ({ ok: true } | WallBuildFailure);
interface Segment { a: Vertex; b: Vertex; room?: boolean }

const distance = (a: Vertex, b: Vertex) => Math.hypot(a.x - b.x, a.y - b.y);
const samePoint = (a: Vertex, b: Vertex) => distance(a, b) < EPS;
const finitePoint = (point: Vertex) => Number.isFinite(point.x) && Number.isFinite(point.y);
const cross = (a: Vertex, b: Vertex, c: Vertex) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);

function segmentsOnLevel(property: Property, levelId: string): Segment[] {
  const segments: Segment[] = (property.walls ?? []).filter((wall) => roomLevelId(wall) === levelId);
  for (const room of property.rooms) {
    if (roomLevelId(room) !== levelId || isOutdoorRoom(room) || isRoofRoom(room) || !isDrawnPolygon(room.polygon)) continue;
    room.polygon.forEach((point, index) => segments.push({ a: point, b: room.polygon[(index + 1) % room.polygon.length], room: true }));
  }
  return segments;
}

function snapToSegments(point: Vertex, segments: Segment[], tolerance: number, exclude?: Vertex): Vertex | null {
  let vertex: Vertex | null = null, vertexDistance = tolerance;
  let projection: Vertex | null = null, edgeDistance = tolerance;
  for (const { a, b } of segments) {
    for (const end of [a, b]) {
      if (exclude && samePoint(end, exclude)) continue;
      const d = distance(point, end);
      if (d <= vertexDistance) { vertex = end; vertexDistance = d; }
    }
    const lengthSq = (b.x - a.x) ** 2 + (b.y - a.y) ** 2;
    if (lengthSq < EPS) continue;
    const t = Math.max(0, Math.min(1, ((point.x - a.x) * (b.x - a.x) + (point.y - a.y) * (b.y - a.y)) / lengthSq));
    const candidate = { x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) };
    if (exclude && samePoint(candidate, exclude)) continue;
    const d = distance(point, candidate);
    if (d <= edgeDistance) { projection = candidate; edgeDistance = d; }
  }
  const snapped = vertex ?? projection;
  return snapped ? { ...snapped } : null;
}

function collinearOverlap(a: Vertex, b: Vertex, c: Vertex, d: Vertex): boolean {
  const length = distance(a, b);
  if (length < EPS || Math.abs(cross(a, b, c)) / length > EPS || Math.abs(cross(a, b, d)) / length > EPS) return false;
  const project = (point: Vertex) => ((point.x - a.x) * (b.x - a.x) + (point.y - a.y) * (b.y - a.y)) / length;
  const x = project(c), y = project(d);
  return Math.min(length, Math.max(x, y)) - Math.max(0, Math.min(x, y)) > EPS;
}

function onSegment(point: Vertex, a: Vertex, b: Vertex): boolean {
  return Math.abs(cross(a, b, point)) < EPS && point.x >= Math.min(a.x, b.x) - EPS && point.x <= Math.max(a.x, b.x) + EPS
    && point.y >= Math.min(a.y, b.y) - EPS && point.y <= Math.max(a.y, b.y) + EPS;
}

function segmentsMeet(a: Vertex, b: Vertex, c: Vertex, d: Vertex): boolean {
  const ac = cross(a, b, c), ad = cross(a, b, d), ca = cross(c, d, a), cb = cross(c, d, b);
  if (((ac > EPS && ad < -EPS) || (ac < -EPS && ad > EPS)) && ((ca > EPS && cb < -EPS) || (ca < -EPS && cb > EPS))) return true;
  return onSegment(c, a, b) || onSegment(d, a, b) || onSegment(a, c, d) || onSegment(b, c, d);
}

/** A self-touch or crossing cannot become a room polygon. */
export function isSimpleWallLoop(vertices: Polygon): boolean {
  const area = polygonArea(vertices);
  if (vertices.length < 3 || vertices.some((point) => !finitePoint(point)) || !Number.isFinite(area) || area < 0.01) return false;
  for (let i = 0; i < vertices.length; i++) {
    const next = (i + 1) % vertices.length;
    if (distance(vertices[i], vertices[next]) < MIN_WALL_BUILD_LENGTH_M - EPS) return false;
    for (let j = i + 1; j < vertices.length; j++) {
      if (j === next || (i === 0 && j === vertices.length - 1)) continue;
      if (segmentsMeet(vertices[i], vertices[next], vertices[j], vertices[(j + 1) % vertices.length])) return false;
    }
  }
  return true;
}

/**
 * Derive the live continuation from the complete authored run. Retain that
 * authored run across undo so redo can restore its endpoint; replace it only
 * when committing a new branch or finishing. Loading a new plan drops it.
 */
export function reconcileWallBuildChain(property: Property, chain: WallBuildChain | null): WallBuildChain | null {
  if (!chain || chain.propertyId !== property.id || chain.levelId !== activeLevelIdOf(property) || chain.vertices.length !== chain.wallIds.length + 1) return null;
  let count = 0;
  for (let i = 0; i < chain.wallIds.length; i++) {
    const wall = property.walls?.find((entry) => entry.id === chain.wallIds[i]);
    if (!wall || roomLevelId(wall) !== chain.levelId || !samePoint(wall.a, chain.vertices[i]) || !samePoint(wall.b, chain.vertices[i + 1])) break;
    count++;
  }
  return count === chain.wallIds.length ? chain : { ...chain, wallIds: chain.wallIds.slice(0, count), vertices: chain.vertices.slice(0, count + 1) };
}

/** Pure preview. Endpoint magnets win over grid/angle snapping to preserve exact joins. */
export function previewWallBuild(property: Property, from: Vertex, to: Vertex, options: WallBuildOptions = {}): WallBuildPreview {
  const levelId = options.levelId ?? activeLevelIdOf(property), stepM = options.stepM ?? 0.5;
  const freeAngle = options.freeAngle ?? false;
  let geometry: WallBuildGeometry = { from: { ...from }, to: { ...to }, a: { ...from }, b: { ...to }, stepM, freeAngle, levelId,
    elevationM: levelElevationM(property, levelId), lengthM: 0, angleDeg: 0, snapped: false, closesRoom: false, roomPolygon: null };
  const reject = (reason: WallBuildFailureReason, message: string): WallBuildPreview => ({ ...geometry, ok: false, reason, message });
  if (!finitePoint(from) || !finitePoint(to)) return reject('invalid-point', 'Draw the wall on the selected floor.');
  if (!Number.isFinite(stepM) || stepM <= 0) return reject('invalid-snap', 'Choose a positive grid step.');
  const level = levelsOf(property).find((entry) => entry.id === levelId);
  if (!level || levelId !== activeLevelIdOf(property)) return reject('level-changed', 'The floor changed. Start a new wall here.');
  if (isRoofLevel(level)) return reject('roof-level', 'Choose a storey to build walls.');
  const chain = options.chain;
  if (chain && reconcileWallBuildChain(property, chain) !== chain) return reject('stale-chain', 'This wall run changed. Finish it and start a new wall.');
  const segments = segmentsOnLevel(property, levelId);
  const tolerance = wallSnapTolM(stepM);
  const a = chain?.vertices[chain.vertices.length - 1] ?? snapToSegments(from, segments, tolerance) ?? quantiseVertex(from, stepM);
  const closing = !!chain && chain.vertices.length >= 3 && distance(to, chain.vertices[0]) <= closeThresholdM(stepM);
  // A magnet at the start cannot form a wall. Ignoring it also lets a short
  // outward/turning segment escape the previous endpoint's snap radius.
  const magnet = closing ? chain!.vertices[0] : snapToSegments(to, segments, tolerance, a);
  let b = magnet ?? axisLockVertex(a, quantiseVertex(to, stepM), { freed: freeAngle }).vertex;
  if (!magnet && !freeAngle) {
    const dx = b.x - a.x, dy = b.y - a.y;
    const angle = Math.atan2(Math.abs(dy), Math.abs(dx)) * 180 / Math.PI;
    if (Math.abs(angle - 45) <= 7.5) {
      const run = Math.round(Math.max(Math.abs(dx), Math.abs(dy)) / stepM) * stepM;
      b = { x: Number((a.x + Math.sign(dx) * run).toFixed(4)), y: Number((a.y + Math.sign(dy) * run).toFixed(4)) };
    }
  }
  const lengthM = distance(a, b);
  geometry = { ...geometry, a: { ...a }, b: { ...b }, lengthM, angleDeg: (Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI + 360) % 360,
    snapped: !!magnet, closesRoom: closing, roomPolygon: closing ? chain!.vertices.map((point) => ({ ...point })) : null };
  if (!finitePoint(a) || !finitePoint(b) || !Number.isFinite(lengthM)) return reject('invalid-point', 'Draw the wall on the selected floor.');
  const site = property.site;
  if (site && [a, b].some((point) => point.x < site.originM.x - EPS || point.y < site.originM.y - EPS
    || point.x > site.originM.x + site.widthM + EPS || point.y > site.originM.y + site.depthM + EPS)) {
    return reject('off-plot', 'Keep the wall inside the plot, or enlarge the land.');
  }
  if (lengthM < MIN_WALL_BUILD_LENGTH_M - EPS) return reject('too-short', 'Drag at least 10 cm, or tap the next corner.');
  // Closing against an existing room wall creates a shared room boundary,
  // not a duplicate free wall. Room-overlap validation still applies below.
  if (segments.some((segment) => !(closing && segment.room) && collinearOverlap(a, b, segment.a, segment.b))) {
    return reject('duplicate-wall', 'A wall already covers that line. Start from its end or draw in another direction.');
  }
  if (chain) {
    for (let i = 0; i + 2 < chain.vertices.length; i++) {
      if (closing && i === 0) continue;
      if (segmentsMeet(a, b, chain.vertices[i], chain.vertices[i + 1])) return reject('self-crossing', 'Keep this wall run from crossing itself. Finish it to start a separate wall.');
    }
  }
  if (closing && geometry.roomPolygon) {
    if (!isSimpleWallLoop(geometry.roomPolygon)) return reject('self-crossing', 'Draw a simple enclosed area before closing the room.');
    const overlaps = property.rooms.some((room) => roomLevelId(room) === levelId && !isOutdoorRoom(room) && !isRoofRoom(room)
      && strictPolygonsOverlap(geometry.roomPolygon!, room.polygon));
    if (overlaps) return reject('overlapping-room', 'This loop overlaps an existing room. Finish to keep the open walls instead.');
  }
  return { ...geometry, ok: true };
}
