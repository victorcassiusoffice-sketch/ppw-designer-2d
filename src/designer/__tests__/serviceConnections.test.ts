import { describe, expect, it } from 'vitest';
import {
  normaliseBuildingServices,
  serviceRunLengthM,
  type BuildingServices,
  type ServiceFixture,
  type ServiceRun,
} from '../buildingServices';
import {
  compatibleServicePorts,
  connectServiceEndpoint,
  resolveServiceConnections,
  serviceConnectionWarnings,
  servicePorts,
} from '../serviceConnections';
const sink = (patch: Partial<ServiceFixture> = {}): ServiceFixture => ({
  id: 'sink',
  levelId: 'ground',
  kind: 'sink',
  x: 2,
  y: 4,
  widthM: 0.6,
  depthM: 0.48,
  heightM: 0.85,
  rotation: 0,
  ...patch,
});
const run = (patch: Partial<ServiceRun> = {}): ServiceRun => ({
  id: 'water',
  levelId: 'ground',
  system: 'cold-water',
  materialId: 'hpl-aquasafe-upvc-20',
  diameterMm: 20,
  points: [
    { x: 0, y: 0 },
    { x: 2, y: 4 },
  ],
  startElevationM: -0.3,
  endElevationM: -0.3,
  ...patch,
});
const data = (r = run(), fixtures = [sink()]): BuildingServices => ({
  version: 1,
  runs: [r],
  fixtures,
});
describe('explicit building service topology', () => {
  it('connects only compatible ports and measures a moved endpoint including elevation', () => {
    const start = data();
    const linked = connectServiceEndpoint(start, 'water', 'end', {
      fixtureId: 'sink',
      portId: 'cold-water',
    })!;
    const port = servicePorts(sink()).find((p) => p.id === 'cold-water')!;
    expect(linked.runs[0].points[1]).toEqual({ x: port.x, y: port.y });
    expect(linked.runs[0].endElevationM).toBe(0.578);
    expect(serviceRunLengthM(linked.runs[0])).toBeCloseTo(Math.hypot(port.x, port.y, 0.878));
    expect(start.runs[0].endConnection).toBeUndefined();
    expect(
      connectServiceEndpoint(start, 'water', 'end', { fixtureId: 'sink', portId: 'waste' }),
    ).toBeNull();
  });
  it('keeps an entered surveyed elevation while cleaning calculated default display artefacts', () => {
    const entered = -0.578123456789123;
    const fixture = sink({ portElevationsM: { 'cold-water': entered } });
    expect(servicePorts(fixture).find((port) => port.id === 'cold-water')?.elevationM).toBe(entered);
    expect(servicePorts(fixture).find((port) => port.id === 'hot-water')?.elevationM).toBe(0.578);
  });
  it('follows moved and rotated fixtures while preserving interior route bends', () => {
    const services = data(
      run({
        points: [
          { x: 0, y: 0 },
          { x: 0, y: 4 },
          { x: 2, y: 4 },
        ],
        endConnection: { fixtureId: 'sink', portId: 'cold-water' },
      }),
    );
    const moved = resolveServiceConnections({
      ...services,
      fixtures: [sink({ x: 5, y: 7, rotation: 90, portElevationsM: { 'cold-water': 0.7 } })],
    });
    expect(moved.runs[0].points[1]).toEqual({ x: 0, y: 4 });
    expect(moved.runs[0].points[2].x).toBeCloseTo(5.192);
    expect(moved.runs[0].points[2].y).toBeCloseTo(6.85);
    expect(moved.runs[0].endElevationM).toBe(0.7);
    expect(serviceConnectionWarnings(moved)).toEqual([]);
  });
  it('retains disconnected references after deletion, including through persisted JSON', () => {
    const linked = connectServiceEndpoint(data(), 'water', 'end', {
      fixtureId: 'sink',
      portId: 'cold-water',
    })!;
    const removed = resolveServiceConnections({ ...linked, fixtures: [] });
    expect(removed.runs[0]).toEqual(linked.runs[0]);
    const restored = normaliseBuildingServices(JSON.parse(JSON.stringify(removed)))!;
    expect(serviceConnectionWarnings(restored)[0].message).toContain('removed');
    const detached = connectServiceEndpoint(restored, 'water', 'end', null)!;
    expect(detached.runs[0].endConnection).toBeUndefined();
    expect(detached.runs[0].points).toEqual(linked.runs[0].points);
    expect(serviceConnectionWarnings(detached)).toEqual([]);
  });
  it('never links matching XY on another floor or converts visual crossings into junctions', () => {
    const services = data(run(), [sink({ levelId: 'upper' })]);
    expect(compatibleServicePorts(services, 'ground', 'cold-water')).toEqual([]);
    expect(
      connectServiceEndpoint(services, 'water', 'end', { fixtureId: 'sink', portId: 'cold-water' }),
    ).toBeNull();
    const stale = resolveServiceConnections({
      ...services,
      runs: [run({ endConnection: { fixtureId: 'sink', portId: 'cold-water' } })],
    });
    expect(stale.runs[0].points).toEqual(run().points);
    expect(serviceConnectionWarnings(stale)[0].message).toContain('another floor');
    expect(resolveServiceConnections(data()).runs[0].endConnection).toBeUndefined();
  });
  it('requires an entered sewer invert and persists label/elevation without authority claims', () => {
    const connection = sink({
      id: 'drain',
      kind: 'sewer-connection',
      connectionLabel: 'Boundary survey A',
    });
    const services = data(run({ system: 'waste' }), [connection]);
    expect(servicePorts(connection)[0].elevationM).toBeNull();
    expect(
      connectServiceEndpoint(services, 'water', 'end', { fixtureId: 'drain', portId: 'waste' }),
    ).toBeNull();
    const updated = {
      ...services,
      fixtures: [{ ...connection, portElevationsM: { waste: -1.2 } }],
    };
    const linked = connectServiceEndpoint(updated, 'water', 'end', {
      fixtureId: 'drain',
      portId: 'waste',
    })!;
    expect(linked.runs[0].endElevationM).toBe(-1.2);
    expect(normaliseBuildingServices(JSON.parse(JSON.stringify(linked)))).toEqual(linked);
  });
  it('measures a vertical-only attached run and warns if its saved system changes', () => {
    const main = sink({
      id: 'main',
      kind: 'mains-tap',
      x: 0,
      y: 0,
      portElevationsM: { 'cold-water': 0.7 },
    });
    const services = data(
      run({
        points: [
          { x: 0, y: 0 },
          { x: 0, y: 0 },
        ],
        startElevationM: -0.3,
      }),
      [main],
    );
    const linked = connectServiceEndpoint(services, 'water', 'end', {
      fixtureId: 'main',
      portId: 'cold-water',
    })!;
    expect(serviceRunLengthM(linked.runs[0])).toBe(1);
    const mismatch = { ...linked, runs: [{ ...linked.runs[0], system: 'electrical' as const }] };
    expect(serviceConnectionWarnings(mismatch)[0].message).toContain('does not match');
  });
});
