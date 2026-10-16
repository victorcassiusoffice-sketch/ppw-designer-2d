/** Explicit planning topology. Generic ports are schematic, never a product
 * connector or a hydraulic/electrical approval. A crossing is not a junction. */
import {
  SERVICE_FIXTURES,
  serviceRunPoints3D,
  type BuildingServices,
  type ServiceConnection,
  type ServiceFixture,
  type ServicePoint,
  type ServiceRun,
  type ServiceSystem,
} from './buildingServices.js';

export type ServiceEndpoint = 'start' | 'end';
export interface FixtureServicePort extends Omit<ServicePoint, 'elevationM' | 'junctionId'> {
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
  const equipment: Partial<Record<ServiceFixture['kind'], ServiceSystem[]>> = {
    'air-conditioner': ['electrical', 'refrigerant', 'waste'],
    'outdoor-ac': ['electrical', 'refrigerant'],
    'air-grille': ['ventilation'],
    'extractor-fan': ['ventilation', 'electrical'],
    sprinkler: ['fire-water'],
    'security-camera': ['electrical', 'data'],
    'network-switch': ['electrical', 'data'],
  };
  for (const [index, id] of (equipment[fixture.kind] ?? []).entries())
    ports.push({
      id,
      label: `${id} connection`,
      x: -0.3 + index * 0.3,
      y: -0.4,
      height: fixture.heightM * 0.5,
    });
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
        (port.height === null
          ? null
          : Number(((fixture.elevationM ?? 0) + port.height).toPrecision(12))),
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
  const junctions = new Map((services.junctions ?? []).map((j) => [j.id, j]));
  return {
    ...services,
    runs: services.runs.map((run) => {
      const next = { ...run, points: run.points.map((p) => ({ ...p })) };
      next.points = next.points.map((point) => {
        const j = point.junctionId ? junctions.get(point.junctionId) : undefined;
        return j && j.levelId === run.levelId && j.system === run.system
          ? { ...point, x: j.x, y: j.y, elevationM: j.elevationM }
          : point;
      });
      for (const endpoint of ['start', 'end'] as const) {
        const connection = run[`${endpoint}Connection`];
        if (!connection) continue;
        const port = linkedPort(run, connection, services);
        if (!port) continue;
        const index = endpoint === 'start' ? 0 : next.points.length - 1;
        next.points[index] = {
          x: port.x,
          y: port.y,
          ...(next.points[index].elevationM !== undefined ? { elevationM: port.elevationM! } : {}),
        };
        next[`${endpoint}ElevationM`] = port.elevationM!;
      }
      if (next.points[0]?.elevationM !== undefined)
        next.startElevationM = next.points[0].elevationM;
      if (next.points[next.points.length - 1]?.elevationM !== undefined)
        next.endElevationM = next.points[next.points.length - 1]!.elevationM!;
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
  const next = { ...run, points: run.points.map((p) => ({ ...p })) };
  if (reference) delete next.points[endpoint === 'start' ? 0 : next.points.length - 1].junctionId;
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
  nodeIndex?: number;
}
export function serviceConnectionWarnings(services: BuildingServices): ServiceConnectionIssue[] {
  const endpointIssues = services.runs.flatMap((run) =>
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
  const junctions = new Map((services.junctions ?? []).map((j) => [j.id, j]));
  return [
    ...endpointIssues,
    ...services.runs.flatMap((run) =>
      run.points.flatMap((p, nodeIndex) => {
        if (!p.junctionId) return [];
        const junction = junctions.get(p.junctionId);
        if (junction && junction.levelId === run.levelId && junction.system === run.system)
          return [];
        return [
          {
            runId: run.id,
            endpoint: nodeIndex === 0 ? ('start' as const) : ('end' as const),
            nodeIndex,
            message: `Node ${nodeIndex + 1} has an unresolved junction. Reconnect to the same system and floor, or detach it.`,
          },
        ];
      }),
    ),
  ];
}

/** Join two explicit measured nodes. Shared junction positions own all linked nodes.
 * No proximity inference, run cycles, automatic fitting count or cross-floor links. */
export function connectServiceNodes(
  services: BuildingServices,
  source: { runId: string; nodeIndex: number },
  target: { runId: string; nodeIndex: number },
  junctionId: string,
): BuildingServices | null {
  const a = services.runs.find((r) => r.id === source.runId),
    b = services.runs.find((r) => r.id === target.runId);
  if (
    !a ||
    !b ||
    a.system !== b.system ||
    a.levelId !== b.levelId ||
    !a.points[source.nodeIndex] ||
    !b.points[target.nodeIndex] ||
    (a.id === b.id && source.nodeIndex === target.nodeIndex)
  )
    return null;
  const existing = b.points[target.nodeIndex].junctionId;
  const junction = existing
    ? services.junctions?.find(
        (j) => j.id === existing && j.system === b.system && j.levelId === b.levelId,
      )
    : undefined;
  if (existing && !junction) return null;
  if (
    !junction &&
    (!junctionId ||
      [...services.runs, ...services.fixtures, ...(services.junctions ?? [])].some(
        (e) => e.id === junctionId,
      ))
  )
    return null;
  const point = serviceRunPoints3D(b)[target.nodeIndex];
  const id = junction?.id ?? junctionId;
  const sourceJunctionId = a.points[source.nodeIndex].junctionId;
  if (
    sourceJunctionId &&
    !services.junctions?.some(
      (j) => j.id === sourceJunctionId && j.levelId === a.levelId && j.system === a.system,
    )
  )
    return null;
  return resolveServiceConnections({
    ...services,
    junctions: (junction
      ? services.junctions!
      : [...(services.junctions ?? []), { id, levelId: b.levelId, system: b.system, ...point }]
    ).filter((j) => !sourceJunctionId || sourceJunctionId === id || j.id !== sourceJunctionId),
    runs: services.runs.map((run) => {
      const indices = [
        run.id === a.id ? source.nodeIndex : -1,
        run.id === b.id ? target.nodeIndex : -1,
      ];
      if (sourceJunctionId)
        run.points.forEach((p, i) => {
          if (p.junctionId === sourceJunctionId) indices.push(i);
        });
      if (indices.every((i) => i < 0)) return run;
      const next = {
        ...run,
        points: run.points.map((p, i) => (indices.includes(i) ? { ...p, junctionId: id } : p)),
      };
      if (indices.includes(0)) delete next.startConnection;
      if (indices.includes(run.points.length - 1)) delete next.endConnection;
      return next;
    }),
  });
}

/** Move one node; a linked junction moves together, a fixture endpoint detaches. */
export function moveServiceNode(
  services: BuildingServices,
  runId: string,
  nodeIndex: number,
  point: { x: number; y: number; elevationM: number },
): BuildingServices | null {
  const run = services.runs.find((r) => r.id === runId),
    node = run?.points[nodeIndex];
  if (!run || !node) return null;
  if (node.junctionId) {
    const junction = services.junctions?.find(
      (j) => j.id === node.junctionId && j.levelId === run.levelId && j.system === run.system,
    );
    if (!junction) return null;
    return resolveServiceConnections({
      ...services,
      junctions: services.junctions!.map((j) => (j.id === junction.id ? { ...j, ...point } : j)),
    });
  }
  const next = {
    ...run,
    points: serviceRunPoints3D(run).map((p, i) => ({
      ...run.points[i],
      ...p,
      ...(i === nodeIndex ? point : {}),
    })),
  };
  if (nodeIndex === 0) {
    delete next.startConnection;
    next.startElevationM = point.elevationM;
  }
  if (nodeIndex === run.points.length - 1) {
    delete next.endConnection;
    next.endElevationM = point.elevationM;
  }
  return { ...services, runs: services.runs.map((r) => (r.id === runId ? next : r)) };
}
