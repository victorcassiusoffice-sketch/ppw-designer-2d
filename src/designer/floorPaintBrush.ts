/**
 * floorPaintBrush — ONE place that turns "the brush touched this floor"
 * into a store change. The plan's click path (RoomCanvas) and the 3D room
 * view (RoomView3D) land here for 3D Mode flooring so Tile / Room scope,
 * Erase and the Sims keys (Shift = room, Ctrl = erase) behave identically.
 *
 * Sims floor gestures (docs/floor-paint-2026-08-28): click one tile, drag a
 * rectangle (commit on release), Shift = whole room, Ctrl = erase, one undo
 * per stroke. Drag-rect commit lives here; 2D still owns its Konva preview
 * ghosts, but both surfaces share the same write rules.
 */
import { useDesignerUIStore } from '../store/designerUIStore';
import { usePropertyStore } from '../store/propertyStore';
import { findFloorMaterialById } from '../data/floorMaterials';
import { roomFloorMaterial } from './floorFinish';
import {
  dragRectTileCount,
  tileAt,
  tileIntersectsPolygon,
  tileRect,
  tilesInDragRect,
  zoneForMaterial,
  type FloorZone,
} from './floorTiles';
import { findRoomAt, isDrawnPolygon } from './roomLayout';
import { activeLevelIdOf, isOutdoorRoom, roomsOnLevel } from './levels';
import type { BrushModifiers, BrushResult } from './wallPaintBrush';

export type FloorHit = { x: number; y: number };

/** Cap for one stroke — matches RoomCanvas (refuse rather than hang). */
export const MAX_TILES_PER_STROKE = 20000;

/** The material name on the brush, or Erase. */
export function floorBrushLabel(draft: { materialId: string; erase: boolean }): string {
  if (draft.erase) return 'Erase';
  return findFloorMaterialById(draft.materialId)?.name ?? 'Floor';
}

function levelIndoorRooms() {
  const ps = usePropertyStore.getState();
  const lvl = activeLevelIdOf(ps.property);
  return roomsOnLevel(ps.property.rooms, lvl).filter(
    (r) => !isOutdoorRoom(r) && isDrawnPolygon(r.polygon),
  );
}

function roomAtHit(hit: FloorHit) {
  const ps = usePropertyStore.getState();
  return findRoomAt({ x: hit.x, y: hit.y }, levelIndoorRooms(), ps.property.activeRoomId);
}

/** The infinite 3D ground plane is not necessarily a floor that can be painted. */
export function isPaintableFloorPoint(hit: FloorHit): boolean {
  return !!roomAtHit(hit);
}

export function floorZoneForRoom(
  room: { id: string; polygon: { x: number; y: number }[] },
  materialId: string,
): FloorZone | null {
  const mat = findFloorMaterialById(materialId);
  if (!mat || mat.tile_w_m === null || mat.tile_h_m === null) return null;
  const existing = usePropertyStore
    .getState()
    .property.rooms.find((r) => r.id === room.id)
    ?.floorTiles?.find((z) => z.materialId === mat.id);
  return existing ?? zoneForMaterial(mat.id, mat.tile_w_m, mat.tile_h_m, room.polygon);
}

/**
 * Live preview for a pending drag (no store write). Returns how many tiles
 * the release would touch, or null when the stroke is room-fill / erase-room
 * / not a tile stroke.
 */
export function previewFloorDrag(
  from: FloorHit,
  to: FloorHit,
  mods: BrushModifiers = {},
): { count: number; erase: boolean; roomName: string } | null {
  const draft = useDesignerUIStore.getState().floorDraft;
  const erase = draft.erase || !!mods.ctrl;
  const mat = findFloorMaterialById(draft.materialId);
  const fillRoom =
    draft.scope === 'room' || !!mods.shift || (mat ? mat.tile_w_m === null : false);
  if (fillRoom) return null;
  const room = roomAtHit(from);
  if (!room || !mat || mat.tile_w_m === null) return null;
  const zone = floorZoneForRoom(room, mat.id);
  if (!zone) return null;
  return { count: dragRectTileCount(zone, from, to), erase, roomName: room.name };
}

