/**
 * floorPaintBrush — ONE place that turns "the brush touched this floor
 * point" into a store change. The plan's click path (RoomCanvas) and the
 * 3D room view (RoomView3D) both land here for 3D Mode flooring, so Tile /
 * Room scope, Erase and the Sims keys (Shift = room, Ctrl = erase) behave
 * identically whichever surface the customer painted on.
 *
 * Mirrors `wallPaintBrush.ts` for wall paint. The 2D Konva stroke path
 * (drag-rectangle) stays in RoomCanvas; this helper covers the tap / single
 * point cases the GL stage can aim at.
 */
import { useDesignerUIStore } from '../store/designerUIStore';
import { usePropertyStore } from '../store/propertyStore';
import { findFloorMaterialById } from '../data/floorMaterials';
import { roomFloorMaterial } from './floorFinish';
import {
  tileAt,
  tileIntersectsPolygon,
  tileRect,
  zoneForMaterial,
  type FloorZone,
} from './floorTiles';
import { findRoomAt, isDrawnPolygon } from './roomLayout';
import { activeLevelIdOf, isOutdoorRoom, roomsOnLevel } from './levels';
import type { BrushModifiers, BrushResult } from './wallPaintBrush';

export type FloorHit = { x: number; y: number };

/** The material name on the brush, or Erase. */
export function floorBrushLabel(draft: { materialId: string; erase: boolean }): string {
  if (draft.erase) return 'Erase';
  return findFloorMaterialById(draft.materialId)?.name ?? 'Floor';
}

function floorZoneForRoom(
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
 * Apply the current floor brush (scope, erase, material) to a floor point
 * in world metres. `null` when the tap missed every room.
 */
export function applyFloorPaintBrush(hit: FloorHit | null, mods: BrushModifiers = {}): BrushResult {
  const draft = useDesignerUIStore.getState().floorDraft;
  const ps = usePropertyStore.getState();
  if (!hit) return { message: 'Tap the floor to lay it.', kind: 'warn' };

  const lvl = activeLevelIdOf(ps.property);
  const levelRooms = roomsOnLevel(ps.property.rooms, lvl).filter(
    (r) => !isOutdoorRoom(r) && isDrawnPolygon(r.polygon),
  );
  const room = findRoomAt({ x: hit.x, y: hit.y }, levelRooms, ps.property.activeRoomId);
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

  // Tile scope: one tile under the cursor (a tap, or a zero-length stroke).
  const finish = roomFloorMaterial(room);
  if (finish && finish.tile_w_m === null) {
    return { message: 'This floor is a roll — Clear floor first', kind: 'warn' };
  }
  if (!mat || mat.tile_w_m === null || mat.tile_h_m === null) {
    return { message: 'This material lays whole-room only.', kind: 'warn' };
  }
  const zone = floorZoneForRoom(room, mat.id);
  if (!zone) return { message: null, kind: 'info' };
  const idx = tileAt(zone, hit);
  const rect = tileRect(zone, idx.row, idx.col);
  if (!tileIntersectsPolygon(rect, room.polygon)) {
    return { message: 'Tap inside a room to lay the floor.', kind: 'warn' };
  }
  const key = `${idx.row},${idx.col}`;
  ps.paintFloorTiles(room.id, zone, [key], erase);
  return erase
    ? { message: null, kind: 'info', detail: `${room.name} · tile cleared` }
    : { message: null, kind: 'success', detail: `${room.name} · ${label}` };
}
