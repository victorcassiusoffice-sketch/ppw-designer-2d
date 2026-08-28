/**
 * roomLayout — pure geometry for the ATTACHED multi-room canvas
 * (Vic 2026-08-26: "The Sims / the reference plan — all rooms visible on
 * one canvas, new rooms drawn attached to existing ones sharing walls").
 *
 * `src/lib/geometry.ts` is PROTECTED (read-only) for this feature, so every
 * new helper lives here and imports from it freely. Everything in this
 * module is PURE — no store reads, no Konva, no side effects — which is
 * what makes the truth table in `__tests__/roomLayout.test.ts` meaningful.
 *
 * The three ideas that carry the feature:
 *
 *  1. ONE shared world-metre frame. `Room.polygon` is unchanged and the
 *     persisted schema does not move; rooms simply stop being rendered
 *     through an active-room filter. `activeRoomId` becomes a FOCUS
 *     concept (what the TopBar L/W and DetailsPanel describe), not a
 *     render filter.
 *  2. Rooms may SHARE walls but never OVERLAP. `strictPolygonsOverlap` is
 *     the invariant's gatekeeper and is deliberately generous about what
 *     counts as overlap — see its doc comment for the two real payloads
 *     that defeat a naive test.
 *  3. Wall-snap runs FIRST and its output is never re-grid-snapped. That
 *     ordering is the whole reason the two snaps don't fight: a vertex
 *     dragged onto an existing off-grid wall must land EXACTLY on it, and
 *     a subsequent grid snap would drift it back off by up to 0.25 m.
 */

import { pointInPolygon, polygonBounds } from '../lib/geometry';
import type { Polygon, RoomDims, Vertex } from '../lib/geometry';

/**
 * Wall-snap radius, in metres. Half the 0.5 m grid step, so a vertex is
 * pulled onto an existing wall exactly when that wall is nearer than the
 * nearest grid line would be.
 */
export const SNAP_TOL_M = 0.25;

/**
 * Wall-snap radius for a given snap step (units brief 2026-08-28, D4).
 *
 * `SNAP_TOL_M` above encodes the step/2 identity for the 0.5 m default. Once
 * the step is user-selectable that identity has to be computed, with two
 * deliberate departures from it:
 *
 *  • FLOOR 0.05 m — at a 1 cm step, step/2 would be 5 mm and the magnet
 *    would be unusable. The floor keeps walls catchable at fine units.
 *  • CEILING 0.25 m — at the 10 m step, step/2 would be a 5 m magnet that
 *    swallows the whole plan. The identity is abandoned above 0.5 m on
 *    purpose.
 *
 * At stepM = 0.5 this returns exactly 0.25, so every existing test and the
 * off-grid 5.13 m fixture in `multiroom-attach.spec.ts` are unchanged.
 */
export function wallSnapTolM(stepM: number): number {
  return Math.min(Math.max(stepM / 2, 0.05), 0.25);
}

/**
 * Click-to-close radius for the room polygon at a given snap step (D5).
 *
 * Same shape of argument as `wallSnapTolM`: proportional in the middle,
 * clamped at both ends. Below 0.15 m the click-to-close gesture is
 * unreliable at any unit, so that is the floor and Enter is the documented
 * close path at fine units. At stepM = 0.5 this returns exactly 0.4, which
 * is today's `CLOSE_THRESHOLD_M`.
 */
export function closeThresholdM(stepM: number): number {
  return Math.min(Math.max(stepM * 0.8, 0.15), 0.4);
}

/**
 * Tolerance for "strictly inside" tests. Deliberately tiny: a point ON a
 * shared boundary must NOT read as strictly interior, or every legal
 * attached room would be rejected as an overlap.
 */
export const STRICT_EPS_M = 1e-4;

/** A room, as much of it as this module needs. */
export interface LayoutRoom {
  id: string;
  polygon: Polygon;
}

/** A room polygon is "drawn" once it has enough vertices to enclose area. */
export function isDrawnPolygon(polygon: Polygon | undefined): boolean {
  return !!polygon && polygon.length >= 3;
}

