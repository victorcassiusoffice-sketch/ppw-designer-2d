import type { Vertex } from '../lib/geometry';
import { polygonArea } from '../lib/geometry';
import type { Property, Room } from '../store/propertyStore';
import type { FreeWall } from './freeWalls';
import { syncRoofRooms } from './roof';
import { parsePlanDxf } from './planImportDxf';
import { parsePlanSvg } from './planImportSvg';

export const PLAN_IMPORT_LIMITS = {
  bytes: 2_000_000,
  shapes: 2500,
  vertices: 12_000,
  layers: 80,
  rooms: 150,
  walls: 1500,
  storeys: 12,
} as const;
export type PlanUnit = 'mm' | 'cm' | 'm' | 'in' | 'ft';
export const PLAN_UNITS: Record<PlanUnit, { label: string; metres: number }> = {
  mm: { label: 'Millimetres', metres: 0.001 },
  cm: { label: 'Centimetres', metres: 0.01 },
  m: { label: 'Metres', metres: 1 },
  in: { label: 'Inches', metres: 0.0254 },
  ft: { label: 'Feet', metres: 0.3048 },
};
export interface PlanImportShape {
  id: string;
  layer: string;
  points: Vertex[];
  closed: boolean;
}
export interface PlanImportSource {
  format: 'dxf' | 'svg';
  name: string;
  shapes: PlanImportShape[];
  warnings: string[];
  suggestedUnit?: PlanUnit;
  metresPerUnit?: number;
}
export interface PlanImportLayer {
  name: string;
  role: 'rooms' | 'walls' | 'skip';
  floor: number;
}
export interface PlanImportOptions {
  name: string;
  metresPerUnit: number;
  wallHeightM: number;
  wallThicknessM: number;
  layers: PlanImportLayer[];
}
export interface PlanImportReview {
  property: Property;
  warnings: string[];
  roomCount: number;
  wallCount: number;
  widthM: number;
  depthM: number;
  areaM2: number;
}

/** Only explicit exchange formats enter this parser. Input stays on this device. */
export function parsePlanFile(name: string, text: string): PlanImportSource {
  if (new TextEncoder().encode(text).length > PLAN_IMPORT_LIMITS.bytes)
    throw new Error('Use a plan export smaller than 2 MB.');
  const extension = name.split('.').pop()?.toLowerCase();
  const source =
    extension === 'dxf' ? parsePlanDxf(text) : extension === 'svg' ? parsePlanSvg(text) : null;
  if (!source)
    throw new Error(
      'Export a 2D plan as ASCII DXF or SVG. Native DWG, RVT, SKP, IFC, PDFs and photos are not converted here.',
    );
  if (!source.shapes.length)
    throw new Error(
      'No supported plan geometry found. Export room outlines or straight wall centre lines, with blocks exploded.',
    );
  if (
    source.shapes.length > PLAN_IMPORT_LIMITS.shapes ||
    source.shapes.reduce((n, s) => n + s.points.length, 0) > PLAN_IMPORT_LIMITS.vertices
  )
    throw new Error(
      'This export is too detailed. Export only room boundaries and wall centre lines.',
    );
  if (new Set(source.shapes.map((s) => s.layer)).size > PLAN_IMPORT_LIMITS.layers)
    throw new Error('Export fewer than 80 plan layers.');
  for (const shape of source.shapes)
    if (
      shape.points.some(
        (p) =>
          !Number.isFinite(p.x) ||
          !Number.isFinite(p.y) ||
          Math.abs(p.x) > 1e10 ||
          Math.abs(p.y) > 1e10,
      )
    )
      throw new Error('The drawing contains invalid or excessively large coordinates.');
  return { ...source, name: name.replace(/\.[^.]+$/, '').slice(0, 100) || 'Imported plan' };
}

