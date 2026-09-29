import type { Vertex } from '../lib/geometry';
import type { Property, Room } from '../store/propertyStore';
import type { DoorDraft } from '../store/designerUIStore';
import { levelElevationM } from './building';
import { isOutdoorRoom, isRoofRoom, roomLevelId, roomsOnLevel } from './levels';
import { clampOpeningOffset, validateOpening, type Opening } from './openings';
import { isDrawnPolygon } from './roomLayout';
import { collinearOverlap, nearestEdge, pointAlongEdge, projectOntoEdge, roomEdges, type RoomEdge } from './wallEdges';

/** Openings in both rooms sharing a wall occupy the same physical space. */
export function openingsOnPhysicalWall(rooms: readonly Room[], host: Room, edge: RoomEdge, exceptId?: string) {
  const occupied: Array<Pick<Opening, 'offsetM' | 'widthM'>> = [];
  for (const room of rooms) {
    if (roomLevelId(room) !== roomLevelId(host) || isOutdoorRoom(room) || isRoofRoom(room)) continue;
    for (const other of roomEdges(room)) {
      if (!collinearOverlap(edge, other)) continue;
      for (const opening of room.openings ?? []) {
        if (opening.id === exceptId || opening.edgeIndex !== other.index) continue;
        occupied.push({ offsetM: projectOntoEdge(edge, pointAlongEdge(other, opening.offsetM)), widthM: opening.widthM });
      }
    }
  }
  return occupied;
}

export interface OpeningPlacementPreview {
  roomId: string;
  opening: Omit<Opening, 'id'>;
  edge: RoomEdge;
  a: Vertex;
  b: Vertex;
  elevationM: number;
  ok: boolean;
  message?: string;
}

/** Snap to this storey's room walls, clamp corners and check shared-wall gaps. */
export function previewOpeningPlacement(property: Property, levelId: string, point: Vertex, draft: DoorDraft, toleranceM = 0.6): OpeningPlacementPreview | null {
  if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) return null;
  const rooms = roomsOnLevel(property.rooms, levelId).filter(room => !isOutdoorRoom(room) && !isRoofRoom(room) && isDrawnPolygon(room.polygon));
  const hit = nearestEdge(point, rooms, toleranceM);
  if (!hit) return null;
  const room = rooms.find(entry => entry.id === hit.edge.roomId)!;
  const offsetM = clampOpeningOffset(hit.edge.lengthM, draft.widthM, hit.offsetM) ?? hit.offsetM;
  const opening = { ...draft, edgeIndex: hit.edge.index, offsetM, sillM: draft.kind === 'window' ? 0.9 : 0 };
  const validation = validateOpening(hit.edge.lengthM, opening, openingsOnPhysicalWall(rooms, room, hit.edge));
  return {
    roomId: room.id, opening, edge: hit.edge,
    a: pointAlongEdge(hit.edge, offsetM - draft.widthM / 2),
    b: pointAlongEdge(hit.edge, offsetM + draft.widthM / 2),
    elevationM: levelElevationM(property, levelId),
    ...validation,
  };
}