export function translatePolygon(poly: Polygon, dx: number, dy: number): Polygon {
  return poly.map((v) => ({ x: v.x + dx, y: v.y + dy }));
}

export interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/**
 * Axis-aligned bounding box over every DRAWN room. `null` when no room has
 * a polygon yet (a fresh property always holds one blank room, so this is
 * the normal start state, not an error).
 */
export function unionBounds(rooms: readonly LayoutRoom[]): Bounds | null {
  let out: Bounds | null = null;
  for (const r of rooms) {
    if (!isDrawnPolygon(r.polygon)) continue;
    const b = polygonBounds(r.polygon);
    if (out === null) {
      out = { minX: b.minX, minY: b.minY, maxX: b.maxX, maxY: b.maxY };
    } else {
      if (b.minX < out.minX) out.minX = b.minX;
      if (b.minY < out.minY) out.minY = b.minY;
      if (b.maxX > out.maxX) out.maxX = b.maxX;
      if (b.maxY > out.maxY) out.maxY = b.maxY;
    }
  }
  return out;
}

/**
 * Which room owns a world point.
 *
 * `pointInPolygon` is boundary-INCLUSIVE, so a point on a shared wall is
 * inside BOTH rooms. The ORDERING here is the tie-break and it is the
 * contract: the ACTIVE room wins, then `property.rooms` array order. Ghost
 * preview and commit must both call this so the preview can never disagree
 * with what actually lands.
 *
 * Returns `null` when the point is in no room — the caller rejects.
 */
export function findRoomAt<T extends LayoutRoom>(
  pointM: Vertex,
  rooms: readonly T[],
  activeRoomId?: string | null,
): T | null {
  const active = activeRoomId
    ? rooms.find((r) => r.id === activeRoomId && isDrawnPolygon(r.polygon))
    : undefined;
  if (active && pointInPolygon(pointM, active.polygon)) return active;
  for (const r of rooms) {
    if (!isDrawnPolygon(r.polygon)) continue;
    if (r.id === activeRoomId) continue; // already tried, and it missed
    if (pointInPolygon(pointM, r.polygon)) return r;
  }
  return null;
}

/** Strictly inside — a point ON the boundary returns false. */
function strictlyInside(p: Vertex, poly: Polygon): boolean {
  if (poly.length < 3) return false;
  // Boundary points are excluded explicitly: pointInPolygon short-circuits
  // edge touches to TRUE, which is the opposite of what we need here.
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    if (pointOnSegmentStrict(p, a, b, STRICT_EPS_M)) return false;
  }
  return pointInPolygon(p, poly, STRICT_EPS_M);
}

/** Local segment-hit with an explicit tolerance (geometry.ts is read-only). */
function pointOnSegmentStrict(p: Vertex, a: Vertex, b: Vertex, eps: number): boolean {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq < eps * eps) {
    return Math.hypot(p.x - a.x, p.y - a.y) < eps;
  }
  const t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq;
  if (t < -eps || t > 1 + eps) return false;
  const px = a.x + t * dx;
  const py = a.y + t * dy;
  return Math.hypot(p.x - px, p.y - py) < eps;
}

/** Orientation sign of the triangle (a, b, c), with a dead-zone at 0. */
function orient(a: Vertex, b: Vertex, c: Vertex): number {
  const v = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  if (Math.abs(v) < STRICT_EPS_M) return 0;
  return v > 0 ? 1 : -1;
}

/**
 * PROPER crossing only: segments that touch at an endpoint, or are
 * collinear and overlapping, return FALSE. Shared walls are legal, so
 * every "touching" configuration has to pass.
 */
function segmentsProperlyCross(p1: Vertex, p2: Vertex, p3: Vertex, p4: Vertex): boolean {
  const d1 = orient(p3, p4, p1);
  const d2 = orient(p3, p4, p2);
  const d3 = orient(p1, p2, p3);
  const d4 = orient(p1, p2, p4);
  // Any zero means a touch/collinear case → not a PROPER crossing.
  if (d1 === 0 || d2 === 0 || d3 === 0 || d4 === 0) return false;
  return d1 !== d2 && d3 !== d4;
}

