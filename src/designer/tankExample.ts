import { TANK_HOUSE_EXAMPLE_ID, tankHouseExample } from './tankHouseExample';
import type { Property, Room } from '../store/propertyStore';
import { roofRoomIdFor } from './roof';
import { createTankRun, type TankRoute } from './tankNetwork';

export const TANK_EXAMPLE_ID = 'water-tank-example';
export const tankExamples = {
  [TANK_HOUSE_EXAMPLE_ID]: 'Two-storey home with connected tanks',
  [TANK_EXAMPLE_ID]: 'Three-level tank installation',
  'water-tank-ground': 'Single ground tank',
  'water-tank-bank': 'Linked ground-level pair',
  'water-tank-transfer': 'Ground-to-roof transfer',
};
export type TankExampleId = keyof typeof tankExamples;
export function isTankExampleId(id: string | null): id is TankExampleId {
  return id !== null && Object.prototype.hasOwnProperty.call(tankExamples, id);
}
export function tankExampleUrl(id: TankExampleId) {
  return '/designer?pilotPlan=' + id + '&panel=tanks';
}

function room(id: string, name: string, levelId: string, size: number, x: number, y: number): Room {
  return {
    id,
    name,
    levelId,
    polygon: [
      { x: 0, y: 0 },
      { x: 4.8, y: 0 },
      { x: 4.8, y: 3.2 },
      { x: 0, y: 3.2 },
    ],
    placedItems: [
      {
        instanceId: 'tank-' + levelId,
        productId: 'resiglas-water-tank-' + size + '-c',
        x,
        y,
        rotation: 0,
      },
    ],
  };
}

export function tankExample(id: TankExampleId = TANK_EXAMPLE_ID): Property {
  if (id === TANK_HOUSE_EXAMPLE_ID) return tankHouseExample();
  const ground = room(
    'ground-plant-room',
    'Ground-floor plant room',
    'ground',
    id === 'water-tank-transfer' ? 2000 : 500,
    2.65,
    1.23,
  );
  const property: Property = {
    id,
    name: tankExamples[id],
    activeRoomId: ground.id,
    activeLevelId: 'ground',
    wallHeightM: 2.82,
    levels: [{ id: 'ground', name: 'Ground floor', index: 0, heightM: 2.82 }],
    rooms: [ground],
  };
  const routes: [string, TankRoute][] = [];
  if (id === 'water-tank-bank') {
    ground.placedItems.push({
      instanceId: 'tank-pair',
      productId: 'resiglas-water-tank-500-c',
      x: 1.1,
      y: 1.23,
      rotation: 0,
    });
    routes.push([
      'pair-link',
      {
        from: 'tank-pair',
        to: 'tank-ground',
        inletSide: 'west',
        inletHeightM: 0.16,
        outletHeightM: 0.16,
        riser: { x: 2.3, y: 1.6725 },
      },
    ]);
  }
  if (id === TANK_EXAMPLE_ID || id === 'water-tank-transfer') {
    let supportingRoom = ground;
    if (id === TANK_EXAMPLE_ID) {
      supportingRoom = room('first-plant-room', 'First-floor plant room', 'first', 1000, 2.2, 1.05);
      property.rooms.push(supportingRoom);
      property.levels!.push({ id: 'first', name: 'First floor', index: 1, heightM: 2.82 });
    }
    property.levels!.push({
      id: 'roof',
      name: 'Roof',
      index: property.levels!.length,
      kind: 'roof',
    });
    property.roof = { style: 'flat', material: 'concrete', overhangM: 0, pitchDeg: 5 };
    property.rooms.push({
      ...room(
        roofRoomIdFor(supportingRoom.id),
        'Roof plant deck',
        'roof',
        id === TANK_EXAMPLE_ID ? 2000 : 500,
        1.8,
        1.03,
      ),
      kind: 'roof',
    });
    const riser = { x: 3.95, y: 1.75 };
    if (id === TANK_EXAMPLE_ID) {
      routes.push(
        ['roof-to-first', { from: 'tank-roof', to: 'tank-first', riser }],
        ['first-to-ground', { from: 'tank-first', to: 'tank-ground', riser }],
      );
    } else
      routes.push([
        'ground-to-roof',
        { from: 'tank-ground', to: 'tank-roof', riser: { x: 4.3, y: 1.75 } },
      ]);
  }
  property.services = {
    version: 1,
    fixtures: [],
    runs: routes.map(([routeId, route]) => {
      const run = createTankRun(property, routeId, route);
      if (!run) throw new Error('Invalid pipe connection in ' + id + ': ' + routeId);
      return run;
    }),
  };
  return property;
}

export function seedTankExample(storage: Pick<Storage, 'getItem' | 'setItem'>, id: TankExampleId) {
  const key = 'ppw-pilot-plan-' + id;
  if (storage.getItem(key) !== null) return;
  storage.setItem(
    key,
    JSON.stringify({
      version: 2,
      state: { property: tankExample(id), showGrid: true, pxPerMetre: 50 },
    }),
  );
}
