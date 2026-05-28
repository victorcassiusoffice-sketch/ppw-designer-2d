/**
 * Geometry - pure functions for the WRD canvas.
 *
 * Kept side-effect-free so they're trivially unit-testable. Used by
 * RoomCanvas (drop handler), DetailsPanel (rotate / duplicate guards),
 * RoomDrawMode (polygon draw flow) and the Vitest suite in
 * `src/lib/__tests__`.
 *
 * Week 2.5: room shape generalised from rectangle to polygon (walls
 * only). All in-bounds checks route through `isRectInsidePolygon`. A
 * `rectToPolygon` migrator converts the rectangle-era saves to the new
 * polygon shape (see MIGRATION-NOTES.md).
 */
export interface FootprintM {
  lengthM: number;
  widthM: number;
}

export interface PlacedRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Viewport {
  x: number;
  y: number;
  scale: number;
}

export interface RoomDims {
  lengthM: number;
  widthM: number;
}

export interface Vertex {
  x: number;
  y: number;
}

/** A closed simple polygon, vertices in CW or CCW order. No repeated last point. */
export type Polygon = Vertex[];

export function cmToM(cm: number): number {
  return cm / 100;
}

export function rotatedFootprint(fp: FootprintM, rotationDeg: number): { w: number; h: number } {
  const r = ((rotationDeg % 360) + 360) % 360;
  if (r === 90 || r === 270) {
    return { w: fp.widthM, h: fp.lengthM };
  }
  return { w: fp.lengthM, h: fp.widthM };
}

export function snapToGrid(valueM: number, stepM: number = 0.5): number {
  return Math.round(valueM / stepM) * stepM;
}

export function screenToRoom(
  screenX: number,
  screenY: number,
  containerRect: { left: number; top: number },
  viewport: Viewport,
  pxPerMetre: number,
): { xM: number; yM: number } {
  const localX = screenX - containerRect.left;
  const localY = screenY - containerRect.top;
  const stageX = (localX - viewport.x) / viewport.scale;
  const stageY = (localY - viewport.y) / viewport.scale;
  return { xM: stageX / pxPerMetre, yM: stageY / pxPerMetre };
}

// =====================================================================
// Polygon helpers (Week 2.5)
// =====================================================================

export function rectToPolygon(dims: RoomDims): Polygon {
  const L = dims.lengthM;
  const W = dims.widthM;
  return [
    { x: 0, y: 0 },
    { x: L, y: 0 },
    { x: L, y: W },
    { x: 0, y: W },
  ];
}

export function polygonBounds(polygon: Polygon): {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
} {
  if (polygon.length === 0) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  }
  let minX = polygon[0].x;
  let minY = polygon[0].y;
  let maxX = polygon[0].x;
  let maxY = polygon[0].y;
  for (const v of polygon) {
    if (v.x < minX) minX = v.x;
    if (v.y < minY) minY = v.y;
    if (v.x > maxX) maxX = v.x;
    if (v.y > maxY) maxY = v.y;
  }
  return { minX, minY, maxX, maxY };
}

export function polygonPerimeter(polygon: Polygon): number {
  if (polygon.length < 2) return 0;
  let total = 0;
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i];
    const b = polygon[(i + 1) % polygon.length];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    total += Math.sqrt(dx * dx + dy * dy);
  }
  return total;
}

export function polygonArea(polygon: Polygon): number {
  if (polygon.length < 3) return 0;
  let s = 0;
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i];
    const b = polygon[(i + 1) % polygon.length];
    s += a.x * b.y - b.x * a.y;
  }
  return Math.abs(s) / 2;
}

export function distance(a: Vertex, b: Vertex): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return Math.sqrt(dx * dx + dy * dy);
}

export function isClosingPolygon(
  vertices: Polygon,
  candidate: Vertex,
  thresholdM: number = 0.4,
): boolean {
  if (vertices.length < 3) return false;
  return distance(vertices[0], candidate) < thresholdM;
}

export function pointOnSegment(p: Vertex, a: Vertex, b: Vertex, eps: number = 1e-6): boolean {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq < eps * eps) {
    return distance(p, a) < eps;
  }
  const t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq;
  if (t < -eps || t > 1 + eps) return false;
  const px = a.x + t * dx;
  const py = a.y + t * dy;
  const distSq = (p.x - px) * (p.x - px) + (p.y - py) * (p.y - py);
  return distSq < eps * eps;
}

export function pointInPolygon(p: Vertex, polygon: Polygon, eps: number = 1e-6): boolean {
  if (polygon.length < 3) return false;

  // Edge-touch short-circuit: if p lies on any edge segment, count as inside.
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i];
    const b = polygon[(i + 1) % polygon.length];
    if (pointOnSegment(p, a, b, eps)) return true;
  }

  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x;
    const yi = polygon[i].y;
    const xj = polygon[j].x;
    const yj = polygon[j].y;
    const intersect =
      yi > p.y !== yj > p.y &&
      p.x < ((xj - xi) * (p.y - yi)) / (yj - yi + (yj === yi ? eps : 0)) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

export function isRectInsidePolygon(rect: PlacedRect, polygon: Polygon, eps: number = 1e-6): boolean {
  const corners: Vertex[] = [
    { x: rect.x, y: rect.y },
    { x: rect.x + rect.w, y: rect.y },
    { x: rect.x + rect.w, y: rect.y + rect.h },
    { x: rect.x, y: rect.y + rect.h },
  ];
  for (const c of corners) {
    if (!pointInPolygon(c, polygon, eps)) return false;
  }
  return true;
}

