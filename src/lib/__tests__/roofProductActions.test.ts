/** @vitest-environment jsdom */
import { beforeEach, describe, expect, it } from 'vitest';
import { rotateSelected } from '../placementActions';
import { getProductById } from '../../data/products';
import { usePropertyStore } from '../../store/propertyStore';
import { captureCurrentPage, applyPage } from '../pages';
import { energyReportForProperty } from '../../designer/useEnergyReport';
import { deriveCart } from '../../store/cartStore';
import { FALLBACK_RATES_USD } from '../fx';
import { isRoofRoom } from '../../designer/levels';
import { roofAreaM2 } from '../../designer/roof';

const panel = getProductById('emcar-victron-175')!;
beforeEach(() => usePropertyStore.getState().resetToDefault());
function roof(width: number, depth: number) {
  const state = usePropertyStore.getState();
  state.setRoomPolygon(state.property.activeRoomId, [{ x: 0, y: 0 }, { x: width, y: 0 }, { x: width, y: depth }, { x: 0, y: depth }]);
  state.ensureRoofLevel();
  return usePropertyStore.getState().property.rooms.find(isRoofRoom)!;
}

describe('roof panel actions and the shared saved design', () => {
  it('carries roof PV up when a copied floor replaces its source without doubling the roof area', () => {
    const originalSlab = roof(8, 8);
    const state = usePropertyStore.getState();
    const id = state.addItem({ productId: panel.id, x: 1, y: 1, rotation: 90 }, originalSlab.id);
    const upper = state.addLevel('Upstairs', 'ground');
    state.ensureRoofLevel();
    const property = usePropertyStore.getState().property;
    const slabs = property.rooms.filter(isRoofRoom);
    expect(slabs).toHaveLength(1);
    expect(slabs[0].id).not.toBe(originalSlab.id);
    expect(slabs[0].id).toBe(`roof-${property.rooms.find((room) => room.levelId === upper)?.id}`);
    expect(slabs[0].placedItems).toEqual([{ instanceId: id, productId: panel.id, x: 1, y: 1, rotation: 90 }]);
    expect(roofAreaM2(property)).toBe(64);
    expect(energyReportForProperty(property)).toMatchObject({ panelCount: 1, totalWp: panel.pv_wp, panelsOffRoof: 0 });
  });

  it('retains orphan PV work when the new floor no longer matches its roof footprint', () => {
    const originalSlab = roof(8, 8);
    const state = usePropertyStore.getState();
    const id = state.addItem({ productId: panel.id, x: 6, y: 6, rotation: 0 }, originalSlab.id);
    state.addLevel('Smaller upstairs', 'ground');
    const upperRoom = usePropertyStore.getState().property.activeRoomId;
    state.setRoomPolygon(upperRoom, [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 4 }, { x: 0, y: 4 }]);
    state.ensureRoofLevel();
    const property = usePropertyStore.getState().property;
    expect(property.rooms.find((room) => room.id === originalSlab.id)?.placedItems[0].instanceId).toBe(id);
    expect(property.rooms.filter(isRoofRoom)).toHaveLength(2);
  });

  it('rotates a PV panel into a slab-edge fit without an imaginary indoor wall inset', () => {
    const slab = roof(5, 1.485);
    const state = usePropertyStore.getState();
    const id = state.addItem({ productId: panel.id, x: 1, y: 0.4085, rotation: 0 }, slab.id);
    state.selectItemAcrossRooms(id);
    rotateSelected(90);
    const placed = usePropertyStore.getState().property.rooms.find((room) => room.id === slab.id)!.placedItems[0];
    expect(placed.rotation).toBe(90);
    expect(placed.x).toBeCloseTo(1.4085);
    expect(placed.y).toBeCloseTo(0);
  });

  it('still refuses a rotation when neighbouring PV leaves no valid footprint', () => {
    const slab = roof(1.6, 1.9);
    const state = usePropertyStore.getState();
    const id = state.addItem({ productId: panel.id, x: 0.05, y: 0.5, rotation: 0 }, slab.id);
    state.addItem({ productId: panel.id, x: 0.05, y: 1.2, rotation: 0 }, slab.id);
    state.selectItemAcrossRooms(id);
    const before = JSON.stringify(usePropertyStore.getState().property.rooms.find((room) => room.id === slab.id)!.placedItems);
    rotateSelected(90);
    expect(JSON.stringify(usePropertyStore.getState().property.rooms.find((room) => room.id === slab.id)!.placedItems)).toBe(before);
  });

  it('round-trips floors, doors, stairs and roof PV through Plan pages with the same energy and product estimate', () => {
    const state = usePropertyStore.getState();
    const groundId = state.property.activeRoomId;
    state.setRoomPolygon(groundId, [{ x: 0, y: 0 }, { x: 8, y: 0 }, { x: 8, y: 8 }, { x: 0, y: 8 }]);
    const opening = state.addOpening(groundId, { kind: 'door', edgeIndex: 0, offsetM: 2, widthM: 0.9, flipFacing: false, flipHand: false });
    const upper = state.addLevel('Upstairs', 'ground');
    expect(state.addStair({ fromLevelId: 'ground', toLevelId: upper, x: 3, y: 4 })).toBeTypeOf('string');
    state.setRoofConfig({ style: 'gable', material: 'felt', pitchDeg: 25, overhangM: 0.3 });
    state.ensureRoofLevel();
    const slab = usePropertyStore.getState().property.rooms.find(isRoofRoom)!;
    state.addItem({ productId: panel.id, x: 1, y: 1, rotation: 90 }, slab.id);
    const before = usePropertyStore.getState().property;
    const bundle = JSON.parse(JSON.stringify(captureCurrentPage()));
    state.resetToDefault();
    applyPage(bundle);
    const after = usePropertyStore.getState().property;
    expect(after.rooms.find((room) => room.id === groundId)?.openings?.[0].id).toBe(opening);
    expect(after.rooms.find((room) => room.levelId === upper)?.openings?.[0].id).not.toBe(opening);
    expect(after.stairs).toEqual(before.stairs);
    expect(after.roof).toEqual(before.roof);
    expect(after.rooms.find((room) => room.id === slab.id)?.kind).toBe('roof');
    expect(energyReportForProperty(after)).toMatchObject({ panelCount: 1, totalWp: panel.pv_wp, panelsOffRoof: 0 });
    const cart = deriveCart(after, { qtyOverrides: {}, removedProductIds: [] }, { fetchedAt: 0, rates: FALLBACK_RATES_USD, fallback: true }, 'MUR');
    expect(cart.lines).toHaveLength(1);
    expect(cart.lines[0]).toMatchObject({ productId: panel.id, quantity: 1, lineTotalDisplay: panel.price.value });
    expect(cart.subtotal).toBe(panel.price.value);
  });
});
