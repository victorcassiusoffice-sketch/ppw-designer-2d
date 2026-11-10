import { buildingSolids } from '../designer/buildingScene';
import { isRoofLevel, levelsOf, roofLevel } from '../designer/levels';
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
  const stairs = solids.stairs ?? [];
  const valid = stairs.filter(stair => stairPlacementFits(snapshot, stair.stair));
  return { property: snapshot, solids: { ...solids, stairs: valid }, invalidStairs: stairs.length - valid.length };
}
