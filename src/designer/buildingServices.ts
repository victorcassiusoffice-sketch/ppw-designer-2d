/** Measured coordination geometry. This is not hydraulic or electrical certification. */
import { SERVICE_MATERIALS } from '../data/buildingServicesCatalog.js';

export type ServiceSystem =
  | 'cold-water'
  | 'hot-water'
  | 'waste'
  | 'electrical'
  | 'ventilation'
  | 'refrigerant'
  | 'fire-water'
  | 'data';
export type ServiceFixtureKind =
  | 'toilet'
  | 'sink'
  | 'mains-tap'
  | 'electrical-board'
  | 'sewer-connection'
  | 'air-conditioner'
  | 'outdoor-ac'
  | 'air-grille'
  | 'extractor-fan'
  | 'sprinkler'
  | 'fire-extinguisher'
  | 'security-camera'
  | 'network-switch';
export interface ServiceConnection {
  fixtureId: string;
  portId: ServiceSystem;
}
export interface ServicePoint {
  x: number;
  y: number;
  /** Node centre-line above this floor. Omitted legacy nodes use endpoint interpolation. */
  elevationM?: number;
  /** Explicit shared junction. A visual crossing never implies a connection. */
  junctionId?: string;
}
export interface ServiceJunction {
  id: string;
  levelId: string;
  system: ServiceSystem;
  x: number;
  y: number;
  elevationM: number;
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
  /** Explicit fixture links; visual crossings do not create a connection. */
  startConnection?: ServiceConnection;
  endConnection?: ServiceConnection;
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
  /** Bottom of the editable fixture envelope relative to this floor. */
  elevationM?: number;
  /** Dated catalogue reference, not evidence that envelope dimensions were verified. */
  productReferenceId?: string;
  /** User-entered port centre-line/invert elevations, relative to this floor. */
  portElevationsM?: Partial<Record<ServiceSystem, number>>;
  /** Project reference only; never evidence of utility approval. */
  connectionLabel?: string;
}
export interface BuildingServices {
  version: 1;
  runs: ServiceRun[];
  fixtures: ServiceFixture[];
  junctions?: ServiceJunction[];
}
export const EMPTY_SERVICES: BuildingServices = { version: 1, runs: [], fixtures: [] };
export const SERVICE_SYSTEMS: { id: ServiceSystem; label: string; colour: string }[] = [
  { id: 'cold-water', label: 'Cold water', colour: '#286b96' },
  { id: 'hot-water', label: 'Hot water', colour: '#aa5545' },
  { id: 'waste', label: 'Drainage', colour: '#765845' },
  { id: 'electrical', label: 'Electric conduit', colour: '#89712d' },
  { id: 'ventilation', label: 'Ventilation', colour: '#558a87' },
  { id: 'refrigerant', label: 'Refrigerant', colour: '#8263a5' },
  { id: 'fire-water', label: 'Fire water', colour: '#c64647' },
  { id: 'data', label: 'Data / security', colour: '#4e7e67' },
];
export const SERVICE_FIXTURES: Record<
  ServiceFixtureKind,
  { label: string; widthM: number; depthM: number; heightM: number }
> = {
  toilet: { label: 'Toilet', widthM: 0.4, depthM: 0.7, heightM: 0.78 },
  sink: { label: 'Sink', widthM: 0.6, depthM: 0.48, heightM: 0.85 },
  'mains-tap': { label: 'Mains tap', widthM: 0.12, depthM: 0.16, heightM: 0.6 },
  'electrical-board': { label: 'Electrical board', widthM: 0.4, depthM: 0.12, heightM: 0.6 },
  'sewer-connection': { label: 'Drainage connection', widthM: 0.6, depthM: 0.6, heightM: 0.6 },
  'air-conditioner': { label: 'Indoor AC', widthM: 0.8, depthM: 0.22, heightM: 0.3 },
  'outdoor-ac': { label: 'Outdoor AC', widthM: 0.8, depthM: 0.35, heightM: 0.6 },
  'air-grille': { label: 'Air grille', widthM: 0.3, depthM: 0.1, heightM: 0.3 },
  'extractor-fan': { label: 'Extractor fan', widthM: 0.3, depthM: 0.15, heightM: 0.3 },
  sprinkler: { label: 'Sprinkler', widthM: 0.08, depthM: 0.08, heightM: 0.08 },
  'fire-extinguisher': { label: 'Fire extinguisher', widthM: 0.18, depthM: 0.18, heightM: 0.55 },
  'security-camera': { label: 'Security camera', widthM: 0.18, depthM: 0.25, heightM: 0.16 },
  'network-switch': { label: 'Network switch', widthM: 0.44, depthM: 0.25, heightM: 0.05 },
};
const finite = (v: unknown, min: number, max: number): v is number =>
  typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;
const key = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length <= 128;
const record = (v: unknown): Record<string, unknown> | null =>
  v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
function connection(value: unknown): ServiceConnection | undefined {
  const r = record(value);
  return r && key(r.fixtureId) && SERVICE_SYSTEMS.some((s) => s.id === r.portId)
    ? { fixtureId: r.fixtureId, portId: r.portId as ServiceSystem }
    : undefined;
}