// =====================================================================
// In-room check - back-compat wrapper
// =====================================================================

export function isInsideRoom(
  rect: PlacedRect,
  roomOrPolygon: RoomDims | Polygon,
  eps = 1e-6,
): boolean {
  const polygon = Array.isArray(roomOrPolygon) ? roomOrPolygon : rectToPolygon(roomOrPolygon);
  return isRectInsidePolygon(rect, polygon, eps);
}

export function rectsOverlap(a: PlacedRect, b: PlacedRect, eps = 1e-6): boolean {
  return (
    a.x + a.w > b.x + eps &&
    b.x + b.w > a.x + eps &&
    a.y + a.h > b.y + eps &&
    b.y + b.h > a.y + eps
  );
}

export function collidesWithAny(
  candidate: PlacedRect,
  others: Array<PlacedRect & { instanceId?: string }>,
  ignoreInstanceId?: string,
): boolean {
  for (const o of others) {
    if (ignoreInstanceId && o.instanceId === ignoreInstanceId) continue;
    if (rectsOverlap(candidate, o)) return true;
  }
  return false;
}

export type PlacementResult =
  | { ok: true }
  | { ok: false; reason: 'out-of-bounds' | 'collision' };

export function validatePlacement(
  candidate: PlacedRect,
  others: Array<PlacedRect & { instanceId?: string }>,
  roomOrPolygon: RoomDims | Polygon,
  ignoreInstanceId?: string,
): PlacementResult {
  if (!isInsideRoom(candidate, roomOrPolygon)) return { ok: false, reason: 'out-of-bounds' };
  if (collidesWithAny(candidate, others, ignoreInstanceId)) {
    return { ok: false, reason: 'collision' };
  }
  return { ok: true };
}

export type ResolveDragResult =
  | { ok: true; x: number; y: number }
  | { ok: false; reason: 'out-of-bounds' | 'collision' };

export interface ResolveDragInput {
  candidateX: number;
  candidateY: number;
  w: number;
  h: number;
  snapStep?: number;
  others: Array<PlacedRect & { instanceId?: string }>;
  room: RoomDims | Polygon;
  ignoreInstanceId?: string;
}

export function resolveDragTarget(input: ResolveDragInput): ResolveDragResult {
  const step = input.snapStep ?? 0.5;
  const snappedX = snapToGrid(input.candidateX, step);
  const snappedY = snapToGrid(input.candidateY, step);
  const candidate: PlacedRect = { x: snappedX, y: snappedY, w: input.w, h: input.h };
  const result = validatePlacement(candidate, input.others, input.room, input.ignoreInstanceId);
  if (!result.ok) return result;
  return { ok: true, x: snappedX, y: snappedY };
}

export interface FreeSlotInput {
  /** Desired top-left X (metres). Snapped to the grid internally. */
  preferredX: number;
  /** Desired top-left Y (metres). Snapped to the grid internally. */
  preferredY: number;
  /** Footprint width (metres, already rotation-resolved). */
  w: number;
  /** Footprint height (metres, already rotation-resolved). */
  h: number;
  others: Array<PlacedRect & { instanceId?: string }>;
  polygon: Polygon;
  /** Grid step (metres). Defaults to the 0.5 m placement grid. */
  step?: number;
  ignoreInstanceId?: string;
}

/**
 * Designer 3-Bug Fix (2026-05-28, Bug 2) — "items refuse to fit even
 * though the room is big enough".
 *
 * Root cause: every mobile "+ Add to room" tap places at the SAME room
 * centre, so the second item always overlapped the first and placement
 * was rejected with "won't fit" despite acres of empty floor.
 *
 * Fix: return the nearest grid-aligned slot to the preferred point where
 * the w×h footprint is fully inside the polygon AND collides with nothing.
 * The preferred slot is tried first (so a free centre keeps the old
 * behaviour); otherwise the polygon bounding box is scanned on the grid,
 * nearest-first. Returns null only when the room genuinely has no free
 * slot for this footprint — the one case where "won't fit" is honest.
 */
export function findFreeSlot(input: FreeSlotInput): { x: number; y: number } | null {
  const step = input.step ?? 0.5;
  const { w, h, others, polygon, ignoreInstanceId } = input;
  const preferredX = snapToGrid(input.preferredX, step);
  const preferredY = snapToGrid(input.preferredY, step);

  const fits = (x: number, y: number): boolean =>
    validatePlacement({ x, y, w, h }, others, polygon, ignoreInstanceId).ok;

  if (fits(preferredX, preferredY)) return { x: preferredX, y: preferredY };

  const b = polygonBounds(polygon);
  const startX = snapToGrid(b.minX, step);
  const startY = snapToGrid(b.minY, step);
  const candidates: Array<{ x: number; y: number; d: number }> = [];
  for (let x = startX; x + w <= b.maxX + 1e-9; x += step) {
    for (let y = startY; y + h <= b.maxY + 1e-9; y += step) {
      const dx = x - preferredX;
      const dy = y - preferredY;
      candidates.push({ x, y, d: dx * dx + dy * dy });
    }
  }
  candidates.sort((a, c) => a.d - c.d);
  for (const c of candidates) {
    if (fits(c.x, c.y)) return { x: c.x, y: c.y };
  }
  return null;
}