function centroid(poly: Polygon): Vertex {
  let x = 0;
  let y = 0;
  for (const v of poly) {
    x += v.x;
    y += v.y;
  }
  return { x: x / poly.length, y: y / poly.length };
}

function edgeMidpoints(poly: Polygon): Vertex[] {
  const out: Vertex[] = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    out.push({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
  }
  return out;
}

/**
 * TRUE (= REJECT the new room) iff the two polygons genuinely overlap.
 * Shared edges and shared vertices PASS — that is the entire point of an
 * attached layout.
 *
 * Four probes, both directions:
 *   a) any PROPER edge-pair crossing;
 *   b) any VERTEX of one strictly inside the other;
 *   c) the CENTROID of one strictly inside the other;
 *   d) any edge MIDPOINT of one strictly inside the other.
 *
 * (c) and (d) are NOT optional. The two canonical real payloads defeat
 * (a) + (b) on their own:
 *   • IDENTICAL stacked rectangles — every vertex lies ON the other's
 *     boundary and no edges properly cross. Caught by the centroid.
 *   • A snap-traced SUB-rectangle whose vertices all landed on the host's
 *     boundary (e.g. the user traced half of an existing wall) — again no
 *     strictly-interior vertex and no proper crossing. Caught by an edge
 *     midpoint, which sits in the host's interior.
 */
export function strictPolygonsOverlap(a: Polygon, b: Polygon): boolean {
  if (!isDrawnPolygon(a) || !isDrawnPolygon(b)) return false;

  // (a) proper edge crossings
  for (let i = 0; i < a.length; i++) {
    const a1 = a[i];
    const a2 = a[(i + 1) % a.length];
    for (let j = 0; j < b.length; j++) {
      const b1 = b[j];
      const b2 = b[(j + 1) % b.length];
      if (segmentsProperlyCross(a1, a2, b1, b2)) return true;
    }
  }

  // (b) + (c) + (d), both directions
  const probesA: Vertex[] = [...a, centroid(a), ...edgeMidpoints(a)];
  for (const p of probesA) {
    if (strictlyInside(p, b)) return true;
  }
  const probesB: Vertex[] = [...b, centroid(b), ...edgeMidpoints(b)];
  for (const p of probesB) {
    if (strictlyInside(p, a)) return true;
  }

  return false;
}

export interface SnapHit {
  v: Vertex;
  kind: 'vertex' | 'edge';
}

/**
 * Pull a raw draw point onto an existing room's geometry.
 *
 * Priority: nearest existing VERTEX within `tol`, else the perpendicular
 * projection onto the nearest EDGE within `tol`, else `null`.
 *
 * A snapped point is NEVER re-grid-snapped by the caller — re-snapping
 * drifts shared vertices off the wall they were just attached to, which
 * silently reintroduces the overlap the snap existed to prevent.
 */
export function snapVertexToRooms(
  pM: Vertex,
  rooms: readonly LayoutRoom[],
  tol: number = SNAP_TOL_M,
): SnapHit | null {
  let bestVertex: { v: Vertex; d: number } | null = null;
  let bestEdge: { v: Vertex; d: number } | null = null;

  for (const r of rooms) {
    if (!isDrawnPolygon(r.polygon)) continue;
    const poly = r.polygon;
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i];
      const d = Math.hypot(pM.x - a.x, pM.y - a.y);
      if (d <= tol && (bestVertex === null || d < bestVertex.d)) {
        bestVertex = { v: { x: a.x, y: a.y }, d };
      }
    }
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i];
      const b = poly[(i + 1) % poly.length];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const lenSq = dx * dx + dy * dy;
      if (lenSq === 0) continue;
      let t = ((pM.x - a.x) * dx + (pM.y - a.y) * dy) / lenSq;
      t = Math.max(0, Math.min(1, t));
      const px = a.x + t * dx;
      const py = a.y + t * dy;
      const d = Math.hypot(pM.x - px, pM.y - py);
      if (d <= tol && (bestEdge === null || d < bestEdge.d)) {
        bestEdge = { v: { x: px, y: py }, d };
      }
    }
  }

  if (bestVertex) return { v: bestVertex.v, kind: 'vertex' };
  if (bestEdge) return { v: bestEdge.v, kind: 'edge' };
  return null;
}

