import { buildingLevels } from './building';
import { isRoofLevel } from './levels';
import { resolveServiceConnections } from './serviceConnections';
import { serviceRunPoints3D, type ServiceRun, type BuildingServices } from './buildingServices';
import { placedTanks, tankPortNozzles, type TankPortNozzle } from './tankNetwork';
import type { Property } from '../store/propertyStore';
import {
  ALL_VISIBILITY_PARTS,
  serviceFixtureDiscipline,
  serviceSystemDiscipline,
  type DisciplineVisibility,
  type PartVisibility,
} from './disciplineVisibility';

export interface ServiceRunPlacement extends ServiceRun {
  baseElevationM: number;
  tankNozzles?: TankPortNozzle[];
}
type ServiceProperty = Pick<Property, 'levels' | 'wallHeightM' | 'services'> &
  Partial<Pick<Property, 'rooms'>>;
type Floor = ReturnType<typeof buildingLevels>[number];

// Explicit floor elevations may leave a service void above a slab.
function nextDatum(floor: Floor, levels: Floor[]) {
  return levels.reduce(
    (top, f) => (f.elevationM > floor.elevationM ? Math.min(top, f.elevationM) : top),
    Infinity,
  );
}

/** Clip a tank route for a single-floor drawing. The stored run always keeps
 * its complete length in its originating floor's coordinates. */
function inFloor(run: ServiceRun, source: Floor, floor: Floor, top: number): ServiceRun | null {
  const bottom = floor.elevationM;
  const original = serviceRunPoints3D(run);
  const points: typeof original = [];
  for (let i = 1; i < original.length; i++) {
    const a = original[i - 1],
      b = original[i];
    const za = source.elevationM + a.elevationM,
      zb = source.elevationM + b.elevationM;
    const dz = zb - za;
    let t0 = 0,
      t1 = 1;
    if (dz === 0) {
      if (za < bottom || za >= top) continue;
    } else {
      const tBottom = (bottom - za) / dz,
        tTop = (top - za) / dz;
      t0 = Math.max(0, Math.min(tBottom, tTop));
      t1 = Math.min(1, Math.max(tBottom, tTop));
      if (t1 <= t0) continue;
    }
    for (const t of [t0, t1]) {
      const point = {
        x: a.x + t * (b.x - a.x),
        y: a.y + t * (b.y - a.y),
        elevationM: za + t * dz - bottom,
      };
      const last = points[points.length - 1];
      if (
        !last ||
        Math.hypot(last.x - point.x, last.y - point.y, last.elevationM - point.elevationM) > 1e-8
      )
        points.push(point);
    }
  }
  return points.length < 2
    ? null
    : {
        ...run,
        levelId: floor.level.id,
        points,
        startElevationM: points[0].elevationM,
        endElevationM: points[points.length - 1].elevationM,
      };
}

export function tankRunOnFloor(
  property: ServiceProperty,
  run: ServiceRun,
  levelId: string,
): ServiceRun | null {
  const levels = buildingLevels(property);
  const source = levels.find((e) => e.level.id === run.levelId),
    floor = levels.find((e) => e.level.id === levelId);
  return run.tankRoute && source && floor
    ? inFloor(run, source, floor, nextDatum(floor, levels))
    : null;
}

/** Floor datum is added once; visibility is presentation only, after canonical connections resolve. */
export function visibleServiceRuns(
  property: ServiceProperty,
  activeLevelId: string,
  view: 'floor' | 'building',
  visible: DisciplineVisibility,
  parts: PartVisibility = ALL_VISIBILITY_PARTS,
): ServiceRunPlacement[] {
  if (!property.services || !parts.routes) return [];
  const floors = buildingLevels(property);
  const levels = new Map(floors.map((entry) => [entry.level.id, entry]));
  const tanks =
    property.rooms && property.services.runs.some((r) => r.tankRoute)
      ? placedTanks({ ...property, rooms: property.rooms })
      : [];
  const active = levels.get(activeLevelId);
  const top = active && nextDatum(active, floors);
  return resolveServiceConnections(property.services).runs.flatMap((run): ServiceRunPlacement[] => {
    const source = levels.get(run.levelId);
    if (!source || !visible[serviceSystemDiscipline(run.system)]) return [];
    const nozzles = parts.equipment && run.tankRoute ? tankPortNozzles(tanks, run) : undefined;
    if (run.tankRoute && view === 'floor') {
      const local = active && top !== undefined && inFloor(run, source, active, top);
      return active && local
        ? [
            {
              ...local,
              baseElevationM: active.elevationM,
              tankNozzles: nozzles?.filter((n) => n.levelId === active.level.id),
            },
          ]
        : [];
    }
    if (
      (!run.tankRoute && isRoofLevel(source.level)) ||
      (view === 'floor' && source.level.id !== activeLevelId)
    )
      return [];
    return [
      { ...run, baseElevationM: source.elevationM, ...(nozzles ? { tankNozzles: nozzles } : {}) },
    ];
  });
}

/** Resolve the full network before hiding fixtures: a hidden sink must not detach its pipe. */
export function filterServicePresentation(
  services: BuildingServices,
  visible: DisciplineVisibility,
  parts: PartVisibility,
): BuildingServices {
  const resolved = resolveServiceConnections(services);
  return {
    ...resolved,
    runs: resolved.runs.filter(
      (run) => parts.routes && visible[serviceSystemDiscipline(run.system)],
    ),
    fixtures: resolved.fixtures.filter(
      (fixture) => parts.equipment && visible[serviceFixtureDiscipline(fixture.kind)],
    ),
  };
}