/** Auto-suggestions are always exposed for review; annotation layers stay off. */
export function suggestPlanLayers(source: PlanImportSource): PlanImportLayer[] {
  return [...new Set(source.shapes.map((s) => s.layer))].map((name) => {
    const annotation =
      /furn|door|window|glaz|dim|annot|text|hatch|grid|symbol|sheet|border|title|elect|plumb|sanit/i.test(
        name,
      );
    const closed = source.shapes.some((s) => s.layer === name && s.closed);
    return {
      name,
      role: annotation
        ? 'skip'
        : closed || /room|area|space/i.test(name)
          ? 'rooms'
          : /wall|partition/i.test(name)
            ? 'walls'
            : 'skip',
      floor: 0,
    };
  });
}

const EPS = 1e-6;
const distance = (a: Vertex, b: Vertex) => Math.hypot(a.x - b.x, a.y - b.y);
const cross = (a: Vertex, b: Vertex, c: Vertex) =>
  (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
function onSegment(a: Vertex, b: Vertex, p: Vertex): boolean {
  return (
    Math.abs(cross(a, b, p)) < EPS &&
    p.x >= Math.min(a.x, b.x) - EPS &&
    p.x <= Math.max(a.x, b.x) + EPS &&
    p.y >= Math.min(a.y, b.y) - EPS &&
    p.y <= Math.max(a.y, b.y) + EPS
  );
}
function intersects(a: Vertex, b: Vertex, c: Vertex, d: Vertex): boolean {
  const ac = cross(a, b, c),
    ad = cross(a, b, d),
    ca = cross(c, d, a),
    cb = cross(c, d, b);
  return (
    (((ac > EPS && ad < -EPS) || (ac < -EPS && ad > EPS)) &&
      ((ca > EPS && cb < -EPS) || (ca < -EPS && cb > EPS))) ||
    onSegment(a, b, c) ||
    onSegment(a, b, d) ||
    onSegment(c, d, a) ||
    onSegment(c, d, b)
  );
}
function cleanPoints(input: Vertex[], closed: boolean): Vertex[] {
  const points = input.filter((p, i) => !i || distance(p, input[i - 1]) > EPS);
  if (closed && points.length > 1 && distance(points[0], points[points.length - 1]) < EPS)
    points.pop();
  // Collinear intermediate vertices can exceed renderer limits without changing a boundary.
  let changed = true;
  while (changed && points.length > (closed ? 3 : 2)) {
    changed = false;
    for (let i = closed ? 0 : 1; i < (closed ? points.length : points.length - 1); i++) {
      const prev = points[(i - 1 + points.length) % points.length],
        next = points[(i + 1) % points.length];
      if (onSegment(prev, next, points[i])) {
        points.splice(i, 1);
        changed = true;
        break;
      }
    }
  }
  return points;
}
function validateBoundary(points: Vertex[]): void {
  if (points.length < 3 || points.length > 200 || polygonArea(points) < 0.05)
    throw new Error(
      'A room boundary is too small or complex. Use simple closed outlines (3–200 corners).',
    );
  for (let i = 0; i < points.length; i++)
    for (let j = i + 1; j < points.length; j++) {
      if (j === i + 1 || (i === 0 && j === points.length - 1)) continue;
      if (
        intersects(
          points[i],
          points[(i + 1) % points.length],
          points[j],
          points[(j + 1) % points.length],
        )
      )
        throw new Error(
          'A room outline crosses or touches itself. Repair that boundary in the source drawing.',
        );
    }
}

/** Join only degree-two line networks: branches, gaps and ambiguous walls never invent rooms. */
function closedLineLoops(shapes: PlanImportShape[]): { loops: Vertex[][]; unclosed: number } {
  const key = (p: Vertex) => `${Math.round(p.x / EPS)},${Math.round(p.y / EPS)}`;
  const nodes = new Map<string, { point: Vertex; edges: number[] }>();
  const edges: { a: string; b: string }[] = [];
  const seen = new Set<string>();
  for (const shape of shapes)
    for (let i = 1; i < shape.points.length; i++) {
      const a = key(shape.points[i - 1]),
        b = key(shape.points[i]);
      if (a === b) continue;
      const edgeKey = [a, b].sort().join('|');
      if (seen.has(edgeKey)) continue;
      seen.add(edgeKey);
      for (const [id, point] of [
        [a, shape.points[i - 1]],
        [b, shape.points[i]],
      ] as const) {
        if (!nodes.has(id)) nodes.set(id, { point, edges: [] });
        nodes.get(id)!.edges.push(edges.length);
      }
      edges.push({ a, b });
    }
  const visited = new Set<number>(),
    loops: Vertex[][] = [];
  let unclosed = 0;
  for (let start = 0; start < edges.length; start++) {
    if (visited.has(start)) continue;
    const component: number[] = [],
      queue = [start],
      nodeIds = new Set<string>();
    while (queue.length) {
      const id = queue.pop()!;
      if (visited.has(id)) continue;
      visited.add(id);
      component.push(id);
      for (const p of [edges[id].a, edges[id].b]) {
        nodeIds.add(p);
        for (const next of nodes.get(p)!.edges) if (!visited.has(next)) queue.push(next);
      }
    }
    if ([...nodeIds].some((n) => nodes.get(n)!.edges.length !== 2)) {
      unclosed += component.length;
      continue;
    }
    const points: Vertex[] = [];
    let node = edges[start].a,
      previous = -1;
    for (let count = 0; count < component.length; count++) {
      points.push(nodes.get(node)!.point);
      const edge = nodes.get(node)!.edges.find((e) => e !== previous)!;
      node = edges[edge].a === node ? edges[edge].b : edges[edge].a;
      previous = edge;
    }
    loops.push(points);
  }
  return { loops, unclosed };
}

function strictlyInside(p: Vertex, polygon: Vertex[]): boolean {
  if (polygon.some((a, i) => onSegment(a, polygon[(i + 1) % polygon.length], p))) return false;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i],
      b = polygon[j];
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x)
      inside = !inside;
  }
  return inside;
}
function roomOverlap(a: Vertex[], b: Vertex[]): boolean {
  const bounds = (p: Vertex[]) => ({
    minX: Math.min(...p.map((v) => v.x)),
    maxX: Math.max(...p.map((v) => v.x)),
    minY: Math.min(...p.map((v) => v.y)),
    maxY: Math.max(...p.map((v) => v.y)),
  });
  const ab = bounds(a),
    bb = bounds(b);
  if (
    ab.maxX <= bb.minX + EPS ||
    bb.maxX <= ab.minX + EPS ||
    ab.maxY <= bb.minY + EPS ||
    bb.maxY <= ab.minY + EPS
  )
    return false;
  const samples = (p: Vertex[]) =>
    p.flatMap((v, i) => [
      v,
      { x: (v.x + p[(i + 1) % p.length].x) / 2, y: (v.y + p[(i + 1) % p.length].y) / 2 },
    ]);
  if (samples(a).some((p) => strictlyInside(p, b)) || samples(b).some((p) => strictlyInside(p, a)))
    return true;
  for (let i = 0; i < a.length; i++)
    for (let j = 0; j < b.length; j++) {
      const p = a[i],
        q = a[(i + 1) % a.length],
        r = b[j],
        s = b[(j + 1) % b.length];
      const u = cross(p, q, r),
        v = cross(p, q, s),
        w = cross(r, s, p),
        x = cross(r, s, q);
      if (
        ((u > EPS && v < -EPS) || (u < -EPS && v > EPS)) &&
        ((w > EPS && x < -EPS) || (w < -EPS && x > EPS))
      )
        return true;
    }
  // Coincident polygons have no strictly-inside vertices.
  return (
    a.every((p) => b.some((v, i) => onSegment(v, b[(i + 1) % b.length], p))) &&
    b.every((p) => a.some((v, i) => onSegment(v, a[(i + 1) % a.length], p)))
  );
}

