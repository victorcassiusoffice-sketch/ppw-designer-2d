import { buildingLevels } from './building';
import { isRoofLevel } from './levels';
import { resolveServiceConnections } from './serviceConnections';
import type { ServiceRun, BuildingServices } from './buildingServices';
import type { Property } from '../store/propertyStore';
import { ALL_VISIBILITY_PARTS, serviceFixtureDiscipline, serviceSystemDiscipline, type DisciplineVisibility, type PartVisibility } from './disciplineVisibility';

export interface ServiceRunPlacement extends ServiceRun { baseElevationM: number }
/** Floor datum is added once; visibility is presentation only, after canonical connections resolve. */
export function visibleServiceRuns(property: Pick<Property, 'levels' | 'wallHeightM' | 'services'>, activeLevelId: string, view: 'floor' | 'building', visible: DisciplineVisibility, parts: PartVisibility = ALL_VISIBILITY_PARTS): ServiceRunPlacement[] {
  if (!property.services || !parts.routes) return [];
  const elevations = new Map(buildingLevels(property).filter(entry => !isRoofLevel(entry.level)).map(entry => [entry.level.id, entry.elevationM]));
  return resolveServiceConnections(property.services).runs
    .filter(run => elevations.has(run.levelId) && (view === 'building' || run.levelId === activeLevelId) && visible[serviceSystemDiscipline(run.system)])
    .map(run => ({ ...run, baseElevationM: elevations.get(run.levelId)! }));
}

/** Resolve the full network before hiding fixtures: a hidden sink must not detach its pipe. */
export function filterServicePresentation(services: BuildingServices, visible: DisciplineVisibility, parts: PartVisibility): BuildingServices {
  const resolved = resolveServiceConnections(services);
  return { ...resolved, runs: resolved.runs.filter(run => parts.routes && visible[serviceSystemDiscipline(run.system)]), fixtures: resolved.fixtures.filter(fixture => parts.equipment && visible[serviceFixtureDiscipline(fixture.kind)]) };
}
