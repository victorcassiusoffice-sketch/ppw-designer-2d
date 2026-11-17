// @vitest-environment jsdom
import { beforeAll, describe, expect, it } from 'vitest';
import { registerAllDemos } from '../../demo';
import { getProductById } from '../../data/products';
import { isRectInsidePolygon, rotatedFootprint } from '../../lib/geometry';
import {
  __test as historyTest,
  installHistorySubscriptions,
  useHistoryStore,
} from '../../store/historyStore';
import { normaliseLoadedProperty, usePropertyStore } from '../../store/propertyStore';
import { BuildingServicesSchema } from '../buildingServicesContract';
import { serviceRunLengthM } from '../buildingServices';
import { buildingSolids } from '../buildingScene';
import { sceneFromProperty } from '../propertyScene';
import { syncRoofRooms } from '../roof';
import { roomLevelId } from '../levels';
import { strictPolygonsOverlap } from '../roomLayout';
import { validateOpening } from '../openings';
import { validOpeningDimensions } from '../openingGeometry';
import { roomEdges } from '../wallEdges';
import { validateStairPlacement } from '../stairPlacement';
import { placedTanks } from '../tankNetwork';
import { tankRunOnFloor, visibleServiceRuns } from '../serviceScene';
import { ALL_DISCIPLINES } from '../disciplineVisibility';
import { TANK_HOUSE_EXAMPLE_ID, tankHouseExample } from '../tankHouseExample';
import { isTankExampleId, tankExample } from '../tankExample';

beforeAll(() => registerAllDemos());

