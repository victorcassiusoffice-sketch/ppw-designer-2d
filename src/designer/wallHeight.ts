import { MAX_WALL_HEIGHT_M, MIN_WALL_HEIGHT_M, DEFAULT_WALL_HEIGHT_M } from '../data/wallPaints';
import type { Property } from '../store/propertyStore';
import { levelHeightM, MAX_LEVEL_HEIGHT_M, MIN_LEVEL_HEIGHT_M } from './building';
import { activeLevelIdOf, isRoofLevel, levelsOf, storeyLevels } from './levels';

/** "2.70" → "2.7", while an entered hundredth stays visible. */
export function formatWallHeightM(heightM: number): string {
  return String(Number(heightM.toFixed(2)));
}

export function wallHeightControlTarget(property: Pick<Property, 'levels' | 'activeLevelId' | 'wallHeightM'>) {
  const levels = levelsOf(property);
  const activeId = activeLevelIdOf(property);
  const active = levels.find((level) => level.id === activeId)!;
  if (isRoofLevel(active)) return null;
  // An override can remain after another floor is deleted; the bar must still
  // edit what is rendered rather than changing a hidden property default.
  const perLevel = storeyLevels(levels).length > 1 || active.heightM !== undefined;
  return {
    levelId: perLevel ? activeId : null,
    label: perLevel ? `${active.name} walls` : 'every wall',
    heightM: perLevel ? levelHeightM(property, activeId) : property.wallHeightM ?? DEFAULT_WALL_HEIGHT_M,
    minM: perLevel ? MIN_LEVEL_HEIGHT_M : MIN_WALL_HEIGHT_M,
    maxM: perLevel ? MAX_LEVEL_HEIGHT_M : MAX_WALL_HEIGHT_M,
  };
}
