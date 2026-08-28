/**
 * edgeResize — retype the length of a wall that already exists
 * (units brief 2026-08-28, D10).
 *
 * Drawing a room lets you type a length as you go (see `drawLength.ts`).
 * This is the other half of Vic's ask: change a wall AFTER the room is built.
 *
 * The honest bit, which the UI must say out loud: in a polygon you cannot
 * change one edge's length in isolation. Moving a corner to make the north
 * wall 4.20 m necessarily changes the length of the wall that shares that
 * corner. The alternative — translating the whole edge perpendicular to
 * itself — changes two lengths as well AND moves a wall the user did not
 * point at, so it is less predictable, not more.
 *
 * Everything here is pure. The caller commits through `setRoomPolygon`.
 */

import { roomEdges, type EdgeRoom } from './wallEdges';
import { strictPolygonsOverlap, STRICT_EPS_M } from './roomLayout';
import type { Polygon, Vertex } from '../lib/geometry';

/** Shortest edge we will allow to survive a resize. */
export const MIN_EDGE_M = 1e-3;

/** Hard ceiling on a typed wall length, matching the room-size clamp's spirit. */
export const MAX_EDGE_M = 100;

export interface ResizeRoom {
  id: string;
  name: string;
  polygon: Polygon;
}

export type ResizeFailure =
  | 'degenerate'
  | 'overlap'
  | 'shared-conflict'
  | 'out-of-range'
  | 'not-found';

export type ResizeResult =
  | { ok: true; rooms: ResizeRoom[]; movedVertex: Vertex; affectedRoomIds: string[] }
  | { ok: false; reason: ResizeFailure; conflictRoomName?: string };

export interface ResizeInput {
  rooms: readonly ResizeRoom[];
  roomId: string;
  edgeIndex: number;
  newLengthM: number;
  /**
   * Which end of the edge stays put. 'start' (default) keeps vertex i and
   * moves vertex i+1; 'end' does the reverse.
   */
  anchor?: 'start' | 'end';
  /** Active snap step, used only for the lower bound of the valid range. */
  stepM?: number;
}

const same = (a: Vertex, b: Vertex): boolean =>
  Math.abs(a.x - b.x) < STRICT_EPS_M && Math.abs(a.y - b.y) < STRICT_EPS_M;

const r4 = (n: number): number => Number(n.toFixed(4));

/**
 * Does `p` lie strictly BETWEEN two consecutive vertices of `poly` — i.e. on
 * an edge but not on a corner? That is a T-junction, and moving the corner
 * would tear the neighbour's wall open, so we refuse instead.
 */
function liesMidEdge(poly: Polygon, p: Vertex): boolean {
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    if (same(a, p) || same(b, p)) return false;
    const vx = b.x - a.x;
    const vy = b.y - a.y;
    const len = Math.hypot(vx, vy);
    if (len < MIN_EDGE_M) continue;
    const cross = Math.abs((p.x - a.x) * vy - (p.y - a.y) * vx) / len;
    if (cross > STRICT_EPS_M) continue;
    const t = ((p.x - a.x) * vx + (p.y - a.y) * vy) / (len * len);
    if (t > STRICT_EPS_M && t < 1 - STRICT_EPS_M) return true;
  }
  return false;
}

/**
 * Resize one edge of one room to an exact length.
 *
 * Refuses — returning the reason and leaving `rooms` untouched **by
 * reference** — rather than half-applying. That contract matters: a partial
 * apply on a shared wall silently opens an overlap between two rooms that
 * previously shared geometry exactly.
 */
export function resizeRoomEdge(input: ResizeInput): ResizeResult {
  const { rooms, roomId, edgeIndex, newLengthM, anchor = 'start', stepM = 0.01 } = input;

  const lo = Math.max(stepM, 0.01);
  if (!Number.isFinite(newLengthM) || newLengthM < lo || newLengthM > MAX_EDGE_M) {
    return { ok: false, reason: 'out-of-range' };
  }

  const room = rooms.find((r) => r.id === roomId);
  if (!room) return { ok: false, reason: 'not-found' };

  const edges = roomEdges(room as EdgeRoom);
  const edge = edges[edgeIndex];
  if (!edge) return { ok: false, reason: 'not-found' };

  const poly = room.polygon;
  // roomEdges skips degenerate edges, so map back through the edge's own
  // endpoints rather than trusting edgeIndex to index the polygon directly.
  const iStart = poly.findIndex((v) => same(v, edge.a));
  const iEnd = poly.findIndex((v) => same(v, edge.b));
  if (iStart < 0 || iEnd < 0) return { ok: false, reason: 'not-found' };

  const fixedIdx = anchor === 'start' ? iStart : iEnd;
  const movingIdx = anchor === 'start' ? iEnd : iStart;
  const fixed = poly[fixedIdx];
  const moving = poly[movingIdx];

  const dx = moving.x - fixed.x;
  const dy = moving.y - fixed.y;
  const mag = Math.hypot(dx, dy);
  if (mag < MIN_EDGE_M) return { ok: false, reason: 'degenerate' };

  const next: Vertex = {
    x: r4(fixed.x + (dx / mag) * newLengthM),
    y: r4(fixed.y + (dy / mag) * newLengthM),
  };

  // A T-junction on any neighbour: the moving corner sits mid-wall on another
  // room. Moving it would tear that wall, so refuse and name the room.
  for (const other of rooms) {
    if (other.id === roomId) continue;
    if (other.polygon.length < 3) continue;
    if (liesMidEdge(other.polygon, moving)) {
      return { ok: false, reason: 'shared-conflict', conflictRoomName: other.name };
    }
  }

  // Move the vertex in EVERY room that carries it, so an attached neighbour
  // keeps sharing the wall exactly instead of being left behind.
  const affectedRoomIds: string[] = [];
  const nextRooms: ResizeRoom[] = rooms.map((r) => {
    if (r.polygon.length < 3) return r;
    let touched = false;
    const p2 = r.polygon.map((v) => {
      if (r.id === roomId) {
        if (same(v, moving) && v === poly[movingIdx]) {
          touched = true;
          return next;
        }
        return v;
      }
      if (same(v, moving)) {
        touched = true;
        return next;
      }
      return v;
    });
    if (!touched) return r;
    affectedRoomIds.push(r.id);
    return { ...r, polygon: p2 };
  });

  // Every surviving edge must still be a real edge.
  for (const id of affectedRoomIds) {
    const r = nextRooms.find((x) => x.id === id)!;
    for (let i = 0; i < r.polygon.length; i++) {
      const a = r.polygon[i];
      const b = r.polygon[(i + 1) % r.polygon.length];
      if (Math.hypot(b.x - a.x, b.y - a.y) < MIN_EDGE_M) {
        return { ok: false, reason: 'degenerate' };
      }
    }
  }

  // And the no-overlap invariant must still hold across the whole plan.
  const drawn = nextRooms.filter((r) => r.polygon.length >= 3);
  for (let i = 0; i < drawn.length; i++) {
    for (let j = i + 1; j < drawn.length; j++) {
      if (strictPolygonsOverlap(drawn[i].polygon, drawn[j].polygon)) {
        return { ok: false, reason: 'overlap' };
      }
    }
  }

  return { ok: true, rooms: nextRooms, movedVertex: next, affectedRoomIds };
}
