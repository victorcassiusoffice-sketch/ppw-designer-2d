/** Read-only lawn geometry: a real plot, or a modest border around the house. */
import { ShapeUtils, Vector2 } from 'three';
import type { Polygon, Vertex } from '../../lib/geometry';
import { gardenPoints, gardenSurfacePolygon, type Garden } from '../../designer/garden';

export interface GardenSite { widthM: number; depthM: number; originM: Vertex }
export interface LawnFootprint { boundary: Polygon; pieces: Polygon[]; areaM2: number }
export const HOUSE_LAWN_BORDER_M = 3;
const EPS = 1e-8;

function signedArea(polygon: readonly Vertex[]): number {
  return polygon.reduce((sum, p, i) => {
    const q = polygon[(i + 1) % polygon.length];
    return sum + p.x * q.y - q.x * p.y;
  }, 0) / 2;
}

function valid(polygon: readonly Vertex[]): boolean {
  return polygon.length >= 3 && polygon.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y)) && Math.abs(signedArea(polygon)) > EPS;
}

function bounds(polygon: readonly Vertex[]) {
  return { x0: Math.min(...polygon.map((p) => p.x)), y0: Math.min(...polygon.map((p) => p.y)), x1: Math.max(...polygon.map((p) => p.x)), y1: Math.max(...polygon.map((p) => p.y)) };
}

function halfPlane(polygon: Polygon, a: Vertex, b: Vertex, direction: number): Polygon {
  const out: Polygon = [];
  const distance = (p: Vertex) => direction * ((b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x));
  for (let i = 0; i < polygon.length; i++) {
    const p = polygon[i];
    const q = polygon[(i + 1) % polygon.length];
    const dp = distance(p);
    const dq = distance(q);
    const inP = dp >= -EPS;
    const inQ = dq >= -EPS;
    if (inP) out.push({ ...p });
    if (inP !== inQ && Math.abs(dp - dq) > EPS) {
      const t = dp / (dp - dq);
      out.push({ x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t });
    }
  }
  return out;
}

/** Convex subtraction yields disjoint convex pieces, including touching cuts. */
function subtractConvex(polygon: Polygon, cut: Polygon): Polygon[] {
  const a = bounds(polygon);
  const b = bounds(cut);
  if (a.x1 <= b.x0 + EPS || b.x1 <= a.x0 + EPS || a.y1 <= b.y0 + EPS || b.y1 <= a.y0 + EPS) return [polygon];
  const direction = signedArea(cut) > 0 ? 1 : -1;
  let remainder = polygon;
  const out: Polygon[] = [];
  for (let i = 0; i < cut.length; i++) {
    const from = cut[i];
    const to = cut[(i + 1) % cut.length];
    const outside = halfPlane(remainder, from, to, -direction);
    if (valid(outside)) out.push(outside);
    remainder = halfPlane(remainder, from, to, direction);
    if (!valid(remainder)) break;
  }
  return out;
}

/** Adjacent/overlapping rooms and arbitrary concave shapes do not create turf holes. */
export function lawnFootprint(occupied: readonly Polygon[], garden?: Garden, site?: GardenSite): LawnFootprint | null {
  const buildings = occupied.filter(valid);
  const points = buildings.length ? buildings.flat() : gardenPoints(garden);
  let extent: ReturnType<typeof bounds>;
  if (site && [site.widthM, site.depthM, site.originM.x, site.originM.y].every(Number.isFinite) && site.widthM > 0 && site.depthM > 0) {
    extent = { x0: site.originM.x, y0: site.originM.y, x1: site.originM.x + site.widthM, y1: site.originM.y + site.depthM };
  } else {
    if (!points.length) return null;
    const box = bounds(points);
    extent = { x0: box.x0 - HOUSE_LAWN_BORDER_M, y0: box.y0 - HOUSE_LAWN_BORDER_M, x1: box.x1 + HOUSE_LAWN_BORDER_M, y1: box.y1 + HOUSE_LAWN_BORDER_M };
  }
  const { x0, y0, x1, y1 } = extent;
  const boundary = [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }];
  let pieces = [boundary];
  // Every explicit patch owns its surface, including lawn. Nothing is saved,
  // replaced or priced by this automatic surround.
  for (const polygon of [...buildings, ...(garden?.surfaces.map(gardenSurfacePolygon) ?? [])]) {
    if (!valid(polygon)) continue;
    const vertices = polygon.map((p) => new Vector2(p.x, p.y));
    for (const triangle of ShapeUtils.triangulateShape(vertices, [])) {
      const cut = triangle.map((i) => polygon[i]);
      pieces = pieces.flatMap((piece) => subtractConvex(piece, cut));
    }
  }
  return { boundary, pieces, areaM2: pieces.reduce((sum, p) => sum + Math.abs(signedArea(p)), 0) };
}

/** Convex pieces triangulate as a fan, in plan metres, without approximating edges. */
export function lawnTriangles(footprint: LawnFootprint): Array<[Vertex, Vertex, Vertex]> {
  return footprint.pieces.flatMap((polygon) => polygon.slice(1, -1)
    .map((p, i): [Vertex, Vertex, Vertex] => [polygon[0], p, polygon[i + 2]])
    .filter((triangle) => Math.abs(signedArea(triangle)) > EPS));
}
