/** Coordinates are metres. X and Y are plan coordinates; positive Z is elevation. */
export interface Point3 {
  x: number;
  y: number;
  z: number;
}
export interface BoundaryComponent {
  id: string;
  name: string;
  vertices: Point3[];
  edges: [number, number][];
  /** Signed, one-based edge references. A negative reference traverses the edge backwards. */
  faces: number[][];
}
export type WorkPlane = 'XY' | 'XZ' | 'YZ';
export const PLANE_TOLERANCE_M = 0.0001;
export const MAX_COMPONENTS = 128;
const EPS = 1e-8;
export const subtract = (a: Point3, b: Point3): Point3 => ({
  x: a.x - b.x,
  y: a.y - b.y,
  z: a.z - b.z,
});
export const add = (a: Point3, b: Point3): Point3 => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
export const scale = (p: Point3, n: number): Point3 => ({ x: p.x * n, y: p.y * n, z: p.z * n });
export const dot = (a: Point3, b: Point3) => a.x * b.x + a.y * b.y + a.z * b.z;
export const cross = (a: Point3, b: Point3): Point3 => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x,
});
export const norm = (p: Point3) => Math.hypot(p.x, p.y, p.z);
export const distance3 = (a: Point3, b: Point3) => norm(subtract(a, b));
export function validPoint(p: unknown): p is Point3 {
  if (!p || typeof p !== 'object') return false;
  return ['x', 'y', 'z'].every((key) => {
    const value = (p as Record<string, unknown>)[key];
    return typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= 100000;
  });
}
export function flatten(p: Point3, plane: WorkPlane): { x: number; y: number } {
  if (plane === 'XY') return { x: p.x, y: p.y };
  if (plane === 'XZ') return { x: p.z, y: p.x };
  return { x: p.y, y: p.z };
}
interface Flat {
  x: number;
  y: number;
}
function orient(a: Flat, b: Flat, c: Flat) {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}
function onSegment(a: Flat, b: Flat, p: Flat) {
  return (
    Math.abs(orient(a, b, p)) <= EPS &&
    p.x >= Math.min(a.x, b.x) - EPS &&
    p.x <= Math.max(a.x, b.x) + EPS &&
    p.y >= Math.min(a.y, b.y) - EPS &&
    p.y <= Math.max(a.y, b.y) + EPS
  );
}
function intersects(a: Flat, b: Flat, c: Flat, d: Flat) {
  if (onSegment(a, b, c) || onSegment(a, b, d) || onSegment(c, d, a) || onSegment(c, d, b))
    return true;
  return orient(a, b, c) > 0 !== orient(a, b, d) > 0 && orient(c, d, a) > 0 !== orient(c, d, b) > 0;
}
export interface FaceGeometry {
  points: Point3[];
  normal: Point3;
  plane: WorkPlane;
  area: number;
  centre: Point3;
  winding: 'CW' | 'CCW';
}
export function detectFace(source: readonly Point3[]): FaceGeometry {
  const points = [...source];
  if (
    points.length > 1 &&
    validPoint(points[0]) &&
    validPoint(points[points.length - 1]) &&
    distance3(points[0], points[points.length - 1]) <= EPS
  )
    points.pop();
  if (points.length < 3 || points.length > 128 || !points.every(validPoint))
    throw Error('Use 3 to 128 finite XYZ vertices.');
  const origin = points[0];
  const offset = points.map((p) => subtract(p, origin));
  let vector: Point3 = { x: 0, y: 0, z: 0 };
  for (let i = 0; i < points.length; i++) {
    if (points.slice(i + 1).some((p) => distance3(p, points[i]) < PLANE_TOLERANCE_M))
      throw Error('The loop contains repeated vertices.');
    vector = add(vector, cross(offset[i], offset[(i + 1) % points.length]));
  }
  const twiceArea = norm(vector);
  if (twiceArea < EPS) throw Error('The edges must enclose a face with nonzero area.');
  const normal = scale(vector, 1 / twiceArea);
  if (offset.some((p) => Math.abs(dot(p, normal)) > PLANE_TOLERANCE_M))
    throw Error('The loop is not coplanar.');
  const largest = Math.max(Math.abs(normal.x), Math.abs(normal.y), Math.abs(normal.z));
  const plane: WorkPlane =
    largest === Math.abs(normal.z) ? 'XY' : largest === Math.abs(normal.y) ? 'XZ' : 'YZ';
  const flat = offset.map((p) => flatten(p, plane));
  for (let i = 0; i < flat.length; i++) {
    const next = (i + 1) % flat.length;
    const prev = (i + flat.length - 1) % flat.length;
    if (onSegment(flat[prev], flat[i], flat[next]) || onSegment(flat[i], flat[next], flat[prev]))
      throw Error('Consecutive edges overlap.');
    for (let j = i + 1; j < flat.length; j++) {
      const end = (j + 1) % flat.length;
      if (j !== next && end !== i && intersects(flat[i], flat[next], flat[j], flat[end]))
        throw Error('The face boundary crosses itself.');
    }
  }
  let moment: Point3 = { x: 0, y: 0, z: 0 };
  for (let i = 1; i + 1 < offset.length; i++) {
    const weight = dot(cross(offset[i], offset[i + 1]), normal);
    moment = add(moment, scale(add(offset[i], offset[i + 1]), weight));
  }
  const sense = plane === 'XY' ? normal.z : plane === 'XZ' ? normal.y : normal.x;
  return {
    points,
    normal,
    plane,
    area: twiceArea / 2,
    centre: add(origin, scale(moment, 1 / (3 * twiceArea))),
    winding: sense > 0 ? 'CCW' : 'CW',
  };
}
export function onFace(face: FaceGeometry, p: Point3): boolean {
  const q = flatten(p, face.plane),
    poly = face.points.map((v) => flatten(v, face.plane));
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[j],
      b = poly[i];
    if (onSegment(a, b, q)) return true;
    if (a.y > q.y !== b.y > q.y && q.x < ((b.x - a.x) * (q.y - a.y)) / (b.y - a.y) + a.x)
      inside = !inside;
  }
  return inside;
}
export function faceLoop(component: BoundaryComponent, refs: number[]): Point3[] {
  if (refs.length < 3 || refs.length > 128) throw Error('Invalid face loop.');
  const indices = refs.map((ref) => {
    if (!Number.isInteger(ref) || ref === 0) throw Error('Invalid edge reference.');
    const edge = component.edges[Math.abs(ref) - 1];
    if (!edge) throw Error('Missing edge.');
    return ref > 0 ? edge : [edge[1], edge[0]];
  });
  if (indices.some((e, i) => e[1] !== indices[(i + 1) % indices.length][0]))
    throw Error('Face edges do not form a closed loop.');
  return indices.map((e) => component.vertices[e[0]]);
}
export function appendFace(
  component: BoundaryComponent,
  points: readonly Point3[],
): BoundaryComponent {
  const face = detectFace(points);
  const vertices = [...component.vertices],
    edges = [...component.edges];
  const ids = face.points.map((p) => {
    const existing = vertices.findIndex((v) => distance3(v, p) < PLANE_TOLERANCE_M);
    return existing >= 0 ? existing : vertices.push({ ...p }) - 1;
  });
  const refs = ids.map((a, i) => {
    const b = ids[(i + 1) % ids.length];
    const e = edges.findIndex(([s, t]) => (s === a && t === b) || (s === b && t === a));
    if (e >= 0) return edges[e][0] === a ? e + 1 : -(e + 1);
    return edges.push([a, b]);
  });
  const key = (list: number[]) =>
    list
      .map(Math.abs)
      .sort((a, b) => a - b)
      .join(',');
  if (component.faces.some((f) => key(f) === key(refs))) throw Error('This face already exists.');
  const next = { ...component, vertices, edges, faces: [...component.faces, refs] };
  detectFace(faceLoop(next, refs));
  if (vertices.length > 512 || edges.length > 1024 || next.faces.length > 256)
    throw Error('Component limit reached.');
  return next;
}
export function appendWire(
  component: BoundaryComponent,
  points: readonly Point3[],
): BoundaryComponent {
  if (points.length < 2 || points.length > 128 || !points.every(validPoint))
    throw Error('An edge needs at least two measured points.');
  const vertices = [...component.vertices],
    edges = [...component.edges];
  const ids = points.map((p) => {
    const i = vertices.findIndex((v) => distance3(v, p) <= PLANE_TOLERANCE_M);
    return i >= 0 ? i : vertices.push({ ...p }) - 1;
  });
  for (let i = 1; i < ids.length; i++) {
    const a = ids[i - 1],
      b = ids[i];
    if (a === b) throw Error('An edge needs distinct endpoints.');
    if (!edges.some(([s, t]) => (s === a && t === b) || (s === b && t === a))) edges.push([a, b]);
  }
  return { ...component, vertices, edges };
}
export function validComponents(raw: unknown): raw is BoundaryComponent[] {
  if (!Array.isArray(raw) || raw.length > MAX_COMPONENTS) return false;
  const ids = new Set<string>();
  let remainingEdges = 8192;
  let remainingFaceRefs = 12288;
  try {
    return raw.every((c: BoundaryComponent) => {
      if (
        !c ||
        Object.keys(c).some((key) => !['id', 'name', 'vertices', 'edges', 'faces'].includes(key)) ||
        typeof c.id !== 'string' ||
        !/^[a-zA-Z0-9_-]{1,96}$/.test(c.id) ||
        ids.has(c.id) ||
        typeof c.name !== 'string' ||
        !c.name.trim() ||
        c.name.length > 80
      )
        return false;
      ids.add(c.id);
      if (!Array.isArray(c.edges) || !Array.isArray(c.faces) || c.faces.length > 256) return false;
      remainingEdges -= c.edges.length;
      for (const face of c.faces) {
        if (!Array.isArray(face) || face.length > 128) return false;
        remainingFaceRefs -= face.length;
      }
      if (remainingEdges < 0 || remainingFaceRefs < 0) return false;
      if (
        !Array.isArray(c.vertices) ||
        c.vertices.length > 512 ||
        !c.vertices.every(validPoint) ||
        !Array.isArray(c.edges) ||
        c.edges.length > 1024
      )
        return false;
      if (
        !c.edges.every(
          (e) =>
            Array.isArray(e) &&
            e.length === 2 &&
            e[0] !== e[1] &&
            e.every((i) => Number.isInteger(i) && i >= 0 && i < c.vertices.length),
        )
      )
        return false;
      return (
        Array.isArray(c.faces) &&
        c.edges.length > 0 &&
        c.faces.length <= 256 &&
        c.faces.every((refs) => !!detectFace(faceLoop(c, refs)))
      );
    });
  } catch {
    return false;
  }
}
export function rayPlane(
  origin: Point3,
  direction: Point3,
  at: Point3,
  normal: Point3,
): Point3 | null {
  const d = dot(direction, normal);
  if (Math.abs(d) < EPS) return null;
  const t = dot(subtract(at, origin), normal) / d;
  return t >= 0 ? add(origin, scale(direction, t)) : null;
}
