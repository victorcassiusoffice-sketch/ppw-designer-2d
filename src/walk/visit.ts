import {cutPieces} from '../components/three/earthworkMeshes';
import { buildingSolids } from '../designer/buildingScene';
import { buildingLevels } from '../designer/building';
import { isOutdoorRoom, isRoofLevel, isRoofRoom, levelsOf, roofLevel, roomLevelId } from '../designer/levels';
import { roofSourceRooms, syncRoofRooms } from '../designer/roof';
import { stairPlacementFits } from '../designer/stairPlacement';
import type { SceneInput } from '../designer/roomView3d';
import type { Property } from '../store/propertyStore';

export function visitLevels(property: Property) {
  const levels = levelsOf(property);
  return !levels.some(isRoofLevel) && roofSourceRooms(property).length
    ? [...levels, roofLevel(levels)] : levels;
}

export function prepareWalkVisit(property: Property, sceneForLevel: (p: Property) => SceneInput) {
  const copy = structuredClone(property);
  const snapshot = syncRoofRooms({ ...copy, levels: visitLevels(copy) });
  const roof = snapshot.levels?.find(isRoofLevel);
  const solids = buildingSolids(roof ? { ...snapshot, activeLevelId: roof.id } : snapshot, sceneForLevel, 'building', true);
  // Elevated outdoor rooms have an authored floor even though the house
  // renderer usually uses outdoor rooms only as item containers.
  for (const { level, elevationM } of buildingLevels(snapshot).slice(1)) {
    if (isRoofLevel(level)) continue;
    const outside = snapshot.rooms.filter(room => roomLevelId(room) === level.id && isOutdoorRoom(room) && !isRoofRoom(room) && room.polygon.length >= 3);
    if (!outside.length) continue;
    const inputs = sceneForLevel({ ...snapshot, activeLevelId: level.id }).rooms;
    for (const room of outside) {
      if (solids.floors.some(f => f.roomId === room.id && f.levelId === level.id)) continue;
      const input = inputs.find(r => r.id === room.id);
      solids.floors.push({ roomId: room.id, key: 'floor-' + room.id, polygon: room.polygon,
        levelId: level.id, elevationM, hex: input?.floorHex ?? '#a9aba6', kind: input?.floorKind, tileM: input?.floorTileM });
    }
  }
  if(property.terrainCuts?.length){
    const ids=new Set(property.rooms.filter(isOutdoorRoom).map(r=>r.id));
    const ground=buildingLevels(property).find(l=>!isRoofLevel(l.level))?.level.id;
    solids.floors=solids.floors.flatMap(f=>{
      if(!ids.has(f.roomId)||(f.levelId??ground)!==ground)return [f];
      return cutPieces(f.polygon,property.terrainCuts!).map((polygon,i)=>({...f,key:f.key+'-soil-'+i,polygon}));
    });
  }
  const stairs = solids.stairs ?? [];
  const valid = stairs.filter(stair => stairPlacementFits(snapshot, stair.stair));
  return { property: snapshot, solids: { ...solids, stairs: valid }, invalidStairs: stairs.length - valid.length };
}
