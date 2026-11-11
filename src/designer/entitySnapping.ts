import {
  add,
  cross,
  detectFace,
  distance3,
  dot,
  faceLoop,
  norm,
  onFace,
  scale,
  subtract,
  type BoundaryComponent,
  type FaceGeometry,
  type Point3,
} from './boundaryModel.js';

export type SnapKind = 'endpoint' | 'intersection' | 'midpoint' | 'center' | 'on-face';
export interface EntitySnap {
  kind: SnapKind;
  point: Point3;
}
export interface SceneEdge {
  a: Point3;
  b: Point3;
}
export interface SnapIndex {
  vertices: Point3[];
  edges: SceneEdge[];
  faces: FaceGeometry[];
}
export function indexGeometry(
  components: readonly BoundaryComponent[],
  guideEdges: SceneEdge[] = [],
): SnapIndex {
  const vertices = components
    .flatMap((c) => c.vertices)
    .concat(guideEdges.flatMap((e) => [e.a, e.b]));
  const edges = components
    .flatMap((c) => c.edges.map(([a, b]) => ({ a: c.vertices[a], b: c.vertices[b] })))
    .concat(guideEdges);
  return {
    vertices,
    edges,
    faces: components.flatMap((c) => c.faces.map((loop) => detectFace(faceLoop(c, loop)))),
  };
}
function nearestOnEdge(p: Point3, e: SceneEdge): Point3 {
  const d = subtract(e.b, e.a),
    l = dot(d, d);
  return l ? add(e.a, scale(d, Math.max(0, Math.min(1, dot(subtract(p, e.a), d) / l)))) : e.a;
}
function crossing(a: SceneEdge, b: SceneEdge): Point3 | null {
  const u = subtract(a.b, a.a),
    v = subtract(b.b, b.a),
    n = cross(u, v),
    length = dot(n, n);
  if (length < 1e-16) return null;
  const w = subtract(b.a, a.a),
    t = dot(cross(w, v), n) / length,
    s = dot(cross(w, u), n) / length;
  if (t < 0 || t > 1 || s < 0 || s > 1) return null;
  const p = add(a.a, scale(u, t)),
    q = add(b.a, scale(v, s));
  return distance3(p, q) <= 0.0001 ? scale(add(p, q), 0.5) : null;
}
export function snapEntity(p: Point3, index: SnapIndex, toleranceM: number): EntitySnap | null {
  if (!Number.isFinite(toleranceM) || toleranceM <= 0) return null;
  const nearby = index.edges.filter((e) => distance3(p, nearestOnEdge(p, e)) <= toleranceM);
  const candidates: EntitySnap[] = [];
  function offer(kind: SnapKind, point: Point3) {
    if (distance3(point, p) <= toleranceM) candidates.push({ kind, point });
  }
  index.vertices.forEach((v) => offer('endpoint', v));
  for (let i = 0; i < nearby.length; i++) {
    const e = nearby[i];
    offer('midpoint', scale(add(e.a, e.b), 0.5));
    for (let j = i + 1; j < nearby.length; j++) {
      const v = crossing(e, nearby[j]);
      if (v) offer('intersection', v);
    }
  }
  for (const face of index.faces) if (onFace(face, face.centre)) offer('center', face.centre);
  const ranks: Record<SnapKind, number> = {
    endpoint: 0,
    intersection: 1,
    midpoint: 2,
    center: 3,
    'on-face': 4,
  };
  const closest = () =>
    candidates.sort(
      (a, b) =>
        Math.round(distance3(a.point, p) * 1e7) - Math.round(distance3(b.point, p) * 1e7) ||
        ranks[a.kind] - ranks[b.kind],
    )[0] ?? null;
  if (candidates.length) return closest();
  for (const f of index.faces) {
    const normalDistance = dot(subtract(p, f.points[0]), f.normal);
    if (Math.abs(normalDistance) > toleranceM) continue;
    const projected = subtract(p, scale(f.normal, normalDistance));
    if (onFace(f, projected)) offer('on-face', projected);
  }
  return closest();
}
export function polylineLength(points: readonly Point3[]): number {
  return points.slice(1).reduce((sum, p, i) => sum + norm(subtract(p, points[i])), 0);
}
