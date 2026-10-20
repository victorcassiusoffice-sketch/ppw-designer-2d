import type { Property } from '../store/propertyStore';
import { foundationVolumeM3 } from './foundation';
import type { Vertex } from '../lib/geometry';
import type { MaterialsGeometry, MaterialsSettings, MaterialWallInput } from './materials';
import { activeLevelIdOf, isOutdoorRoom, isRoofRoom, roomLevelId } from './levels';
import { roofSourceRooms } from './roof';
import { roofOutline } from './roofSurface';
import { levelHeightM, roofConfigOf } from './building';
import { pointAlongEdge, roomEdges } from './wallEdges';
import { openingProfileUnionAreaM2 } from './openingGeometry';
import type { Opening } from './openings';
import type { ConstructedEdge, WallMaterialSpec } from './wallConstruction';

const EPS = 1e-7;
type Interval = [number, number];
function unionLength(intervals: Interval[]): number {
  let total = 0, end = -Infinity;
  for (const [a, b] of intervals.sort((p, q) => p[0] - q[0])) {
    total += Math.max(0, b - Math.max(a, end));
    end = Math.max(end, b);
  }
  return total;
}
/** Exact vertical sweep of simple polygon unions, including overlap and concave rooms.
 * Edge intersections split every change in interval ordering; union length is linear
 * inside each strip, so midpoint integration is exact (within floating point error).
 */
export function footprintUnionArea(polygons: readonly (readonly Vertex[])[]): number {
  const valid = polygons.filter(p => p.length >= 3 && p.every(v => Number.isFinite(v.x) && Number.isFinite(v.y)));
  const edges = valid.flatMap(p => p.map((a, i) => ({ a, b: p[(i + 1) % p.length] })));
  const breaks = edges.map(e => e.a.x);
  for (let i = 0; i < edges.length; i++) for (let j = i + 1; j < edges.length; j++) {
    const { a, b } = edges[i], { a: c, b: d } = edges[j];
    const ux = b.x - a.x, uy = b.y - a.y, vx = d.x - c.x, vy = d.y - c.y;
    const cross = ux * vy - uy * vx;
    if (Math.abs(cross) < EPS) continue;
    const t = ((c.x - a.x) * vy - (c.y - a.y) * vx) / cross;
    const s = ((c.x - a.x) * uy - (c.y - a.y) * ux) / cross;
    if (t > 0 && t < 1 && s > 0 && s < 1) breaks.push(a.x + t * ux);
  }
  const xs = [...new Set(breaks)].sort((a, b) => a - b);
  let area = 0;
  for (let i = 1; i < xs.length; i++) {
    const width = xs[i] - xs[i - 1];
    if (width < EPS) continue;
    const x = (xs[i] + xs[i - 1]) / 2;
    const intervals: Interval[] = [];
    for (const polygon of valid) {
      const ys: number[] = [];
      polygon.forEach((a, k) => {
        const b = polygon[(k + 1) % polygon.length];
        if (x > Math.min(a.x, b.x) && x < Math.max(a.x, b.x)) ys.push(a.y + (x - a.x) * (b.y - a.y) / (b.x - a.x));
      });
      ys.sort((a, b) => a - b);
      for (let k = 1; k < ys.length; k += 2) intervals.push([ys[k - 1], ys[k]]);
    }
    area += width * unionLength(intervals);
  }
  return area;
}

type Wall = { a: Vertex; b: Vertex; level: string; height: number; material?: Pick<ConstructedEdge, 'kind'> & WallMaterialSpec; openings: Array<{ centre: Vertex; opening: Opening }> };
/** Measurement adapter: a shared wall and mirrored opening count only once per floor.
 * Bases use the ground footprint; the roof uses the top storey's union, excluding
 * courtyard gaps. Roof penetrations are not modelled yet: use the area override.
 */
