/**
 * wallEdges — pure geometry for ADDRESSABLE WALLS and the openings that cut
 * them (Vic 2026-08-28: "what if I wanted to add a door going into the second
 * room").
 *
 * Sibling of `roomLayout.ts` (which owns room placement, snapping and the
 * no-overlap invariant) and, like it, imports freely from the PROTECTED
 * `lib/geometry.ts` while adding nothing to it. Everything here is PURE — no
 * store reads, no Konva, no side effects — so the truth table in
 * `__tests__/wallEdges.test.ts` is meaningful evidence rather than decoration.
 *
 * WHY THIS MODULE EXISTS
 * ----------------------
 * A room used to render as ONE closed Konva Line carrying both the floor fill
 * and the gold wall stroke. That means there is no individual wall to host a
 * door on, and no way to cut a gap in the stroke. This module turns a polygon
 * into a list of addressable edges and answers the three questions the door
 * feature asks of geometry:
 *
 *   1. which wall did the user click?           -> nearestEdge
 *   2. which OTHER rooms share this wall?       -> sharedEdgeMap
 *   3. what is left of the stroke around a gap? -> splitEdgeSpans
 *
 * (2) is the one that is easy to miss and impossible to fake. A door "into the
 * second room" sits on a wall that exists in BOTH room polygons — the two
 * rooms are attached along it. Cut only the room you clicked and the
 * neighbour's gold line still runs straight across the doorway.
 */

import type { Polygon, Vertex } from '../lib/geometry';

/** A room, as much of it as this module needs. */
export interface EdgeRoom {
  id: string;
  polygon: Polygon;
}

/**
 * Collinearity tolerance in metres (1 mm).
 *
 * Attached rooms share vertices snapped EXACTLY onto each other by
 * `roomLayout.snapVertexToRooms`, so a true shared wall is exact to
 * floating-point noise. 1 mm absorbs that noise without ever fusing two walls
 * that are genuinely different.
 */
export const COLLINEAR_EPS_M = 1e-3;

export interface RoomEdge {
  roomId: string;
  /** Index into the polygon: the edge runs vertex[index] -> vertex[index + 1]. */
  index: number;
  a: Vertex;
  b: Vertex;
  /** Metres. */
  lengthM: number;
  /** Unit direction, a -> b. */
  dx: number;
  dy: number;
  /** Radians, atan2 of the direction. */
  angleRad: number;
}

/**
 * Every edge of a room polygon, in vertex order, closing last -> first.
 *
 * Degenerate (zero-length) edges are dropped rather than returned: they have
 * no direction, so they cannot host an opening or be drawn, and letting one
 * through would produce NaN directions that silently poison every downstream
 * projection.
 */
export function roomEdges(room: EdgeRoom): RoomEdge[] {
  const poly = room.polygon;
  if (!poly || poly.length < 3) return [];
  const out: RoomEdge[] = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const vx = b.x - a.x;
    const vy = b.y - a.y;
    const lengthM = Math.hypot(vx, vy);
    if (lengthM <= COLLINEAR_EPS_M) continue;
    out.push({
      roomId: room.id,
      index: i,
      a,
      b,
      lengthM,
      dx: vx / lengthM,
      dy: vy / lengthM,
      angleRad: Math.atan2(vy, vx),
    });
  }
  return out;
}

/** Distance along `edge` from its start vertex to the projection of `p`, metres. */
export function projectOntoEdge(edge: RoomEdge, p: Vertex): number {
  return (p.x - edge.a.x) * edge.dx + (p.y - edge.a.y) * edge.dy;
}

/** The world point `t` metres along `edge` from its start vertex. */
export function pointAlongEdge(edge: RoomEdge, t: number): Vertex {
  return { x: edge.a.x + edge.dx * t, y: edge.a.y + edge.dy * t };
}

/** Signed perpendicular distance from `p` to the edge's INFINITE line. */
export function perpDistanceToEdgeLine(edge: RoomEdge, p: Vertex): number {
  return (p.x - edge.a.x) * -edge.dy + (p.y - edge.a.y) * edge.dx;
}

/**
 * Shortest distance from `p` to the edge SEGMENT (clamped at both ends), plus
 * where along the edge the closest point sits.
 */
export function distanceToEdge(edge: RoomEdge, p: Vertex): { distanceM: number; offsetM: number } {
  const t = Math.max(0, Math.min(edge.lengthM, projectOntoEdge(edge, p)));
  const q = pointAlongEdge(edge, t);
  return { distanceM: Math.hypot(p.x - q.x, p.y - q.y), offsetM: t };
}

export interface EdgeHit {
  edge: RoomEdge;
  /** Distance along the edge from its start vertex, metres. */
  offsetM: number;
  distanceM: number;
}

/**
 * The wall nearest a world point, within `tolM` — how the door tool decides
 * which wall a hover or click lands on.
 *
 * Ties break by distance, then by the order rooms appear in the property. That
 * determinism matters on a SHARED wall, where two edges are exactly equidistant:
 * without it the highlighted edge would flicker between the two rooms as the
 * pointer moves and the ghost would jitter.
 */
