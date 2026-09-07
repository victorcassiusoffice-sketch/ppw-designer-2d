/**
 * Which room does a whole-room action (Floor "Room", Wall paint "Room")
 * act on?
 *
 * Verify pass (2026-09-07, desktop + phone journeys, P2): dropping a product
 * just outside a wall moves focus to Outdoors (the attached multi-room
 * contract — a drop outside every room lands in the garden and the garden
 * becomes the active container). The customer, still looking at the room
 * they just furnished, then pressed Floor → Room and saw "Draw a room first"
 * next to "30 tiles laid" — two toasts contradicting each other, and no
 * floor. Outdoors has no floor to tile and no walls to paint, so it must
 * never be the target of a room action.
 *
 * Rule, in order:
 *   1. the active room, when it is a drawn INDOOR room;
 *   2. otherwise the indoor room the customer was in most recently
 *      (`lastIndoorRoomId`, kept by App as focus moves);
 *   3. otherwise the first drawn indoor room on the plan;
 *   4. otherwise null — there is truly nothing to lay or paint.
 */
import { isDrawnPolygon } from './roomLayout';
import { isOutdoorRoom } from './levels';
import type { Polygon } from '../lib/geometry';

export interface FloorTargetRoom {
  id: string;
  polygon: Polygon;
  kind?: string;
}

export function floorTargetRoom<T extends FloorTargetRoom>(
  rooms: readonly T[],
  activeRoomId: string | null | undefined,
  lastIndoorRoomId: string | null | undefined,
): T | null {
  const indoor = (r: T | undefined): r is T => !!r && isDrawnPolygon(r.polygon) && !isOutdoorRoom(r);
  const active = rooms.find((r) => r.id === activeRoomId);
  if (indoor(active)) return active;
  const last = rooms.find((r) => r.id === lastIndoorRoomId);
  if (indoor(last)) return last;
  return rooms.find(indoor) ?? null;
}