/** Reject malformed entities individually; never silently turn unknown floors into ground routes. */
export function normaliseBuildingServices(
  value: unknown,
  levelIds?: ReadonlySet<string>,
): BuildingServices | undefined {
  const raw = record(value);
  if (!raw || raw.version !== 1) return undefined;
  if (raw.junctions !== undefined && !Array.isArray(raw.junctions)) return undefined;
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
    if (
      points.some(
        (p) =>
          !p ||
          !finite(p.x, -10000, 10000) ||
          !finite(p.y, -10000, 10000) ||
          (p.elevationM !== undefined && !finite(p.elevationM, -20, 20)) ||
          (p.junctionId !== undefined && !key(p.junctionId)),
      )
    )
      continue;
    const run: ServiceRun = {
      id: r.id as string,
      levelId: r.levelId as string,
      system: r.system as ServiceSystem,
      materialId: r.materialId,
      diameterMm: r.diameterMm,
      startElevationM: r.startElevationM,
      endElevationM: r.endElevationM,
      points: points.map((p) => ({
        x: p!.x as number,
        y: p!.y as number,
        ...(p!.elevationM !== undefined ? { elevationM: p!.elevationM as number } : {}),
        ...(p!.junctionId !== undefined ? { junctionId: p!.junctionId as string } : {}),
      })),
    };
    if (connection(r.startConnection)) run.startConnection = connection(r.startConnection);
    if (connection(r.endConnection)) run.endConnection = connection(r.endConnection);
    if (
      (run.startConnection && run.points[0].junctionId) ||
      (run.endConnection && run.points[run.points.length - 1]?.junctionId)
    )
      continue;
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
      !finite(r.widthM, 0.005, 5) ||
      !finite(r.depthM, 0.005, 5) ||
      !finite(r.heightM, 0.005, 5) ||
      !finite(r.rotation, -36000, 36000) ||
      (r.elevationM !== undefined && !finite(r.elevationM, -20, 20)) ||
      (r.productReferenceId !== undefined && !key(r.productReferenceId))
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
    const elevations = record(r.portElevationsM);
    if (elevations) {
      const entries = SERVICE_SYSTEMS.filter((s) => finite(elevations[s.id], -20, 20)).map((s) => [
        s.id,
        elevations[s.id],
      ]);
      if (entries.length) fixture.portElevationsM = Object.fromEntries(entries);
    }
    if (key(r.connectionLabel)) fixture.connectionLabel = r.connectionLabel.trim();
    if (r.elevationM !== undefined) fixture.elevationM = r.elevationM as number;
    if (key(r.productReferenceId)) fixture.productReferenceId = r.productReferenceId;
    seen.add(fixture.id);
    fixtures.push(fixture);
  }
  const junctions: ServiceJunction[] = [];
  for (const value of (Array.isArray(raw.junctions) ? raw.junctions : []).slice(0, 2000)) {
    const j = record(value);
    if (
      !j ||
      !identity(j) ||
      !SERVICE_SYSTEMS.some((s) => s.id === j.system) ||
      !finite(j.x, -10000, 10000) ||
      !finite(j.y, -10000, 10000) ||
      !finite(j.elevationM, -20, 20)
    )
      continue;
    junctions.push({
      id: j.id as string,
      levelId: j.levelId as string,
      system: j.system as ServiceSystem,
      x: j.x,
      y: j.y,
      elevationM: j.elevationM,
    });
    seen.add(j.id as string);
  }
  return { version: 1, runs, fixtures, ...(raw.junctions !== undefined ? { junctions } : {}) };
}

export function servicePlanLengthM(run: Pick<ServiceRun, 'points'>): number {
  return run.points
    .slice(1)
    .reduce((sum, p, i) => sum + Math.hypot(p.x - run.points[i].x, p.y - run.points[i].y), 0);
}
/** Legacy points interpolate by travelled plan distance; explicit node heights win.
 * Vertical-only legacy routes interpolate by index. This preserves old takeoffs. */
export function serviceRunPoints3D(
  run: Pick<ServiceRun, 'points' | 'startElevationM' | 'endElevationM'>,
): { x: number; y: number; elevationM: number }[] {
  const length = servicePlanLengthM(run);
  let travelled = 0;
  return run.points.map((point, index) => {
    if (index)
      travelled += Math.hypot(point.x - run.points[index - 1].x, point.y - run.points[index - 1].y);
    const t = length > 0 ? travelled / length : index / Math.max(1, run.points.length - 1);
    return {
      x: point.x,
      y: point.y,
      elevationM:
        point.elevationM ?? run.startElevationM + t * (run.endElevationM - run.startElevationM),
    };
  });
}
/** Actual segmentwise centre-line length, including vertical risers and changes in gradient. */
export function serviceRunLengthM(
  run: Pick<ServiceRun, 'points' | 'startElevationM' | 'endElevationM'>,
): number {
  const points = serviceRunPoints3D(run);
  return points
    .slice(1)
    .reduce(
      (sum, point, i) =>
        sum +
        Math.hypot(
          point.x - points[i].x,
          point.y - points[i].y,
          point.elevationM - points[i].elevationM,
        ),
      0,
    );
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
      fallM:
        (serviceRunPoints3D(run)[0]?.elevationM ?? 0) -
        (serviceRunPoints3D(run)[run.points.length - 1]?.elevationM ?? 0),
      stockLengthM: material?.stockLengthM ?? null,
      // Whole lengths per run, no assumption of reusing offcuts across disconnected runs.
      stockLengths: material?.stockLengthM
        ? Math.ceil((lengthM - 1e-9) / material.stockLengthM)
        : null,
      verifiedMaterial: Boolean(material),
    };
  });
}