export function reviewPlanImport(
  source: PlanImportSource,
  options: PlanImportOptions,
): PlanImportReview {
  const { metresPerUnit: scale, wallHeightM: height, wallThicknessM: thickness } = options;
  if (!Number.isFinite(scale) || scale <= 0 || scale > 1e6)
    throw new Error('Confirm valid drawing units or calibrate a known dimension.');
  if (!Number.isFinite(height) || height < 2 || height > 6)
    throw new Error('Wall height must be between 2 and 6 m.');
  if (!Number.isFinite(thickness) || thickness < 0.05 || thickness > 0.6)
    throw new Error('Wall thickness must be between 0.05 and 0.6 m.');
  const selected = options.layers.filter((l) => l.role !== 'skip');
  if (!selected.length)
    throw new Error('Choose at least one layer as room boundaries or wall centre lines.');
  if (
    selected.some(
      (l) => !Number.isInteger(l.floor) || l.floor < 0 || l.floor >= PLAN_IMPORT_LIMITS.storeys,
    )
  )
    throw new Error('Assign a floor between Ground and Floor 11.');
  const all = source.shapes
    .filter((s) => selected.some((l) => l.name === s.layer))
    .flatMap((s) => s.points);
  if (!all.length) throw new Error('The selected layers have no supported geometry.');
  const minX = Math.min(...all.map((p) => p.x)),
    minY = Math.min(...all.map((p) => p.y));
  const widthM = (Math.max(...all.map((p) => p.x)) - minX) * scale,
    depthM = (Math.max(...all.map((p) => p.y)) - minY) * scale;
  if (
    !Number.isFinite(widthM) ||
    !Number.isFinite(depthM) ||
    Math.max(widthM, depthM) > 500 ||
    Math.max(widthM, depthM) < 0.1
  )
    throw new Error('The plan size is outside 0.1–500 m. Check units and calibration.');
  const stamp =
    globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const rooms: Room[] = [],
    walls: FreeWall[] = [],
    warnings = [...source.warnings];
  const floorId = (floor: number) => (floor === 0 ? 'ground' : `import-floor-${floor}`);
  const seenWalls = new Set<string>();
  const pointKey = (p: Vertex) => `${p.x.toFixed(6)},${p.y.toFixed(6)}`;
  for (const layer of selected) {
    const shapes = source.shapes
      .filter((s) => s.layer === layer.name)
      .map((s) => ({
        ...s,
        points: cleanPoints(
          s.points.map((p) => ({ x: (p.x - minX) * scale, y: (p.y - minY) * scale })),
          s.closed,
        ),
      }));
    if (layer.role === 'rooms') {
      const traced = closedLineLoops(shapes.filter((s) => !s.closed));
      if (traced.unclosed)
        warnings.push(
          `${layer.name}: ${traced.unclosed} open or branched segments were not converted into rooms. Assign the layer as walls to retain open runs.`,
        );
      const polygons = [
        ...shapes.filter((s) => s.closed).map((s) => s.points),
        ...traced.loops.map((p) => cleanPoints(p, true)),
      ];
      for (const polygon of polygons) {
        if (rooms.length >= PLAN_IMPORT_LIMITS.rooms)
          throw new Error('Use fewer than 150 room outlines per import.');
        validateBoundary(polygon);
        if (
          rooms.some((r) => r.levelId === floorId(layer.floor) && roomOverlap(polygon, r.polygon))
        )
          throw new Error(
            `Overlapping or nested room outlines on ${layer.name}. Select room boundaries only, excluding wall faces, furniture and the outer building outline.`,
          );
        rooms.push({
          id: `import-${stamp}-room-${rooms.length}`,
          name: `${layer.name === '0' || layer.name === 'Plan' ? 'Room' : layer.name} ${rooms.filter((r) => r.levelId === floorId(layer.floor)).length + 1}`.slice(
            0,
            80,
          ),
          levelId: floorId(layer.floor),
          polygon,
          placedItems: [],
          openings: [],
        });
      }
    } else
      for (const shape of shapes) {
        const points = shape.closed ? [...shape.points, shape.points[0]] : shape.points;
        for (let i = 1; i < points.length; i++) {
          const a = points[i - 1],
            b = points[i];
          if (!a || !b || distance(a, b) < 0.01) continue;
          const key = `${layer.floor}:${[pointKey(a), pointKey(b)].sort().join('|')}`;
          if (seenWalls.has(key)) continue;
          seenWalls.add(key);
          walls.push({
            id: `import-${stamp}-wall-${walls.length}`,
            a,
            b,
            levelId: floorId(layer.floor),
            thicknessM: thickness,
          });
        }
      }
  }
  let duplicateBoundaryWalls = 0;
  for (let i = walls.length - 1; i >= 0; i--) {
    const wall = walls[i];
    if (
      rooms.some(
        (room) =>
          room.levelId === wall.levelId &&
          room.polygon.some((a, index) => {
            const b = room.polygon[(index + 1) % room.polygon.length];
            return onSegment(a, b, wall.a) && onSegment(a, b, wall.b);
          }),
      )
    ) {
      walls.splice(i, 1);
      duplicateBoundaryWalls++;
    }
  }
  if (duplicateBoundaryWalls)
    warnings.push(
      `${duplicateBoundaryWalls} free-wall segments already covered by room boundaries were omitted to avoid duplicate walls.`,
    );
  if (!rooms.length && !walls.length)
    throw new Error(
      'No complete room outlines or wall runs remain. Review the layer roles or repair boundary gaps in the source file.',
    );
  if (rooms.length > PLAN_IMPORT_LIMITS.rooms || walls.length > PLAN_IMPORT_LIMITS.walls)
    throw new Error('Use fewer than 150 room outlines or 1,500 wall segments per import.');
  const topFloor = Math.max(...selected.map((l) => l.floor));
  const levels = Array.from({ length: topFloor + 1 }, (_, index) => ({
    id: floorId(index),
    name: index === 0 ? 'Ground floor' : `Floor ${index}`,
    index,
    heightM: height,
    elevationM: index * height,
  }));
  for (const level of levels)
    if (!rooms.some((r) => r.levelId === level.id))
      rooms.push({
        id: `import-${stamp}-${level.id}-blank`,
        name: 'Draw a room',
        levelId: level.id,
        polygon: [],
        placedItems: [],
      });
  const activeLevelId = floorId(Math.min(...selected.map((l) => l.floor)));
  const property = syncRoofRooms({
    id: `import-${stamp}`,
    name: options.name.trim().slice(0, 100) || source.name,
    rooms,
    walls,
    levels,
    activeLevelId,
    activeRoomId: rooms.find((r) => r.levelId === activeLevelId)!.id,
    wallHeightM: height,
    site: {
      widthM: Math.max(2, widthM + 4),
      depthM: Math.max(2, depthM + 4),
      originM: { x: -2, y: -2 },
    },
  });
  warnings.push(
    'Room outlines become editable walls and floors. Add doors, windows, stairs, products and services in the designer; export symbols are not recognised automatically.',
  );
  warnings.push(
    'Coordinates share one origin across floors. Align exported floor layers before import. Wall thickness applies to free walls; room boundary walls use the designer’s standard thickness.',
  );
  return {
    property,
    warnings: [...new Set(warnings)],
    roomCount: rooms.filter((r) => r.polygon.length >= 3 && r.kind !== 'roof').length,
    wallCount: walls.length,
    widthM,
    depthM,
    areaM2: rooms.reduce((sum, r) => sum + polygonArea(r.polygon), 0),
  };
}
