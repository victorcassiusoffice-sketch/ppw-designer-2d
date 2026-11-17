// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { surfaceTargets } from '../surfaceActions';
import { createTankRun, placedTanks, tankPortNozzles } from '../tankNetwork';
import {
  estimateServices,
  normaliseBuildingServices,
  serviceRunLengthM,
} from '../buildingServices';
import { BuildingServicesSchema } from '../buildingServicesContract';
import { tankRunOnFloor, visibleServiceRuns } from '../serviceScene';
import { ALL_DISCIPLINES, productDiscipline } from '../disciplineVisibility';
import {
  normaliseLoadedProperty,
  usePropertyStore,
  type Property,
  type Room,
} from '../../store/propertyStore';
import {
  __test as historyTest,
  installHistorySubscriptions,
  useHistoryStore,
} from '../../store/historyStore';

function threeFloors(): Property {
  const room = (id: string, levelId: string, instanceId: string): Room => ({
    id,
    name: id,
    levelId,
    ...(levelId === 'roof' ? { kind: 'roof' as const } : {}),
    polygon: [
      { x: 0, y: 0 },
      { x: 5, y: 0 },
      { x: 5, y: 5 },
      { x: 0, y: 5 },
    ],
    placedItems: [{ instanceId, productId: 'duraco-water-tank-1000', x: 1, y: 1, rotation: 0 }],
  });
  return {
    id: 'test-plan',
    name: 'Three storeys',
    activeRoomId: 'ground-room',
    levels: [
      { id: 'ground', name: 'Ground', index: 0, heightM: 2.82 },
      { id: 'first', name: 'First', index: 1, heightM: 2.82 },
      { id: 'roof', name: 'Roof', index: 2, kind: 'roof' },
    ],
    rooms: [
      room('ground-room', 'ground', 'ground-tank'),
      room('first-room', 'first', 'first-tank'),
      room('roof-room', 'roof', 'roof-tank'),
    ],
  };
}