export function nearestEdge(
  pM: Vertex,
  rooms: readonly EdgeRoom[],
  tolM: number,
): EdgeHit | null {
  let best: EdgeHit | null = null;
  for (const room of rooms) {
    for (const edge of roomEdges(room)) {
      const { distanceM, offsetM } = distanceToEdge(edge, pM);
      if (distanceM > tolM) continue;
      if (!best || distanceM < best.distanceM - COLLINEAR_EPS_M) {
        best = { edge, offsetM, distanceM };
      }
    }
  }
  return best;
}

/**
 * The overlapping portion of two COLLINEAR segments, in `e1`'s parameter space
 * (metres from `e1.a`).
 *
 * Returns null unless the two are genuinely the same wall: parallel, on the
 * same infinite line, and overlapping over a positive length.
 *
 * Parallelism is deliberately SIGN-AGNOSTIC. Two rooms that meet on a wall
 * wind the same way, which means each traverses the shared edge in the
 * OPPOSITE direction to the other — requiring matching directions here would
 * reject every real shared wall in the app.
 */
export function collinearOverlap(
  e1: RoomEdge,
  e2: RoomEdge,
  epsM: number = COLLINEAR_EPS_M,
): { t0: number; t1: number } | null {
  const cross = e1.dx * e2.dy - e1.dy * e2.dx;
  if (Math.abs(cross) > epsM) return null;

  if (Math.abs(perpDistanceToEdgeLine(e1, e2.a)) > epsM) return null;
  if (Math.abs(perpDistanceToEdgeLine(e1, e2.b)) > epsM) return null;

  const ta = projectOntoEdge(e1, e2.a);
  const tb = projectOntoEdge(e1, e2.b);
  const t0 = Math.max(0, Math.min(ta, tb));
  const t1 = Math.min(e1.lengthM, Math.max(ta, tb));
  if (t1 - t0 <= epsM) return null;
  return { t0, t1 };
}

/** A neighbour wall co-located with some edge. */
export interface SharedEdgeRef {
  roomId: string;
  edgeIndex: number;
  /** Overlap interval in the SOURCE edge's parameter space, metres. */
  t0: number;
  t1: number;
}

/** Map key for `sharedEdgeMap`. */
export function edgeKey(roomId: string, edgeIndex: number): string {
  return `${roomId}:${edgeIndex}`;
}

/**
 * For every edge of every room, the other rooms' edges lying on the same wall.
 * Symmetric by construction.
 *
 * This is what lets a door in a shared wall read as a doorway rather than as a
 * gap in one room with the neighbour's wall still drawn across it.
 */
export function sharedEdgeMap(rooms: readonly EdgeRoom[]): Map<string, SharedEdgeRef[]> {
  const out = new Map<string, SharedEdgeRef[]>();
  const byRoom = rooms.map((r) => roomEdges(r));

  for (let i = 0; i < byRoom.length; i++) {
    for (let j = 0; j < byRoom.length; j++) {
      if (i === j) continue;
      for (const e1 of byRoom[i]) {
        for (const e2 of byRoom[j]) {
          const ov = collinearOverlap(e1, e2);
          if (!ov) continue;
          const k = edgeKey(e1.roomId, e1.index);
          const list = out.get(k) ?? [];
          list.push({ roomId: e2.roomId, edgeIndex: e2.index, t0: ov.t0, t1: ov.t1 });
          out.set(k, list);
        }
      }
    }
  }
  return out;
}

/** An interval along an edge, metres from the edge's start vertex. */
export interface Span {
  t0: number;
  t1: number;
}

/**
 * What is LEFT of a wall once its openings are cut out.
 *
 * Given an edge length and the spans openings occupy, returns the solid
 * sub-segments to stroke. Gaps are clamped to the edge, sorted and merged, so
 * callers may pass raw opening spans in any order and overlapping gaps behave
 * as one.
 *
 * A fully covered wall correctly returns [] — that is an open-plan threshold,
 * not an error.
 */
export function splitEdgeSpans(lengthM: number, gaps: readonly Span[]): Span[] {
  if (lengthM <= 0) return [];

  const clean = gaps
    .map((g) => ({
      t0: Math.max(0, Math.min(g.t0, g.t1)),
      t1: Math.min(lengthM, Math.max(g.t0, g.t1)),
    }))
    .filter((g) => g.t1 - g.t0 > COLLINEAR_EPS_M)
    .sort((p, q) => p.t0 - q.t0);

  const merged: Span[] = [];
  for (const g of clean) {
    const last = merged[merged.length - 1];
    if (last && g.t0 <= last.t1 + COLLINEAR_EPS_M) {
      last.t1 = Math.max(last.t1, g.t1);
    } else {
      merged.push({ ...g });
    }
  }

  const solid: Span[] = [];
  let cursor = 0;
  for (const g of merged) {
    if (g.t0 - cursor > COLLINEAR_EPS_M) solid.push({ t0: cursor, t1: g.t0 });
    cursor = Math.max(cursor, g.t1);
  }
  if (lengthM - cursor > COLLINEAR_EPS_M) solid.push({ t0: cursor, t1: lengthM });
  return solid;
}
