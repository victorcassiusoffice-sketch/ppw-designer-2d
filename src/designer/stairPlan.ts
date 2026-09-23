import type { Property } from '../store/propertyStore';
import type { Polygon, Vertex } from '../lib/geometry';
import { levelsOf } from './levels';
import { stairFootprint, stairStepCount, type BuildingStair } from './building';

export interface StairPlanSymbol {
  id: string;
  footprint: Polygon;
  treads: Array<[Vertex, Vertex]>;
  arrow: [Vertex, Vertex];
  label: string;
  ascending: boolean;
  stair: BuildingStair;
}

export function stairPlanSymbols(
  property: Pick<Property, 'levels' | 'stairs' | 'wallHeightM'>,
  activeLevelId: string,
): StairPlanSymbol[] {
  const levels = levelsOf(property);
  return (property.stairs ?? []).filter((stair) => stair.fromLevelId === activeLevelId || stair.toLevelId === activeLevelId)
    .map((stair) => {
      const radians = stair.rotation * Math.PI / 180;
      const point = (x: number, y: number): Vertex => ({
        x: stair.x + x * Math.cos(radians) - y * Math.sin(radians),
        y: stair.y + x * Math.sin(radians) + y * Math.cos(radians),
      });
      const count = Math.min(128, stairStepCount(property, stair));
      const ascending = stair.fromLevelId === activeLevelId;
      const direction = ascending ? 1 : -1;
      const destination = levels.find((level) => level.id === (ascending ? stair.toLevelId : stair.fromLevelId));
      return {
        id: stair.id, stair, ascending, footprint: stairFootprint(stair),
        treads: Array.from({ length: Math.max(0, count - 1) }, (_, index): [Vertex, Vertex] => {
          const y = -stair.runM / 2 + stair.runM * (index + 1) / count;
          return [point(-stair.widthM / 2, y), point(stair.widthM / 2, y)];
        }),
        arrow: [point(0, -direction * stair.runM * 0.32), point(0, direction * stair.runM * 0.32)] as [Vertex, Vertex],
        label: `${ascending ? 'Up' : 'Down'} · ${destination?.name ?? 'Floor'}`,
      };
    });
}