/**
 * Apply the current floor brush to a floor point (tap / Room / Shift / Ctrl).
 * For a Sims drag-rectangle, pass `end` — one undo frame covering the rect.
 */
export function applyFloorPaintBrush(
  hit: FloorHit | null,
  mods: BrushModifiers = {},
  end?: FloorHit | null,
): BrushResult {
  const draft = useDesignerUIStore.getState().floorDraft;
  const ps = usePropertyStore.getState();
  if (!hit) return { message: 'Tap the floor to lay it.', kind: 'warn' };

  const room = roomAtHit(hit);
  if (!room) return { message: 'Tap inside a room to lay the floor.', kind: 'warn' };

  const erase = draft.erase || !!mods.ctrl;
  const mat = findFloorMaterialById(draft.materialId);
  const fillRoom =
    draft.scope === 'room' || !!mods.shift || (mat ? mat.tile_w_m === null : false);
  const label = floorBrushLabel({ ...draft, erase });

  if (fillRoom) {
    if (erase) {
      ps.clearRoomFloor(room.id);
      return {
        message: `${room.name} — floor cleared`,
        kind: 'info',
        detail: `${room.name} · floor cleared`,
      };
    }
    if (!mat) return { message: 'Pick a floor material first.', kind: 'warn' };
    const n = ps.fillRoomFloor(room.id, mat.id);
    return mat.tile_w_m === null
      ? {
          message: `${room.name} — ${mat.name} laid`,
          kind: 'success',
          detail: `${room.name} · ${label}`,
        }
      : {
          message: `${room.name} — ${n} tiles laid`,
          kind: 'success',
          detail: `${room.name} · ${n} tiles · ${label}`,
        };
  }

  // Tile scope: drag rect (or a single tile when end is omitted / coincides).
  const finish = roomFloorMaterial(room);
  if (finish && finish.tile_w_m === null) {
    return { message: 'This floor is a roll — Clear floor first', kind: 'warn' };
  }
  if (!mat || mat.tile_w_m === null || mat.tile_h_m === null) {
    return { message: 'This material lays whole-room only.', kind: 'warn' };
  }
  const zone = floorZoneForRoom(room, mat.id);
  if (!zone) return { message: null, kind: 'info' };

  const to = end ?? hit;
  const pending = dragRectTileCount(zone, hit, to);
  if (pending > MAX_TILES_PER_STROKE) {
    return { message: 'That area is too large to lay in one go.', kind: 'warn' };
  }
  const tiles = tilesInDragRect(zone, hit, to, room.polygon);
  if (tiles.length === 0) {
    // Fall back: one tile under the press, if it intersects the room.
    const idx = tileAt(zone, hit);
    const rect = tileRect(zone, idx.row, idx.col);
    if (!tileIntersectsPolygon(rect, room.polygon)) {
      return { message: 'Tap inside a room to lay the floor.', kind: 'warn' };
    }
    ps.paintFloorTiles(room.id, zone, [`${idx.row},${idx.col}`], erase);
    return erase
      ? { message: null, kind: 'info', detail: `${room.name} · tile cleared` }
      : { message: null, kind: 'success', detail: `${room.name} · ${label}` };
  }
  const keys = tiles.map((t) => `${t.row},${t.col}`);
  ps.paintFloorTiles(room.id, zone, keys, erase);
  return erase
    ? {
        message: keys.length > 1 ? `${room.name} — ${keys.length} tiles cleared` : null,
        kind: 'info',
        detail:
          keys.length > 1
            ? `${room.name} · ${keys.length} tiles cleared`
            : `${room.name} · tile cleared`,
      }
    : {
        message: keys.length > 1 ? `${room.name} — ${keys.length} tiles laid` : null,
        kind: 'success',
        detail:
          keys.length > 1
            ? `${room.name} · ${keys.length} tiles · ${label}`
            : `${room.name} · ${label}`,
      };
}