/**
 * Anchor for a NEW rectangle room: flush-RIGHT of everything drawn so far,
 * so it shares the union's east wall. `(0, 0)` when nothing is drawn yet —
 * which preserves today's behaviour on a fresh canvas exactly (and with it
 * the `placement-fsm` / `wall-aware-placement` e2e expectations).
 */
export function nextRectanglePosition(
  rooms: readonly LayoutRoom[],
  _dims?: RoomDims,
): Vertex {
  void _dims; // the anchor does not depend on the new room's size
  const u = unionBounds(rooms);
  if (!u) return { x: 0, y: 0 };
  return { x: u.maxX, y: u.minY };
}

// ---------------------------------------------------------------------------
// Legacy un-stack
// ---------------------------------------------------------------------------

/**
 * Structural minimums only — deliberately NO index signature. An index
 * signature would make the concrete `Room` / `PlacedItem` interfaces
 * unassignable here, and this helper has to accept the real store types.
 * Extra properties ride along untouched (spread preserves them).
 */
interface UnstackItem {
  x: number;
  y: number;
}

interface UnstackRoom {
  polygon: Polygon;
  placedItems: UnstackItem[];
}

interface UnstackProperty {
  rooms: UnstackRoom[];
}

/**
 * Every rectangle-authored room in the pre-2026-08-26 codebase was pinned
 * at the origin by `rectToPolygon`, so a legacy multi-room save has all of
 * its rooms STACKED at (0, 0). Single-room rendering hid that; rendering
 * them all would draw them on top of each other.
 *
 * Pure re-lay-out, flush-right in array order: room[0] stays exactly where
 * it is, and each subsequent room is translated so its `minX` meets the
 * running union's `maxX` at the union's `minY`. Each room's placedItems
 * travel by the SAME delta, so nothing is orphaned outside its walls.
 *
 * Returns the input BY REFERENCE when no pair overlaps, which makes the
 * "did this change anything?" check at the call site a cheap identity
 * comparison. Idempotent: running it on its own output is a no-op.
 */
export function unstackLegacyRooms<P extends UnstackProperty>(property: P): P {
  const rooms = property.rooms ?? [];
  const drawn = rooms.filter((r) => isDrawnPolygon(r.polygon));
  if (drawn.length < 2) return property;

  let anyOverlap = false;
  for (let i = 0; i < drawn.length && !anyOverlap; i++) {
    for (let j = i + 1; j < drawn.length; j++) {
      if (strictPolygonsOverlap(drawn[i].polygon, drawn[j].polygon)) {
        anyOverlap = true;
        break;
      }
    }
  }
  if (!anyOverlap) return property;

  let union: Bounds | null = null;
  const nextRooms = rooms.map((r) => {
    if (!isDrawnPolygon(r.polygon)) return r;
    const b = polygonBounds(r.polygon);
    if (union === null) {
      // First drawn room stays exactly where it is.
      union = { minX: b.minX, minY: b.minY, maxX: b.maxX, maxY: b.maxY };
      return r;
    }
    const u: Bounds = union;
    const dx = u.maxX - b.minX;
    const dy = u.minY - b.minY;
    const polygon = translatePolygon(r.polygon, dx, dy);
    const placedItems = (r.placedItems ?? []).map((it) => ({
      ...it,
      x: it.x + dx,
      y: it.y + dy,
    }));
    const nb = polygonBounds(polygon);
    union = {
      minX: Math.min(u.minX, nb.minX),
      minY: Math.min(u.minY, nb.minY),
      maxX: Math.max(u.maxX, nb.maxX),
      maxY: Math.max(u.maxY, nb.maxY),
    };
    return { ...r, polygon, placedItems };
  });

  // The spread preserves every extra property on the concrete store types
  // (Room.id/name, PlacedItem.instanceId/productId/rotation); the cast just
  // tells TS the widened structural result is still the caller's own shape.
  return { ...property, rooms: nextRooms } as P;
}
