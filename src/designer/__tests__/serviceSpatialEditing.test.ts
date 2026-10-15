import { describe, expect, it } from 'vitest';
import { BuildingServicesSchema } from '../buildingServicesContract';
import {
  normaliseBuildingServices,
  serviceRunLengthM,
  serviceRunPoints3D,
  type BuildingServices,
  type ServiceRun,
} from '../buildingServices';
import {
  connectServiceEndpoint,
  connectServiceNodes,
  moveServiceNode,
  resolveServiceConnections,
  serviceConnectionWarnings,
  servicePorts,
} from '../serviceConnections';
import { snapServicePoint } from '../serviceRouteEditing';
import { validateSnapshotMeasurements } from '../../../api/_lib/designSnapshotValidation';

const route = (id = 'a', patch: Partial<ServiceRun> = {}): ServiceRun => ({
  id,
  levelId: 'ground',
  system: 'cold-water',
  materialId: 'custom',
  diameterMm: 20,
  points: [
    { x: 0, y: 0, elevationM: 0 },
    { x: 3, y: 0, elevationM: 0 },
    { x: 3, y: 0, elevationM: 4 },
    { x: 3, y: 2, elevationM: 4 },
  ],
  startElevationM: 0,
  endElevationM: 4,
  ...patch,
});
const model = (): BuildingServices => ({
  version: 1,
  runs: [
    route(),
    route('b', {
      points: [
        { x: 4, y: 0, elevationM: 4 },
        { x: 6, y: 0, elevationM: 4 },
      ],
    }),
  ],
  fixtures: [],
});
describe('measured 3D service editing', () => {
  it('measures a horizontal approach, vertical riser and upper horizontal segment without diagonal shortcuts', () => {
    expect(serviceRunLengthM(route())).toBe(9);
    expect(serviceRunPoints3D(route())[2]).toEqual({ x: 3, y: 0, elevationM: 4 });
  });
  it('preserves constant-gradient legacy routes and supports explicit intermediate peaks', () => {
    const legacy = route('old', {
      points: [
        { x: 0, y: 0 },
        { x: 3, y: 0 },
        { x: 3, y: 4 },
      ],
      startElevationM: 0,
      endElevationM: 24,
    });
    expect(serviceRunLengthM(legacy)).toBeCloseTo(25);
    expect(serviceRunPoints3D(legacy)[1].elevationM).toBeCloseTo(72 / 7);
    const peak = route('peak', {
      points: [
        { x: 0, y: 0, elevationM: 0 },
        { x: 0, y: 0, elevationM: 5 },
        { x: 0, y: 0, elevationM: 0 },
      ],
      endElevationM: 0,
    });
    expect(serviceRunLengthM(peak)).toBe(10);
    expect(normaliseBuildingServices({ version: 1, runs: [peak], fixtures: [] })?.runs).toEqual([
      peak,
    ]);
  });
  it('creates a stable junction and moves every member while preserving unrelated bends', () => {
    const original = model();
    const joined = connectServiceNodes(
      original,
      { runId: 'b', nodeIndex: 0 },
      { runId: 'a', nodeIndex: 2 },
      'junction',
    )!;
    expect(joined.junctions).toEqual([
      { id: 'junction', levelId: 'ground', system: 'cold-water', x: 3, y: 0, elevationM: 4 },
    ]);
    expect(joined.runs[1].points[0]).toMatchObject({ x: 3, elevationM: 4, junctionId: 'junction' });
    const moved = moveServiceNode(joined, 'a', 2, { x: 5, y: 1, elevationM: 3 })!;
    expect(moved.runs[0].points[2]).toEqual(moved.runs[1].points[0]);
    expect(moved.runs[0].points[1]).toEqual(original.runs[0].points[1]);
    expect(original.junctions).toBeUndefined();
    expect(serviceConnectionWarnings(moved)).toEqual([]);
    expect(normaliseBuildingServices(JSON.parse(JSON.stringify(moved)))).toEqual(moved);
  });
  it('does not connect incompatible floors or systems; stale junctions remain visibly unresolved', () => {
    for (const patch of [{ levelId: 'upper' }, { system: 'data' as const }]) {
      const input = model();
      input.runs[1] = { ...input.runs[1], ...patch };
      expect(
        connectServiceNodes(input, { runId: 'b', nodeIndex: 0 }, { runId: 'a', nodeIndex: 1 }, 'j'),
      ).toBeNull();
    }
    const input = model();
    input.runs[0].points[1].junctionId = 'missing';
    expect(resolveServiceConnections(input).runs[0].points[1]).toEqual(input.runs[0].points[1]);
    expect(serviceConnectionWarnings(input)[0].message).toContain('unresolved junction');
  });
  it('merges an existing shared junction without leaving its other branches disconnected', () => {
    const original = model();
    original.runs.push(
      route('c', {
        points: [
          { x: 9, y: 3, elevationM: 4 },
          { x: 10, y: 3, elevationM: 4 },
        ],
      }),
    );
    const joined = connectServiceNodes(
      original,
      { runId: 'b', nodeIndex: 0 },
      { runId: 'a', nodeIndex: 2 },
      'first',
    )!;
    const merged = connectServiceNodes(
      joined,
      { runId: 'a', nodeIndex: 2 },
      { runId: 'c', nodeIndex: 0 },
      'second',
    )!;
    expect(merged.junctions?.map((j) => j.id)).toEqual(['second']);
    expect(merged.runs[0].points[2]).toEqual(merged.runs[1].points[0]);
    expect(merged.runs[1].points[0]).toEqual(merged.runs[2].points[0]);
  });
  it('attaches raised equipment using floor-relative port heights and detaches a moved fixture endpoint', () => {
    const input = model();
    input.fixtures = [
      {
        id: 'ac',
        levelId: 'ground',
        kind: 'air-conditioner',
        x: 2,
        y: 2,
        widthM: 0.8,
        depthM: 0.2,
        heightM: 0.3,
        rotation: 0,
        elevationM: 2,
      },
    ];
    const port = servicePorts(input.fixtures[0]).find((p) => p.id === 'refrigerant')!;
    expect(port.elevationM).toBe(2.15);
    input.runs[0].system = 'refrigerant';
    const linked = connectServiceEndpoint(input, 'a', 'end', {
      fixtureId: 'ac',
      portId: 'refrigerant',
    })!;
    expect(serviceRunPoints3D(linked.runs[0])[linked.runs[0].points.length - 1]?.elevationM).toBe(2.15);
    const detached = moveServiceNode(linked, 'a', 3, { x: 0, y: 0, elevationM: 1 })!;
    expect(detached.runs[0].endConnection).toBeUndefined();
  });
  it('round-trips small verified equipment, new systems and junction references through the strict snapshot contract', () => {
    const input = model();
    input.fixtures = [
      {
        id: 'switch',
        kind: 'network-switch',
        levelId: 'ground',
        x: 0,
        y: 0,
        widthM: 0.171,
        depthM: 0.098,
        heightM: 0.027,
        rotation: 0,
        elevationM: 1.5,
        productReferenceId: 'manufacturer-reference',
      },
    ];
    input.runs[0].system = 'data';
    expect(BuildingServicesSchema.safeParse(input).success).toBe(true);
    expect(validateSnapshotMeasurements({ services: input })).toBeNull();
    expect(normaliseBuildingServices(JSON.parse(JSON.stringify(input)))).toEqual(input);
  });
  it.each([NaN, Infinity, -21, 21])(
    'rejects malformed node elevation %s without dropping just the bad node',
    (elevationM) => {
      const input = model();
      input.runs[0].points[1].elevationM = elevationM;
      expect(BuildingServicesSchema.safeParse(input).success).toBe(false);
      expect(validateSnapshotMeasurements({ services: input })).toContain('Invalid services');
      expect(normaliseBuildingServices(input)?.runs.map((r) => r.id)).toEqual(['b']);
    },
  );
  it('rejects dual fixture/junction ownership and duplicated junction IDs', () => {
    const input = model();
    input.runs[0].points[0].junctionId = 'j';
    input.runs[0].startConnection = { fixtureId: 'fixture', portId: 'cold-water' };
    expect(BuildingServicesSchema.safeParse(input).success).toBe(false);
    delete input.runs[0].startConnection;
    input.junctions = [
      { id: 'a', levelId: 'ground', system: 'cold-water', x: 1, y: 2, elevationM: 0 },
    ];
    expect(BuildingServicesSchema.safeParse(input).success).toBe(false);
  });
  it('snaps45/90 degrees without changing independent heights and permits free angles', () => {
    const origin = { x: 0, y: 0, elevationM: -1 },
      point = { x: 3, y: 2, elevationM: 4 };
    expect(snapServicePoint(point, origin, false, '90')).toEqual({ x: 3, y: 0, elevationM: 4 });
    expect(snapServicePoint(point, origin, false, '45')).toEqual({ x: 2.5, y: 2.5, elevationM: 4 });
    expect(snapServicePoint(point, origin, false, 'free')).toEqual(point);
  });
});
