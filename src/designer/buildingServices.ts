/** Measured coordination geometry. This is not hydraulic or electrical certification. */
import { SERVICE_MATERIALS } from '../data/buildingServicesCatalog';

export type ServiceSystem = 'cold-water' | 'hot-water' | 'waste' | 'electrical';
export type ServiceFixtureKind = 'toilet' | 'sink' | 'mains-tap' | 'electrical-board';
export interface ServicePoint {
  x: number;
  y: number;
}
export interface ServiceRun {
  id: string;
  levelId: string;
  system: ServiceSystem;
  materialId: string;
  diameterMm: number;
  points: ServicePoint[];
  /** Centre-line elevations relative to the finished floor; negative is below floor. */
  startElevationM: number;
  endElevationM: number;
}
export interface ServiceFixture {
  id: string;
  levelId: string;
  kind: ServiceFixtureKind;
  x: number;
  y: number;
  widthM: number;
  depthM: number;
  heightM: number;
  rotation: number;
}
export interface BuildingServices {
  version: 1;
  runs: ServiceRun[];
  fixtures: ServiceFixture[];
}
export const EMPTY_SERVICES: BuildingServices = { version: 1, runs: [], fixtures: [] };
export const SERVICE_SYSTEMS: { id: ServiceSystem; label: string; colour: string }[] = [
  { id: 'cold-water', label: 'Cold water', colour: '#286b96' },
  { id: 'hot-water', label: 'Hot water', colour: '#aa5545' },
  { id: 'waste', label: 'Drainage', colour: '#765845' },
  { id: 'electrical', label: 'Electric conduit', colour: '#89712d' },
];
export const SERVICE_FIXTURES: Record<
  ServiceFixtureKind,
  { label: string; widthM: number; depthM: number; heightM: number }
> = {
  toilet: { label: 'Toilet', widthM: 0.4, depthM: 0.7, heightM: 0.78 },
  sink: { label: 'Sink', widthM: 0.6, depthM: 0.48, heightM: 0.85 },
  'mains-tap': { label: 'Mains tap', widthM: 0.12, depthM: 0.16, heightM: 0.6 },
  'electrical-board': { label: 'Electrical board', widthM: 0.4, depthM: 0.12, heightM: 0.6 },
};
const finite = (v: unknown, min: number, max: number): v is number =>
  typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;
const key = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length <= 128;
const record = (v: unknown): Record<string, unknown> | null =>
  v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;

/** Reject malformed entities individually; never silently turn unknown floors into ground routes. */
export function normaliseBuildingServices(
  value: unknown,
  levelIds?: ReadonlySet<string>,
): BuildingServices | undefined {
  const raw = record(value);
  if (!raw || raw.version !== 1) return undefined;
  const seen = new Set<string>();
  const identity = (r: Record<string, unknown>) =>
    key(r.id) && !seen.has(r.id) && key(r.levelId) && (!levelIds || levelIds.has(r.levelId));
  const runs: ServiceRun[] = [];
  for (const value of (Array.isArray(raw.runs) ? raw.runs : []).slice(0, 2000)) {
    const r = record(value);
    if (
      !r ||
      !identity(r) ||
      !SERVICE_SYSTEMS.some((s) => s.id === r.system) ||
      !key(r.materialId) ||
      !finite(r.diameterMm, 5, 1000) ||
      !finite(r.startElevationM, -20, 20) ||
      !finite(r.endElevationM, -20, 20) ||
      !Array.isArray(r.points) ||
      r.points.length < 2 ||
      r.points.length > 500
    )
      continue;
    const points = r.points.map(record);
    if (points.some((p) => !p || !finite(p.x, -10000, 10000) || !finite(p.y, -10000, 10000)))
      continue;
    const run: ServiceRun = {
      id: r.id as string,
      levelId: r.levelId as string,
      system: r.system as ServiceSystem,
      materialId: r.materialId,
      diameterMm: r.diameterMm,
      startElevationM: r.startElevationM,
      endElevationM: r.endElevationM,
      points: points.map((p) => ({ x: p!.x as number, y: p!.y as number })),
    };
    if (serviceRunLengthM(run) < 0.01) continue;
    seen.add(run.id);
    runs.push(run);
  }
  const fixtures: ServiceFixture[] = [];
  for (const value of (Array.isArray(raw.fixtures) ? raw.fixtures : []).slice(0, 2000)) {
    const r = record(value);
    if (
      !r ||
      !identity(r) ||
      !Object.prototype.hasOwnProperty.call(SERVICE_FIXTURES, String(r.kind)) ||
      !finite(r.x, -10000, 10000) ||
      !finite(r.y, -10000, 10000) ||
      !finite(r.widthM, 0.05, 5) ||
      !finite(r.depthM, 0.05, 5) ||
      !finite(r.heightM, 0.05, 5) ||
      !finite(r.rotation, -36000, 36000)
    )
      continue;
    const fixture: ServiceFixture = {
      id: r.id as string,
      levelId: r.levelId as string,
      kind: r.kind as ServiceFixtureKind,
      x: r.x,
      y: r.y,
      widthM: r.widthM,
      depthM: r.depthM,
      heightM: r.heightM,
      rotation: ((r.rotation % 360) + 360) % 360,
    };
    seen.add(fixture.id);
    fixtures.push(fixture);
  }
  return { version: 1, runs, fixtures };
}

export function servicePlanLengthM(run: Pick<ServiceRun, 'points'>): number {
  return run.points
    .slice(1)
    .reduce((sum, p, i) => sum + Math.hypot(p.x - run.points[i].x, p.y - run.points[i].y), 0);
}
/** A constant gradient along the polyline, including vertical-only risers. */
export function serviceRunLengthM(
  run: Pick<ServiceRun, 'points' | 'startElevationM' | 'endElevationM'>,
): number {
  return Math.hypot(servicePlanLengthM(run), run.endElevationM - run.startElevationM);
}
export function estimateServices(services: BuildingServices) {
  return services.runs.map((run) => {
    const material = SERVICE_MATERIALS.find(
      (m) =>
        m.id === run.materialId &&
        m.system === run.system &&
        m.nominalDiameterMm === run.diameterMm,
    );
    const lengthM = serviceRunLengthM(run);
    return {
      id: run.id,
      levelId: run.levelId,
      materialId: run.materialId,
      lengthM,
      planLengthM: servicePlanLengthM(run),
      fallM: run.startElevationM - run.endElevationM,
      stockLengthM: material?.stockLengthM ?? null,
      // Whole lengths per run, no assumption of reusing offcuts across disconnected runs.
      stockLengths: material?.stockLengthM
        ? Math.ceil((lengthM - 1e-9) / material.stockLengthM)
        : null,
      verifiedMaterial: Boolean(material),
    };
  });
}
