/** Explicit planning topology. Generic ports are schematic, never a product
 * connector or a hydraulic/electrical approval. A crossing is not a junction. */
import {
  SERVICE_FIXTURES,
  type BuildingServices,
  type ServiceConnection,
  type ServiceFixture,
  type ServicePoint,
  type ServiceRun,
  type ServiceSystem,
} from './buildingServices.js';

export type ServiceEndpoint = 'start' | 'end';
export interface FixtureServicePort extends ServicePoint {
  fixtureId: string;
  levelId: string;
  id: ServiceSystem;
  label: string;
  /** Null means a surveyed invert is required before connection. */
  elevationM: number | null;
  schematic: true;
}
export function servicePorts(fixture: ServiceFixture): FixtureServicePort[] {
  const ports: { id: ServiceSystem; label: string; x: number; y: number; height: number | null }[] =
    [];
  if (fixture.kind === 'toilet')
    ports.push(
      { id: 'cold-water', label: 'Cold inlet', x: -0.3, y: -0.4, height: fixture.heightM * 0.72 },
      { id: 'waste', label: 'Waste outlet', x: 0, y: 0, height: 0.14 },
    );
  if (fixture.kind === 'sink')
    ports.push(
      { id: 'cold-water', label: 'Cold inlet', x: -0.25, y: -0.4, height: fixture.heightM * 0.68 },
      { id: 'hot-water', label: 'Hot inlet', x: 0.25, y: -0.4, height: fixture.heightM * 0.68 },
      { id: 'waste', label: 'Waste outlet', x: 0, y: 0, height: fixture.heightM * 0.5 },
    );
  if (fixture.kind === 'mains-tap')
    ports.push({
      id: 'cold-water',
      label: 'Private-side water supply',
      x: 0,
      y: 0,
      height: fixture.heightM * 0.6,
    });
  if (fixture.kind === 'electrical-board')
    ports.push({
      id: 'electrical',
      label: 'Board conduit entry',
      x: 0,
      y: 0,
      height: fixture.heightM * 0.5,
    });
  if (fixture.kind === 'sewer-connection')
    ports.push({ id: 'waste', label: 'Surveyed drain connection', x: 0, y: 0, height: null });
  const angle = (fixture.rotation * Math.PI) / 180,
    c = Math.cos(angle),
    s = Math.sin(angle);
  return ports.map((port) => {
    const x = port.x * fixture.widthM,
      y = port.y * fixture.depthM;
    return {
      fixtureId: fixture.id,
      levelId: fixture.levelId,
      id: port.id,
      label: port.label,
      x: fixture.x + x * c - y * s,
      y: fixture.y + x * s + y * c,
      // Remove binary multiplication artefacts from schematic defaults only;
      // a surveyed elevation entered by the user retains its exact value.
      elevationM:
        fixture.portElevationsM?.[port.id] ??
        (port.height === null ? null : Number(port.height.toPrecision(12))),
      schematic: true,
    };
  });
}
export function servicePortLabel(fixture: ServiceFixture, port: FixtureServicePort): string {
  return `${fixture.connectionLabel || SERVICE_FIXTURES[fixture.kind].label} · ${port.label} · ${fixture.id.slice(-4)}`;
}
export function compatibleServicePorts(
  services: BuildingServices,
  levelId: string,
  system: ServiceSystem,
) {
  return services.fixtures
    .filter((f) => f.levelId === levelId)
    .flatMap((f) => servicePorts(f).filter((p) => p.id === system));
}
function linkedPort(run: ServiceRun, reference: ServiceConnection, services: BuildingServices) {
  const fixture = services.fixtures.find((f) => f.id === reference.fixtureId);
  if (!fixture || fixture.levelId !== run.levelId) return undefined;
  return servicePorts(fixture).find(
    (p) => p.id === reference.portId && p.id === run.system && p.elevationM !== null,
  );
}
/** Recompute only the linked endpoints. Interior bends and unlinked elevations
 * remain user-owned. Missing/mismatched targets keep their last coordinates and
 * reference so the next session still reports the unresolved connection. */
export function resolveServiceConnections(services: BuildingServices): BuildingServices {
  return {
    ...services,
    runs: services.runs.map((run) => {
      const next = { ...run, points: run.points.map((p) => ({ ...p })) };
      for (const endpoint of ['start', 'end'] as const) {
        const connection = run[`${endpoint}Connection`];
        if (!connection) continue;
        const port = linkedPort(run, connection, services);
        if (!port) continue;
        next.points[endpoint === 'start' ? 0 : next.points.length - 1] = { x: port.x, y: port.y };
        next[`${endpoint}ElevationM`] = port.elevationM!;
      }
      return next;
    }),
  };
}
export function connectServiceEndpoint(
  services: BuildingServices,
  runId: string,
  endpoint: ServiceEndpoint,
  reference: ServiceConnection | null,
): BuildingServices | null {
  const run = services.runs.find((r) => r.id === runId);
  if (!run || (reference && !linkedPort(run, reference, services))) return null;
  const next = { ...run };
  if (reference) next[`${endpoint}Connection`] = { ...reference };
  else delete next[`${endpoint}Connection`];
  return resolveServiceConnections({
    ...services,
    runs: services.runs.map((r) => (r.id === runId ? next : r)),
  });
}
export interface ServiceConnectionIssue {
  runId: string;
  endpoint: ServiceEndpoint;
  message: string;
}
export function serviceConnectionWarnings(services: BuildingServices): ServiceConnectionIssue[] {
  return services.runs.flatMap((run) =>
    (['start', 'end'] as const).flatMap((endpoint) => {
      const reference = run[`${endpoint}Connection`];
      if (!reference) return [];
      const fixture = services.fixtures.find((f) => f.id === reference.fixtureId);
      const port = fixture && servicePorts(fixture).find((p) => p.id === reference.portId);
      let reason = '';
      if (!fixture) reason = 'the linked fixture was removed';
      else if (fixture.levelId !== run.levelId)
        reason =
          'the target is on another floor; this connection needs a separately measured riser';
      else if (!port || port.id !== run.system)
        reason = 'the fixture port does not match this service system';
      else if (port.elevationM === null)
        reason = 'enter the surveyed drainage connection elevation';
      return reason
        ? [
            {
              runId: run.id,
              endpoint,
              message: `${endpoint === 'start' ? 'Start' : 'End'} is disconnected: ${reason}. Reconnect or choose Free endpoint.`,
            },
          ]
        : [];
    }),
  );
}
