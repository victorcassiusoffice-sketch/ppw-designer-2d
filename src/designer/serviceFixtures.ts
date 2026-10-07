import type { Property } from '../store/propertyStore';
import { buildingLevels } from './building';
import { isRoofLevel } from './levels';
import { normaliseBuildingServices, type ServiceFixture } from './buildingServices';

export interface ServiceFixturePlacement extends ServiceFixture { elevationM: number }

/** Shared floor filtering for the ordinary plan and the 3D building. Positions
 * are centres in plan metres, rotation is clockwise around the footprint.
 * Pipe routes stay in the dedicated 2D services drawing; fixtures remain part
 * of the visible house on every saved floor. Unknown floors are never moved. */
export function visibleServiceFixtures(
  property: Pick<Property, 'levels' | 'wallHeightM' | 'services'>,
  activeLevelId: string,
  view: 'floor' | 'building' = 'floor',
): ServiceFixturePlacement[] {
  const levels = buildingLevels(property).filter(entry => !isRoofLevel(entry.level));
  const elevations = new Map(levels.map(entry => [entry.level.id, entry.elevationM]));
  const fixtures = property.services ? normaliseBuildingServices({ ...property.services, runs: [] }, new Set(elevations.keys()))?.fixtures ?? [] : [];
  return fixtures.filter(fixture => view === 'building' || fixture.levelId === activeLevelId)
    .map(fixture => ({ ...fixture, elevationM: elevations.get(fixture.levelId)! }));
}
