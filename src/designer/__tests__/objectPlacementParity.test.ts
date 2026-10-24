import { afterEach, describe, expect, it } from 'vitest';
import { getProductById } from '../../data/products';
import { useObjectPlacementStore, objectPlacementStepM } from '../../store/objectPlacementStore';
import { usePlacementIntentStore } from '../../store/placementIntentStore';
import { placedItemElevationCm } from '../placedItemElevation';
import { objectAccessWarnings } from '../objectAccessWarnings';
import { buildSolids } from '../roomSolids';
import type { Room } from '../../store/propertyStore';

afterEach(() => { useObjectPlacementStore.getState().setMode('grid'); usePlacementIntentStore.getState().setArmed(null); });
describe('Sims placement parity', () => {
  it('object snap preferences are independent of construction precision', () => {
    for (const [mode, step] of [['grid', .5], ['half', .25], ['free', .001]] as const) {
      useObjectPlacementStore.getState().setMode(mode); expect(objectPlacementStepM()).toBe(step);
    }
  });
  it('carried ghost keeps its angle across views and resets only for a new product', () => {
    const store = usePlacementIntentStore.getState(); store.setArmed('demo-console-table'); store.rotateArmed(45); store.rotateArmed(1);
    store.setArmed('demo-console-table'); expect(usePlacementIntentStore.getState().armedRotation).toBe(46);
    store.setArmed('demo-wall-shelf'); expect(usePlacementIntentStore.getState().armedRotation).toBe(0);
  });
  it('preview bridge is read-only and the older cleanup cannot remove a newer resolver', () => {
    const store = usePlacementIntentStore.getState();
    const before = store.intent;
    const old = store.registerPlacementPreviewResolver(() => null);
    const clean = store.registerPlacementPreviewResolver((_id, xM, yM) => ({ xM, yM, rotation: 45, valid: true, w: 1, h: 1 }));
    old(); expect(store.previewPlacement('demo-console-table', 2, 3)).toMatchObject({ xM: 2, yM: 3, rotation: 45 });
    expect(usePlacementIntentStore.getState().intent).toBe(before); clean(); expect(store.previewPlacement('x', 0, 0)).toBeNull();
  });
  it('a surface product rests on the real parent height in the 3D solid', () => {
    const table = { instanceId: 'table', productId: 'demo-console-table', x: 1, y: 1, rotation: 0 };
    const child = { instanceId: 'child', productId: 'demo-aroma-diffuser', x: 1.1, y: 1.1, rotation: 0, parentInstanceId: 'table' };
    const product = getProductById(child.productId)!;
    const height = placedItemElevationCm(child, product, [table, child], getProductById, 2.7);
    expect(height).toBe(getProductById(table.productId)!.dimensions_cm.height);
    const solids = buildSolids({ rooms: [{ id: 'room', name: 'Room', polygon: [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 4 }, { x: 0, y: 4 }], items: [{ ...child, lengthCm: 15, widthCm: 15, heightCm: 20, placement: 'surface', baseHeightCm: height }] }], wallHeightM: 2.7, cameraPos: { x: 0, y: 8, z: 6 }, cameraTarget: { x: 2, y: 2, z: 0 } });
    expect(solids.items[0].z0).toBe(height / 100); expect(solids.items[0].parentInstanceId).toBe('table');
  });
  it('wall height is clamped without changing supplier dimensions', () => {
    const product = getProductById('demo-wall-shelf')!;
    const item = { instanceId: 'shelf', productId: product.id, x: 1, y: 0, rotation: 0, mountHeightCm: 999 };
    expect(placedItemElevationCm(item, product, [item], getProductById, 2.7)).toBe(270 - product.dimensions_cm.height);
  });
  it('door/window access hints disappear when furniture moves away', () => {
    const room: Room = { id: 'r', name: 'Room', polygon: [{ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 5, y: 5 }, { x: 0, y: 5 }], placedItems: [], openings: [{ id: 'door', kind: 'door', edgeIndex: 0, offsetM: 2, widthM: .9, flipFacing: false, flipHand: false }] };
    const product = getProductById('demo-console-table')!;
    const item = { instanceId: 'table', productId: product.id, x: 1.5, y: .1, rotation: 0 };
    expect(objectAccessWarnings(room, item, product)[0]).toContain('door');
    expect(objectAccessWarnings(room, { ...item, y: 2 }, product)).toEqual([]);
    room.openings![0] = { ...room.openings![0], kind: 'window', sillM: .2 };
    expect(objectAccessWarnings(room, item, product)[0]).toContain('window');
    room.openings![0].sillM = 2;
    expect(objectAccessWarnings(room, item, product)).toEqual([]);
  });
});
