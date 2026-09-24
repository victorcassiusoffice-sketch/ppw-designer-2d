import type { Property } from '../store/propertyStore';
import { buildSolids, type SceneSolids } from './roomSolids';
import type { SceneInput } from './roomView3d';
import { GROUND_LEVEL_ID, activeLevelIdOf, isOutdoorRoom, isRoofLevel, isRoofRoom, roomLevelId, roomsOnLevel } from './levels';
import { buildingLevels, levelElevationM, normaliseBuildingStairs, roofConfigOf, stairFootprint, stairRiseM, type BuildingStair } from './building';
import { stairFootprintInsideRoom, stairPlacementFits } from './stairPlacement';

export type BuildingView = 'building' | 'floor';

/** Geometry from each floor is built in isolation: coincident walls on different storeys are never neighbours. */
export function buildingSolids(
  property: Property,
  sceneForLevel: (property: Property) => SceneInput,
  view: BuildingView,
  showRoof: boolean,
): SceneSolids {
  const active = activeLevelIdOf(property);
  const entries = buildingLevels(property);
  const visible = entries.filter((entry) =>
    (view === 'building' || entry.level.id === active)
    && !(view === 'building' && isRoofLevel(entry.level) && !showRoof),
  );
  // Older saved stairs remain visible/editable after a room reshape. Only safe
  // placements cut the structure; these read-only queries never erase the save.
  const stairs = normaliseBuildingStairs(property.stairs, property);
  const openingStairs = stairs.filter((stair) => stairPlacementFits(property, stair));
  const result: SceneSolids = {
    wallHeightM: Math.max(2.7, ...visible.map((e) => e.elevationM + e.heightM)),
    activeLevelId: active, activeElevationM: levelElevationM(property, active),
    floors: [], walls: [], items: [], stairs: [], roofs: [],
    garden: view === 'building' || active === GROUND_LEVEL_ID ? property.garden : undefined,
    gardenSite: property.site ?? undefined,
    gardenVisible: view === 'building' || active === GROUND_LEVEL_ID,
    gardenObstacles: property.rooms.filter((room) =>
      roomLevelId(room) === GROUND_LEVEL_ID && !isOutdoorRoom(room) && !isRoofRoom(room) && room.polygon.length >= 3,
    ).map((room) => room.polygon),
  };
  for (const entry of visible) {
    const { level, elevationM, heightM } = entry;
    const rooms = roomsOnLevel(property.rooms, level.id);
    const mapped = sceneForLevel({ ...property, activeLevelId: level.id, wallHeightM: heightM || property.wallHeightM });
    // Roof slabs have floors but never perimeter room walls. The source mapper
    // treats them as outdoor item containers, so restore their slab explicitly.
    const source = isRoofLevel(level) ? { ...mapped, rooms: mapped.rooms.map((room) => ({ ...room, kind: 'outdoor' })) } : mapped;
    const local = buildSolids(source);
    if (isRoofLevel(level)) {
      for (const room of rooms.filter(isRoofRoom)) {
        if (room.polygon.length < 3) continue;
        const input = source.rooms.find((candidate) => candidate.id === room.id);
        local.floors.push({
          key: `floor-${room.id}`, roomId: room.id, polygon: room.polygon.map((point) => ({ ...point })),
          hex: input?.floorHex ?? '#a9aba6', kind: input?.floorKind, tileM: input?.floorTileM,
        });
      }
    }
    for (const floor of local.floors) {
      const holes = openingStairs
        .filter((s) => s.toLevelId === level.id)
        .map(stairFootprint)
        .filter((polygon) => stairFootprintInsideRoom(polygon, floor.polygon));
      result.floors.push({ ...floor, elevationM, levelId: level.id, holes });
    }
    result.walls.push(...local.walls.map((w) => ({ ...w, elevationM, levelId: level.id })));
    result.items.push(...local.items.map((it) => ({
      ...it, levelId: level.id, floorElevationM: elevationM, z0: it.z0 + elevationM, z1: it.z1 + elevationM,
      lightMountM: it.lightMountM === undefined ? undefined : it.lightMountM + elevationM,
    })));
    // Roof editing uses the slab plane. Thin PV panels would be buried by
    // even the flat covering; pitched-roof mounting is not modelled yet.
    // Keep the covering in the whole-building view, not over this work surface.
    if (isRoofLevel(level) && showRoof && view === 'building') {
      for (const room of rooms.filter(isRoofRoom)) {
        if (room.polygon.length >= 3) result.roofs!.push({ polygon: room.polygon, elevationM, config: roofConfigOf(property) });
      }
    }
  }
  for (const stair of stairs) {
    if (view === 'floor' && stair.fromLevelId !== active && stair.toLevelId !== active) continue;
    result.stairs!.push({ stair, baseM: levelElevationM(property, stair.fromLevelId), riseM: stairRiseM(property, stair) });
  }
  return result;
}

/** A stair must fit on both connected floors before a slab opening is cut. */
export function stairFitsRooms(property: Property, stair: BuildingStair): boolean {
  return stairPlacementFits(property, stair);
}
