/**
 * roof — the roof level's slabs (eco / solar 2026-09-04).
 *
 * Vic: "solar panels obviously need to be on a roof, as such when selecting
 * solar panels a roof with the roof surface measured at room scale can
 * automatically pop up; additionally a roof button is there so people can
 * also add any objects or flooring to the roof."
 *
 * A roof slab is a Room of `kind: 'roof'` on the roof level whose polygon
 * MIRRORS a drawn room on the storey beneath (the highest storey with any
 * drawn room). Making slabs real Rooms means everything that already works
 * on a room works on the roof for free: item placement + collision inside
 * the polygon, the flooring lattice, the Floor tool, undo, autosave, share.
 * The canvas draws a slab differently (no walls — see RoomCanvas), and the
 * wall tools refuse the roof level.
 *
 * `syncRoofRooms` is idempotent and returns the SAME property reference when
 * nothing changed, so callers can subscribe cheaply. Slab ids derive from
 * their source room's id, so items already placed on a slab survive a
 * re-sync when the room below is resized.
 */

import type { Property, Room } from '../store/propertyStore';
import type { Polygon } from '../lib/geometry';
import { polygonArea } from '../lib/geometry';
import { isDrawnPolygon } from './roomLayout';
import {
  ROOF_LEVEL_ID,
  isOutdoorRoom,
  isRoofLevel,
  isRoofRoom,
  levelsOf,
  roofSourceLevelId,
  roomLevelId,
} from './levels';

/** Stable slab id for a source room — items on the slab survive re-syncs. */
export function roofRoomIdFor(sourceRoomId: string): string {
  return `roof-${sourceRoomId}`;
}

/** Does a roof slab hold anything the customer made (items or floor)? */
export function roofRoomHasWork(r: Pick<Room, 'placedItems' | 'floorTiles' | 'floorFinish'>): boolean {
  return (
    r.placedItems.length > 0
    || (Array.isArray(r.floorTiles) && r.floorTiles.length > 0)
    || !!r.floorFinish
  );
}

function samePolygon(a: Polygon, b: Polygon): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (Math.abs(a[i].x - b[i].x) > 1e-9 || Math.abs(a[i].y - b[i].y) > 1e-9) return false;
  }
  return true;
}

/** The drawn rooms whose slabs the roof mirrors (on the roof's source storey). */
export function roofSourceRooms(property: Property): Room[] {
  const levels = levelsOf(property);
  const src = roofSourceLevelId(levels, property.rooms);
  if (!src) return [];
  return property.rooms.filter(
    (r) => roomLevelId(r) === src && !isOutdoorRoom(r) && !isRoofRoom(r) && isDrawnPolygon(r.polygon),
  );
}

/**
 * Rebuild the roof level's slabs from the storey beneath. No roof level ⇒
 * unchanged. Otherwise:
 *   • one slab per drawn source room (id `roof-<sourceId>`, same name and
 *     polygon); an existing slab keeps its items / floor and only its
 *     polygon + name are refreshed;
 *   • a slab whose source room is gone is dropped unless it holds work;
 *   • a blank non-slab room the store seeded on the roof (focus invariant)
 *     is dropped once real slabs exist.
 * Returns the same reference when nothing changed.
 */
export function syncRoofRooms(property: Property): Property {
  const levels = levelsOf(property);
  if (!levels.some((l) => isRoofLevel(l))) return property;

  const sources = roofSourceRooms(property);
  const existing = new Map<string, Room>();
  for (const r of property.rooms) if (isRoofRoom(r)) existing.set(r.id, r);

  const slabs: Room[] = [];
  let changed = false;
  for (const src of sources) {
    const id = roofRoomIdFor(src.id);
    const prev = existing.get(id);
    if (prev) {
      existing.delete(id);
      if (samePolygon(prev.polygon, src.polygon) && prev.name === src.name) {
        slabs.push(prev);
      } else {
        slabs.push({ ...prev, name: src.name, polygon: src.polygon.map((v) => ({ x: v.x, y: v.y })) });
        changed = true;
      }
    } else {
      slabs.push({
        id,
        name: src.name,
        polygon: src.polygon.map((v) => ({ x: v.x, y: v.y })),
        placedItems: [],
        kind: 'roof',
        levelId: ROOF_LEVEL_ID,
      });
      changed = true;
    }
  }
  // Orphans (source room removed): keep only those carrying work.
  for (const orphan of existing.values()) {
    if (roofRoomHasWork(orphan)) slabs.push(orphan);
    else changed = true;
  }

  // Non-slab rooms on the roof level: the blank room the focus invariant
  // seeds. Drop it once there are slabs to focus instead.
  const others: Room[] = [];
  for (const r of property.rooms) {
    if (isRoofRoom(r)) continue;
    const onRoof = roomLevelId(r) === ROOF_LEVEL_ID;
    if (onRoof && slabs.length > 0 && !isOutdoorRoom(r) && !isDrawnPolygon(r.polygon) && r.placedItems.length === 0) {
      changed = true;
      continue;
    }
    others.push(r);
  }

  if (!changed) return property;
  return { ...property, rooms: [...others, ...slabs] };
}

/** Total slab area on the roof, m². */
export function roofAreaM2(property: Pick<Property, 'rooms'>): number {
  return property.rooms
    .filter((r) => isRoofRoom(r) && isDrawnPolygon(r.polygon))
    .reduce((sum, r) => sum + polygonArea(r.polygon), 0);
}

/** The roof's slab polygons — what an item on the roof must be covered by. */
export function roofSlabPolygons(property: Pick<Property, 'rooms'>): Polygon[] {
  return property.rooms.filter((r) => isRoofRoom(r) && isDrawnPolygon(r.polygon)).map((r) => r.polygon);
}