describe('measured tank connections', () => {
  it('attaches the ends to each tank face, crosses floors and measures the exact shaft and leads once', () => {
    const p = threeFloors();
    expect(placedTanks(p).map((t) => [t.levelId, t.baseElevationM, t.capacityLitres])).toEqual([
      ['ground', 0, 1000],
      ['first', 3, 1000],
      ['roof', 6.08, 1000],
    ]);
    const run = createTankRun(p, 'pipe', {
      from: 'roof-tank',
      to: 'ground-tank',
      outletHeightM: 0.25,
      inletHeightM: 1,
      riser: { x: 3, y: 1.57 },
    })!;
    expect(run.levelId).toBe('roof');
    expect(run.points).toHaveLength(4);
    for (const p of [run.points[0], run.points[3]]) {
      expect(p.x).toBeCloseTo(2.14, 10);
      expect(p.y).toBeCloseTo(1.57, 10);
    }
    expect(run.points[0].elevationM).toBeCloseTo(0.33);
    expect(run.points[3].elevationM).toBe(-5);
    expect(serviceRunLengthM(run)).toBeCloseTo(0.86 + 5.33 + 0.86, 10);
    p.services = { version: 1, runs: [run], fixtures: [] };
    expect(BuildingServicesSchema.safeParse(p.services).success).toBe(true);
    expect(normaliseBuildingServices(p.services)?.runs[0]).toEqual(run);
    const built = visibleServiceRuns(p, 'ground', 'building', ALL_DISCIPLINES);
    expect(built).toHaveLength(1);
    expect(built[0].baseElevationM).toBe(6);
    expect(built[0].tankNozzles).toHaveLength(2);
    expect(surfaceTargets(p, 'first', { x: 3, y: 1.57 }, 0.04)).toContainEqual({
      kind: 'run',
      id: 'pipe',
    });
    const parts = ['roof', 'first', 'ground'].map((id) => tankRunOnFloor(p, run, id)!);
    expect(parts.every(Boolean)).toBe(true);
    expect(parts.reduce((sum, r) => sum + serviceRunLengthM(r), 0)).toBeCloseTo(
      serviceRunLengthM(run),
      10,
    );
    expect(estimateServices(p.services)).toHaveLength(1);
  });

  it('stores local port sides, applies rotation and leaves tank hardware outside the pipe takeoff', () => {
    const p = threeFloors();
    p.rooms[0].placedItems[0].productId = 'resiglas-water-tank-1000-a';
    p.rooms[0].placedItems[0].rotation = 90;
    const run = createTankRun(p, 'pipe', {
      from: 'ground-tank',
      to: 'first-tank',
      outletSide: 'south',
      inletSide: 'north',
    })!;
    const tanks = placedTanks(p);
    const nozzles = tankPortNozzles(tanks, run);
    expect(nozzles).toHaveLength(2);
    expect(nozzles[0].terminal.x).toBeCloseTo(tanks[0].x - tanks[0].widthM / 2);
    expect(nozzles[0].terminal.y).toBeCloseTo(tanks[0].y);
    expect(nozzles[0].from.x).toBeGreaterThan(nozzles[0].terminal.x);
    expect(run.points[0]).toMatchObject(nozzles[0].terminal);
    expect(run.points[run.points.length - 1]).toMatchObject(nozzles[1].terminal);
    p.services = { version: 1, fixtures: [], runs: [run] };
    expect(
      normaliseBuildingServices(BuildingServicesSchema.parse(p.services))?.runs[0].tankRoute,
    ).toEqual(run.tankRoute);
    const incorrect = {
      ...p.services,
      runs: [{ ...run, tankRoute: { ...run.tankRoute, inletSide: 'invalid' } }],
    };
    expect(BuildingServicesSchema.safeParse(incorrect).success).toBe(false);
    expect(normaliseBuildingServices(incorrect)?.runs).toEqual([]);
    expect(productDiscipline({ id: tanks[0].productId, category: 'other' })).toBe('plumbing');
  });

  it('rejects missing, self, incompatible or physically out-of-envelope anchors', () => {
    const p = threeFloors();
    expect(createTankRun(p, 'bad', { from: 'no-tank', to: 'roof-tank' })).toBeNull();
    expect(createTankRun(p, 'bad', { from: 'roof-tank', to: 'roof-tank' })).toBeNull();
    expect(
      createTankRun(p, 'bad', { from: 'roof-tank', to: 'ground-tank', inletHeightM: 2 }),
    ).toBeNull();
    const run = createTankRun(p, 'pipe', { from: 'roof-tank', to: 'first-tank' })!;
    const malformed = { version: 1, runs: [{ ...run, system: 'electrical' }], fixtures: [] };
    expect(BuildingServicesSchema.safeParse(malformed).success).toBe(false);
    expect(normaliseBuildingServices(malformed)?.runs).toEqual([]);
  });

  it('rebinds moves, rotations and floor heights atomically, saves, reloads and undoes removal', () => {
    const s = usePropertyStore.getState();
    const p = threeFloors();
    const run = createTankRun(p, 'pipe', {
      from: 'ground-tank',
      to: 'first-tank',
      outletHeightM: 0.15,
      inletHeightM: 1,
    })!;
    p.services = { version: 1, runs: [run], fixtures: [] };
    s.loadProperty(p);
    const current = () => usePropertyStore.getState().property;
    const pipe = () => current().services!.runs[0];
    s.updateItem('ground-tank', { x: 2, rotation: 90 });
    expect(pipe().points[0].x).toBeCloseTo(2.57);
    expect(pipe().points[0].y).toBeCloseTo(2.14);
    s.setLevelElevation('first', 25);
    expect(pipe().endElevationM).toBe(26);
    expect(
      ['ground', 'first'].reduce(
        (m, id) => m + serviceRunLengthM(tankRunOnFloor(current(), pipe(), id)!),
        0,
      ),
    ).toBeCloseTo(serviceRunLengthM(pipe()));
    expect(BuildingServicesSchema.safeParse(current().services).success).toBe(true);
    const saved = JSON.parse(JSON.stringify(current()));
    saved.services.runs[0].points[0].x = 104;
    expect(normaliseLoadedProperty(saved).services?.runs[0]).toEqual(pipe());
    historyTest.resetSubscriptions();
    const stop = installHistorySubscriptions({ coalesceMs: 0 });
    try {
      s.removeItem('first-tank');
      expect(current().services!.runs).toHaveLength(0);
      useHistoryStore.getState().undo();
      expect(pipe().tankRoute?.to).toBe('first-tank');
      expect(pipe().endElevationM).toBe(26);
    } finally {
      stop();
    }
  });
});