describe('two-storey tank house', () => {
  it('opens an isolated normal house, keeps its roof slabs in sync and returns a fresh design each time', () => {
    const home = tankExample(TANK_HOUSE_EXAMPLE_ID);
    expect(isTankExampleId(TANK_HOUSE_EXAMPLE_ID)).toBe(true);
    expect(home.rooms.filter((r) => r.kind !== 'roof')).toHaveLength(12);
    expect(home.rooms.filter((r) => r.kind === 'roof')).toHaveLength(6);
    expect(syncRoofRooms(home)).toEqual(home);
    home.rooms[0].placedItems.pop();
    expect(tankHouseExample().rooms[0].placedItems).toHaveLength(4);
  });

  it('uses real catalogue footprints, usable wall openings and clear stair flights through both storeys', () => {
    const home = tankHouseExample();
    for (const room of home.rooms) {
      for (const item of room.placedItems) {
        const product = getProductById(item.productId);
        expect(product, item.productId).toBeDefined();
        const footprint = rotatedFootprint(
          {
            lengthM: product!.dimensions_cm.length / 100,
            widthM: product!.dimensions_cm.width / 100,
          },
          item.rotation,
        );
        expect(
          isRectInsidePolygon(
            { x: item.x, y: item.y, w: footprint.w, h: footprint.h },
            room.polygon,
          ),
          item.instanceId,
        ).toBe(true);
      }
      for (const edge of roomEdges(room)) {
        const openings = (room.openings ?? []).filter((o) => o.edgeIndex === edge.index);
        for (const opening of openings) {
          expect(
            validateOpening(
              edge.lengthM,
              opening,
              openings.filter((o) => o !== opening),
            ).ok,
            opening.id,
          ).toBe(true);
          expect(validOpeningDimensions(opening, 2.82), opening.id).toBe(true);
          expect(room.removedWallEdges ?? []).not.toContain(opening.edgeIndex);
        }
      }
      for (const other of home.rooms) {
        if (room === other || roomLevelId(room) !== roomLevelId(other)) continue;
        expect(strictPolygonsOverlap(room.polygon, other.polygon), room.id + ' / ' + other.id).toBe(
          false,
        );
      }
    }
    expect(home.stairs).toHaveLength(1);
    for (const stair of home.stairs!)
      expect(validateStairPlacement(home, stair)).toEqual({ ok: true });
  });

  it('updates the roof tank and measured pipe atomically with roof thickness, then restores them on undo', () => {
    const store = usePropertyStore.getState();
    store.loadProperty(tankHouseExample());
    const current = () => usePropertyStore.getState().property;
    const pipe = () => current().services!.runs[0];
    const initial = serviceRunLengthM(pipe());
    historyTest.resetSubscriptions();
    const stop = installHistorySubscriptions({ coalesceMs: 0 });
    try {
      store.setRoofConfig({ ...current().roof!, thicknessM: 0.3 });
      expect(placedTanks(current()).find((t) => t.levelId === 'roof')?.baseElevationM).toBeCloseTo(
        6.3,
      );
      expect(pipe().startElevationM).toBeCloseTo(0.3 + 0.255);
      expect(serviceRunLengthM(pipe()) - initial).toBeCloseTo(0.18);
      expect(normaliseLoadedProperty(JSON.parse(JSON.stringify(current()))).services).toEqual(
        current().services,
      );
      useHistoryStore.getState().undo();
      expect(pipe().startElevationM).toBeCloseTo(0.12 + 0.255);
      expect(serviceRunLengthM(pipe())).toBeCloseTo(initial);
      useHistoryStore.getState().redo();
      expect(serviceRunLengthM(pipe()) - initial).toBeCloseTo(0.18);
    } finally {
      stop();
    }
  });

  it('round-trips the measured installation and shows all three tanks, pipe routes and real stair openings in House', () => {
    const home = normaliseLoadedProperty(JSON.parse(JSON.stringify(tankHouseExample())));
    const tanks = placedTanks(home);
    expect(tanks.map((t) => [t.levelId, t.capacityLitres, t.baseElevationM])).toEqual([
      ['ground', 500, 0],
      ['first', 1000, 3],
      ['roof', 2000, 6.12],
    ]);
    expect(BuildingServicesSchema.safeParse(home.services).success).toBe(true);
    const runs = home.services!.runs;
    expect(runs).toHaveLength(2);
    expect(serviceRunLengthM(runs[0])).toBeCloseTo(0.7675 + 2.47825 + 0.79, 8);
    expect(serviceRunLengthM(runs[1])).toBeCloseTo(0.79 + 2.2428 + 1.0075, 8);
    expect(runs.reduce((sum, r) => sum + serviceRunLengthM(r), 0)).toBeCloseTo(8.07605, 8);
    for (const run of runs) {
      const clipped = ['ground', 'first', 'roof'].flatMap(
        (id) => tankRunOnFloor(home, run, id) ?? [],
      );
      expect(clipped.reduce((sum, r) => sum + serviceRunLengthM(r), 0)).toBeCloseTo(
        serviceRunLengthM(run),
        8,
      );
    }
    expect(visibleServiceRuns(home, 'ground', 'building', ALL_DISCIPLINES)).toHaveLength(2);
    const solids = buildingSolids(
      home,
      (p) =>
        sceneFromProperty(p, null, {
          target: { x: 5, y: 4, z: 3 },
          azimuthRad: 0.7,
          elevationRad: 0.4,
          distanceM: 20,
          fovRad: 0.9,
        }),
      'building',
      true,
    );
    for (const tank of tanks) {
      const solid = solids.items.find((i) => i.instanceId === tank.instanceId);
      expect(solid?.z0, tank.instanceId).toBeCloseTo(tank.baseElevationM);
      expect(solid?.z1, tank.instanceId).toBeCloseTo(tank.baseElevationM + tank.heightM);
    }
    expect(solids.stairs).toHaveLength(1);
    expect(solids.floors.find((f) => f.roomId === 'first-hall')?.holes).toHaveLength(1);
    expect(solids.floors.find((f) => f.roomId === 'roof-first-hall')?.holes).toHaveLength(0);
    expect(solids.walls.some((w) => (w.openings?.length ?? 0) > 0)).toBe(true);
    expect(solids.roofs).toHaveLength(6);
    const cutaway = buildingSolids(home, p => sceneFromProperty(p,null,{
      target:{x:5,y:4,z:3},azimuthRad:.7,elevationRad:.4,distanceM:20,fovRad:.9,
    }),'building',false);
    expect(cutaway.items.find(i => i.instanceId === 'house-tank-roof')?.z0).toBeCloseTo(6.12);
    expect(solids.floors.find(f => f.roomId === 'roof-first-service-terrace')?.elevationM).toBeCloseTo(6);
  });
});
