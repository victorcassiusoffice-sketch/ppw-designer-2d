import { ShapeGeometry, Shape, Vector2 } from 'three';
import { lawnFootprint } from '../components/three/gardenSurround';
import { gardenSurfacePolygon } from '../designer/garden';
import { buildingLevels } from '../designer/building';
import { isOutdoorRoom, isRoofLevel, roomLevelId } from '../designer/levels';
import type { SceneSolids } from '../designer/roomSolids';
import type { Property } from '../store/propertyStore';
import type { Polygon } from '../lib/geometry';

export interface WalkPatch {
  polygon: Polygon;
  levelId: string;
  elevationM: number;
}

/** Use the same lawn cutouts and explicit surface footprints as the plan renderer. */
export function outdoorPatches(solids: SceneSolids, property: Property): WalkPatch[] {
  const ground = buildingLevels(property).find(entry => !isRoofLevel(entry.level))!;
  const patches: WalkPatch[] = [];
  const add = (polygon: Polygon, elevationM: number, levelId = ground.level.id) => {
    if (polygon.length >= 3) patches.push({ polygon, levelId, elevationM });
  };
  const garden = solids.garden ?? property.garden;
  const rooms = property.rooms.filter(room => room.polygon.length >= 3 && roomLevelId(room) === ground.level.id);
  const lawn = lawnFootprint(rooms.filter(r => !isOutdoorRoom(r)).map(room => room.polygon), garden, solids.gardenSite ?? property.site ?? undefined);
  for (const piece of lawn?.pieces ?? []) add(piece, ground.elevationM - .0005);
  if (!lawn) for (const room of rooms.filter(isOutdoorRoom)) add(room.polygon, ground.elevationM);
  for (const surface of garden?.surfaces ?? []) {
    if (surface.kind !== 'pool') add(gardenSurfacePolygon(surface), surface.elevationM);
  }
  if (!lawn && !patches.length) {
    // The empty Designer stage already draws a 600 m backdrop, centred on the origin.
    add([{ x: -300, y: -300 }, { x: 300, y: -300 }, { x: 300, y: 300 }, { x: -300, y: 300 }], -.002);
  }
  return patches;
}

export function patchGeometry(patch: WalkPatch): ShapeGeometry {
  const mesh = new ShapeGeometry(new Shape(patch.polygon.map(p => new Vector2(p.x, -p.y))));
  return mesh.rotateX(-Math.PI / 2).translate(0, patch.elevationM, 0);
}
