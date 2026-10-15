import { buildingLevels } from './building';
import { isRoofLevel } from './levels';
import { resolveServiceConnections } from './serviceConnections';
import type { ServiceRun } from './buildingServices';
import type { Property } from '../store/propertyStore';
import { serviceSystemDiscipline, type DisciplineVisibility } from './disciplineVisibility';

export interface ServiceRunPlacement extends ServiceRun { baseElevationM: number }
/** Floor datum is added once; visibility is presentation only, after canonical connections resolve. */
export function visibleServiceRuns(property: Pick<Property, 'levels' | 'wallHeightM' | 'services'>, activeLevelId: string, view: 'floor' | 'building', visible: DisciplineVisibility): ServiceRunPlacement[] {
  if (!property.services) return [];
  const elevations = new Map(buildingLevels(property).filter(entry => !isRoofLevel(entry.level)).map(entry => [entry.level.id, entry.elevationM]));
  return resolveServiceConnections(property.services).runs
    .filter(run => elevations.has(run.levelId) && (view === 'building' || run.levelId === activeLevelId) && visible[serviceSystemDiscipline(run.system)])
    .map(run => ({ ...run, baseElevationM: elevations.get(run.levelId)! }));
}