export function propertyMaterialsGeometry(property: Property, scope: MaterialsSettings['scope'] = 'all'): MaterialsGeometry {
  const rooms = property.rooms.filter(r => !isOutdoorRoom(r) && !isRoofRoom(r));
  const active = activeLevelIdOf(property);
  const walls: Wall[] = [];
  for (const room of rooms) {
    const level = roomLevelId(room);
    if (scope === 'active' && level !== active) continue;
    const height = levelHeightM(property, level);
    for (const edge of roomEdges(room)) {
      if (edge.lengthM < EPS) continue;
      walls.push({ a: edge.a, b: edge.b, level, height, material: room.wallConstruction?.find(e => e.edgeIndex === edge.index), openings: (room.openings ?? []).filter(o => o.edgeIndex === edge.index).flatMap(o => {
        if (!Number.isFinite(o.offsetM) || !Number.isFinite(o.widthM) || o.widthM <= 0) return [];
        const start = Math.max(0, Math.min(edge.lengthM, o.offsetM - o.widthM / 2));
        const end = Math.max(0, Math.min(edge.lengthM, o.offsetM + o.widthM / 2));
        if (end - start < EPS) return [];
        // RoomEdge.dx/dy are unit vectors; pointAlongEdge takes metres.
        // Dividing by the edge length again shrank every opening deduction.
        return [{ centre: pointAlongEdge(edge, o.offsetM), opening: o }];
      }) });
    }
  }
  for (const wall of property.walls ?? []) {
    const level = roomLevelId(wall);
    if (scope !== 'active' || level === active) walls.push({ a: wall.a, b: wall.b, level, height: levelHeightM(property, level), material: wall.construction ? { kind: wall.construction, thicknessMm: wall.thicknessM * 1000, materialProductId: wall.materialProductId } : undefined, openings: [] });
  }
  const groups: Array<{ origin: Vertex; ux: number; uy: number; level: string; walls: Wall[] }> = [];
  for (const wall of walls) {
    const length = Math.hypot(wall.b.x - wall.a.x, wall.b.y - wall.a.y);
    if (length < EPS) continue;
    let ux = (wall.b.x - wall.a.x) / length, uy = (wall.b.y - wall.a.y) / length;
    if (ux < -EPS || (Math.abs(ux) < EPS && uy < 0)) { ux = -ux; uy = -uy; }
    const group = groups.find(g => g.level === wall.level && Math.abs(g.ux * uy - g.uy * ux) < 1e-7 && Math.abs((wall.a.x - g.origin.x) * g.uy - (wall.a.y - g.origin.y) * g.ux) < 1e-3);
    if (group) group.walls.push(wall); else groups.push({ origin: wall.a, ux, uy, level: wall.level, walls: [wall] });
  }
  const measured: MaterialWallInput[] = [];
  groups.forEach((group, gi) => {
    const project = (p: Vertex) => (p.x - group.origin.x) * group.ux + (p.y - group.origin.y) * group.uy;
    const spans = group.walls.map(w => ({ lo: Math.min(project(w.a), project(w.b)), hi: Math.max(project(w.a), project(w.b)), height: w.height, material: w.material }));
    const openings = group.walls.flatMap(w => w.openings.map(o => ({ ...o.opening, offsetM: project(o.centre) })));
    const xs = [...new Set([...spans.flatMap(s => [s.lo, s.hi]), ...openings.flatMap(o => [o.offsetM - o.widthM / 2, o.offsetM + o.widthM / 2])])].sort((a, b) => a - b);
    for (let i = 1; i < xs.length; i++) {
      const mid = (xs[i - 1] + xs[i]) / 2, lengthM = xs[i] - xs[i - 1];
      const covering = spans.filter(s => s.lo <= mid && s.hi >= mid);
      if (!covering.length || lengthM < EPS) continue;
      const heightM = Math.max(...covering.map(s => s.height));
      const openingAreaM2 = openingProfileUnionAreaM2(openings, heightM, [{ t0: xs[i - 1], t1: xs[i] }]);
      const material = covering.find(s => s.material?.kind === 'glass')?.material ?? covering.find(s => s.material)?.material;
      measured.push({ id: `wall-${gi}-${i}`, levelId: group.level, lengthM, heightM, openingAreaM2,
        ...(material ? { construction: material.kind, thicknessM: material.thicknessMm ? material.thicknessMm / 1000 : undefined, materialProductId: material.materialProductId } : {}) });
    }
  });
  const roofConfig = property.roof ? roofConfigOf(property) : null;
  const roofBasePolygons = roofConfig?.outline ? [roofConfig.outline] : roofSourceRooms(property).map(r => r.polygon);
  const roofPolygons = roofConfig ? roofBasePolygons.map(polygon => roofOutline(polygon, roofConfig.overhangM)) : roofBasePolygons;
  const points = roofPolygons.flat();
  const boundsX = points.length ? Math.max(...points.map(p => p.x)) - Math.min(...points.map(p => p.x)) : 0;
  const boundsY = points.length ? Math.max(...points.map(p => p.y)) - Math.min(...points.map(p => p.y)) : 0;
  const roofAreaM2 = footprintUnionArea(roofPolygons);
  // The rendered mono/gable slope runs across the shorter plan dimension.
  const roofLengthM = roofConfig ? Math.max(boundsX, boundsY) : boundsX;
  const roofWidthM = roofConfig ? Math.min(boundsX, boundsY) : boundsY;
  const roofProfile = roofConfig ? { pitchDeg: roofConfig.style === 'flat' ? 0 : roofConfig.pitchDeg,
    slopes: roofConfig.style === 'gable' ? 2 as const : 1 as const, overhangIncluded: true as const } : undefined;
  return { ...(property.foundation?.enabled ? { foundationVolumeM3: foundationVolumeM3(property.foundation) } : {}), walls: measured, ...(roofProfile ? { roofProfile } : {}), baseAreaM2: footprintUnionArea(rooms.filter(r => roomLevelId(r) === 'ground').map(r => r.polygon)), roofAreaM2, roofLengthM, roofWidthM, roofRectangular: Math.abs(roofAreaM2 - roofLengthM * roofWidthM) < 1e-5 };
}
