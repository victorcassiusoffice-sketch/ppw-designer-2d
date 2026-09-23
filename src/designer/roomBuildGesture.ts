/** Rectangular room drag geometry shared by pointer previews and the release commit. */
import { snapToGrid, type Polygon, type Vertex } from '../lib/geometry';
import type { Property } from '../store/propertyStore';
import { levelElevationM } from './building';
import { activeLevelIdOf, isOutdoorRoom, isRoofLevel, isRoofRoom, levelsOf, roomLevelId } from './levels';
import { isDrawnPolygon, snapVertexToRooms, strictPolygonsOverlap, wallSnapTolM } from './roomLayout';

/** Reject a click or tiny pointer wobble rather than creating a zero-area room. */
export const MIN_ROOM_BUILD_SIDE_M = 0.1;

export interface RoomBuildOptions {
  stepM?: number;
  /** Capture at pointer-down so changing storeys cannot commit onto another floor. */
  levelId?: string;
}

export type RoomBuildFailureReason = 'invalid-point' | 'invalid-snap' | 'missing-level' | 'level-changed'
  | 'roof-level' | 'too-small' | 'off-plot' | 'overlapping-room';

export interface RoomBuildFailure {
  ok: false;
  reason: RoomBuildFailureReason;
  message: string;
}

interface RoomBuildGeometry {
  /** Raw gesture points retained for validation against the live property on release. */
  from: Vertex;
  to: Vertex;
  stepM: number;
  levelId: string;
  elevationM: number;
  /** Canonical clockwise rectangle in plan coordinates, including an invalid preview. */
  polygon: Polygon;
  widthM: number;
  depthM: number;
  areaM2: number;
}

export type RoomBuildPreview = RoomBuildGeometry & ({ ok: true } | RoomBuildFailure);

/**
 * Pure: call on pointer-down/move without changing stores or history. Shared
 * boundaries are legal; only genuine room overlap on this storey is refused.
 */
export function previewRectRoomBuild(
  property: Property,
  from: Vertex,
  to: Vertex,
  options: RoomBuildOptions = {},
): RoomBuildPreview {
  const levelId = options.levelId ?? activeLevelIdOf(property);
  const stepM = options.stepM ?? 0.5;
  let geometry: RoomBuildGeometry = {
    from: { ...from }, to: { ...to }, stepM, levelId,
    elevationM: levelElevationM(property, levelId),
    polygon: [], widthM: 0, depthM: 0, areaM2: 0,
  };
  const reject = (reason: RoomBuildFailureReason, message: string): RoomBuildPreview => ({ ...geometry, ok: false, reason, message });
  if (![from.x, from.y, to.x, to.y].every(Number.isFinite)) {
    return reject('invalid-point', 'Start and finish the room on the floor.');
  }
  if (!Number.isFinite(stepM) || stepM <= 0) return reject('invalid-snap', 'Choose a positive grid step.');
  const level = levelsOf(property).find((entry) => entry.id === levelId);
  if (!level) return reject('missing-level', 'That floor no longer exists. Choose a floor and draw again.');
  if (levelId !== activeLevelIdOf(property)) return reject('level-changed', 'The selected floor changed. Start the room again on this floor.');
  if (isRoofLevel(level)) return reject('roof-level', 'Choose a storey to build a room. The roof follows the rooms below.');

  const rooms = property.rooms.filter((room) => roomLevelId(room) === levelId
    && !isOutdoorRoom(room) && !isRoofRoom(room) && isDrawnPolygon(room.polygon));
  const site = property.site;
  const plot = site ? [
    { x: site.originM.x, y: site.originM.y },
    { x: site.originM.x + site.widthM, y: site.originM.y },
    { x: site.originM.x + site.widthM, y: site.originM.y + site.depthM },
    { x: site.originM.x, y: site.originM.y + site.depthM },
  ] : null;
  const snap = (point: Vertex): Vertex => {
    // A real wall wins over the grid so an off-grid shared wall remains flush.
    const wall = snapVertexToRooms(point, rooms, wallSnapTolM(stepM));
    if (wall) return wall.v;
    const boundary = plot && snapVertexToRooms(point, [{ id: 'plot', polygon: plot }], wallSnapTolM(stepM));
    if (boundary) return boundary.v;
    return { x: snapToGrid(point.x, stepM), y: snapToGrid(point.y, stepM) };
  };
  const a = snap(from), b = snap(to);
  const left = Math.min(a.x, b.x), right = Math.max(a.x, b.x);
  const top = Math.min(a.y, b.y), bottom = Math.max(a.y, b.y);
  const widthM = right - left, depthM = bottom - top;
  geometry = { ...geometry, widthM, depthM, areaM2: widthM * depthM, polygon: [
    { x: left, y: top }, { x: right, y: top }, { x: right, y: bottom }, { x: left, y: bottom },
  ] };
  if (![left, right, top, bottom, geometry.areaM2].every(Number.isFinite)) {
    return { ...reject('invalid-point', 'Start and finish the room on the floor.'), polygon: [], widthM: 0, depthM: 0, areaM2: 0 };
  }
  if (widthM < MIN_ROOM_BUILD_SIDE_M - 1e-8 || depthM < MIN_ROOM_BUILD_SIDE_M - 1e-8) {
    return reject('too-small', 'Drag out both room dimensions, at least 10 cm on each side.');
  }
  // Both shapes are rectangles, so testing the bounds also guarantees every
  // edge stays inside the plot. Boundary contact is intentionally allowed.
  if (site && (left < site.originM.x - 1e-8 || right > site.originM.x + site.widthM + 1e-8
    || top < site.originM.y - 1e-8 || bottom > site.originM.y + site.depthM + 1e-8)) {
    return reject('off-plot', 'Keep the room inside the plot, or enlarge the land.');
  }
  if (rooms.some((room) => strictPolygonsOverlap(geometry.polygon, room.polygon))) {
    return reject('overlapping-room', 'Rooms cannot overlap on the same floor. Shared walls are allowed.');
  }
  return { ...geometry, ok: true };
}
