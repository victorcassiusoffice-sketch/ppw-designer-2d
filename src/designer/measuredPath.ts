/** Shared measured line/curve authoring. Saved geometry is the sampled metre
 * polygon/polyline, so plan, 3D, takeoffs, undo and export use the same shape. */
import { polygonArea, type Polygon, type Vertex } from '../lib/geometry.js';

export type MeasuredPathSegment = { kind: 'line'; to: Vertex }
  | { kind: 'quadratic'; control: Vertex; to: Vertex };
export interface MeasuredPath { start: Vertex; segments: MeasuredPathSegment[]; closed?: boolean }
export interface MeasuredPathSample {
  /** Closed paths omit the repeated final point, matching Room.polygon. */
  vertices: Polygon;
  lengthM: number;
  areaM2: number;
  /** Maximum deviation of a sampled chord from its authored quadratic. */
  maxDeviationM: number;
}
export const CURVE_TOLERANCE_M = 0.003;
export const MAX_PATH_VERTICES = 512;
const EPS = 1e-7;
const distance = (a: Vertex, b: Vertex) => Math.hypot(b.x - a.x, b.y - a.y);
const midpoint = (a: Vertex, b: Vertex): Vertex => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
const point = (v: unknown): v is Vertex => !!v && typeof v === 'object'
  && ['x', 'y'].every(k => typeof (v as Record<string, unknown>)[k] === 'number'
    && Number.isFinite((v as Record<string, unknown>)[k]) && Math.abs((v as Record<string, number>)[k]) <= 1e6);
const clone = (v: Vertex): Vertex => ({ x: v.x, y: v.y });

export function normaliseMeasuredPath(raw: unknown): MeasuredPath | null {
  if (!raw || typeof raw !== 'object') return null;
  const value = raw as MeasuredPath;
  if (!point(value.start) || !Array.isArray(value.segments) || !value.segments.length || value.segments.length > 256) return null;
  const segments: MeasuredPathSegment[] = [];
  for (const segment of value.segments) {
    if (!segment || !point(segment.to)) return null;
    if (segment.kind === 'line') segments.push({ kind: 'line', to: clone(segment.to) });
    else if (segment.kind === 'quadratic' && point(segment.control)) segments.push({ kind: 'quadratic', to: clone(segment.to), control: clone(segment.control) });
    else return null;
  }
  return { start: clone(value.start), segments, ...(value.closed === true ? { closed: true } : {}) };
}

function distanceToSegment(p: Vertex, a: Vertex, b: Vertex): number {
  const dx = b.x - a.x, dy = b.y - a.y, square = dx * dx + dy * dy;
  const t = square > 0 ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / square)) : 0;
  return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy);
}

export function sampleMeasuredPath(raw: MeasuredPath, toleranceM = CURVE_TOLERANCE_M): MeasuredPathSample | null {
  const path = normaliseMeasuredPath(raw);
  if (!path || !Number.isFinite(toleranceM) || toleranceM < .0001 || toleranceM > .05) return null;
  const vertices: Polygon = [path.start];
  let maxDeviationM = 0, failed = false;
  const append = (p: Vertex) => {
    if (distance(vertices[vertices.length - 1], p) > EPS) vertices.push(clone(p));
    if (vertices.length > MAX_PATH_VERTICES + 1) failed = true;
  };
  const curve = (a: Vertex, control: Vertex, b: Vertex, depth = 0) => {
    if (failed) return;
    const deviation = distanceToSegment(control, a, b) / 2;
    if (deviation <= toleranceM) { maxDeviationM = Math.max(maxDeviationM, deviation); append(b); return; }
    if (depth >= 16) { failed = true; return; }
    const left = midpoint(a, control), right = midpoint(control, b), centre = midpoint(left, right);
    curve(a, left, centre, depth + 1); curve(centre, right, b, depth + 1);
  };
  let from = path.start;
  for (const segment of path.segments) {
    if (segment.kind === 'line') append(segment.to);
    else curve(from, segment.control, segment.to);
    from = segment.to;
  }
  if (failed || vertices.length < 2) return null;
  if (path.closed && distance(vertices[0], vertices[vertices.length - 1]) <= EPS) vertices.pop();
  if (vertices.length > MAX_PATH_VERTICES || !isSimpleMeasuredPath(vertices, !!path.closed)) return null;
  const lengthM = vertices.slice(1).reduce((total, v, i) => total + distance(vertices[i], v), 0)
    + (path.closed ? distance(vertices[vertices.length - 1], vertices[0]) : 0);
  if (!Number.isFinite(lengthM) || lengthM > 100000) return null;
  const areaM2 = path.closed ? polygonArea(vertices) : 0;
  if (path.closed && areaM2 < .01) return null;
  return { vertices, lengthM, areaM2, maxDeviationM };
}

function orientation(a: Vertex, b: Vertex, c: Vertex): number {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}
/** Reject self intersections and doubled-back spans, including touching a
 * non-adjacent vertex. Small curve chords are valid; no hidden grid rounding. */
export function isSimpleMeasuredPath(vertices: readonly Vertex[], closed = false): boolean {
  if (vertices.length < (closed ? 3 : 2) || vertices.length > MAX_PATH_VERTICES || !vertices.every(point)) return false;
  const count = vertices.length - (closed ? 0 : 1);
  const edge = (i: number) => [vertices[i], vertices[(i + 1) % vertices.length]] as const;
  for (let i = 0; i < count; i++) {
    const [a, b] = edge(i);
    if (distance(a, b) <= EPS) return false;
    const next = i + 1 < count ? edge(i + 1)[1] : closed ? vertices[1] : null;
    if (next && Math.abs(orientation(a, b, next)) < EPS
      && (b.x - a.x) * (next.x - b.x) + (b.y - a.y) * (next.y - b.y) < -EPS) return false;
    for (let j = i + 1; j < count; j++) {
      if (j === i + 1 || (closed && i === 0 && j === count - 1)) continue;
      const [c, d] = edge(j);
      if (Math.max(Math.min(a.x, b.x), Math.min(c.x, d.x)) > Math.min(Math.max(a.x, b.x), Math.max(c.x, d.x)) + EPS
        || Math.max(Math.min(a.y, b.y), Math.min(c.y, d.y)) > Math.min(Math.max(a.y, b.y), Math.max(c.y, d.y)) + EPS) continue;
      const abC = orientation(a, b, c), abD = orientation(a, b, d), cdA = orientation(c, d, a), cdB = orientation(c, d, b);
      if (abC * abD <= EPS * EPS && cdA * cdB <= EPS * EPS) return false;
    }
  }
  return true;
}

export function isSimpleMeasuredPolygon(value: unknown): value is Polygon {
  return Array.isArray(value) && isSimpleMeasuredPath(value, true) && polygonArea(value) >= .01;
}

export function measuredPathFromVertices(vertices: readonly Vertex[], closed = false): MeasuredPath | null {
  if (vertices.length < 2) return null;
  return { start: clone(vertices[0]), segments: vertices.slice(1).map(to => ({ kind: 'line', to: clone(to) })), ...(closed ? { closed: true } : {}) };
}
