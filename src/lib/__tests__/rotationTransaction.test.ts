/** @vitest-environment jsdom */
import { beforeEach, afterEach, describe, expect, it } from 'vitest';
import { beginItemRotation, previewItemRotation, commitItemRotation, cancelItemRotation } from '../placementActions';
import { usePropertyStore } from '../../store/propertyStore';
import { useHistoryStore, installHistorySubscriptions, __test } from '../../store/historyStore';
import { getAllProducts, getProductById } from '../../data/products';
import { rotatedFootprint } from '../geometry';

let cleanup: () => void;
let id: string;
beforeEach(() => {
  __test.resetSubscriptions();
  usePropertyStore.getState().resetToDefault(); const store = usePropertyStore.getState();
  store.setRoomPolygon(store.property.activeRoomId, [{ x: 0, y: 0 }, { x: 12, y: 0 }, { x: 12, y: 12 }, { x: 0, y: 12 }]);
  id = usePropertyStore.getState().addItem({ productId: getAllProducts()[0].id, x: 4, y: 4, rotation: 0 });
  usePropertyStore.getState().selectItem(id);
  cleanup = installHistorySubscriptions({ coalesceMs: 0 });
  useHistoryStore.getState().reset();
});
afterEach(() => cleanup());
const item = () => usePropertyStore.getState().property.rooms.flatMap(room => room.placedItems).find(entry => entry.instanceId === id)!;

describe('pointer rotation transaction', () => {
  it('previews every stop at the original centre without changing saved geometry/history', () => {
    const session = beginItemRotation(id)!;
    const original = structuredClone(usePropertyStore.getState().property);
    const product = getProductById(item().productId)!;
    for (let angle = 0; angle < 360; angle += 45) {
      const preview = previewItemRotation(session, angle);
      const size = rotatedFootprint({ lengthM: product.dimensions_cm.length / 100, widthM: product.dimensions_cm.width / 100 }, angle);
      expect(preview.ok).toBe(true);
      expect(preview.x + size.w / 2).toBeCloseTo(session.centre.x, 12);
      expect(preview.y + size.h / 2).toBeCloseTo(session.centre.y, 12);
    }
    expect(usePropertyStore.getState().property).toEqual(original);
    expect(useHistoryStore.getState().past).toHaveLength(0);
  });
  it('one release creates exactly one undo frame and redo restores the exact pose', () => {
    const session = beginItemRotation(id)!;
    for (let angle = 0; angle <= 45; angle++) previewItemRotation(session, angle);
    expect(commitItemRotation(session, 45)).toBe(true);
    const rotated = { ...item() };
    expect(useHistoryStore.getState().past).toHaveLength(1);
    expect(useHistoryStore.getState().past[0].label).toBe('rotate');
    useHistoryStore.getState().undo(); expect(item()).toEqual(session.original);
    useHistoryStore.getState().redo(); expect(item()).toEqual(rotated);
    expect(commitItemRotation(session, 90)).toBe(false);
  });
  it('cancel and unchanged release create no history or mutation', () => {
    const cancelled = beginItemRotation(id)!; previewItemRotation(cancelled, 73); cancelItemRotation(cancelled);
    expect(commitItemRotation(cancelled, 73)).toBe(false);
    expect(commitItemRotation(beginItemRotation(id)!, 360)).toBe(true);
    expect(item().rotation).toBe(0); expect(useHistoryStore.getState().past).toHaveLength(0);
  });
  it('rejects stale/deleted/moved items rather than overwriting another edit', () => {
    const session = beginItemRotation(id)!;
    usePropertyStore.getState().updateItem(id, { x: 7 });
    expect(commitItemRotation(session, 90)).toBe(false); expect(item().x).toBe(7);
  });
  it('keeps a wall fixture on its wall and rejects a blocked angle', () => {
    const wallProduct = getAllProducts().find(product => product.placement === 'wall')!;
    const wall = usePropertyStore.getState().addItem({ productId: wallProduct.id, x: 0.05, y: 1, rotation: 90 });
    expect(beginItemRotation(wall)).toBeNull();
    usePropertyStore.getState().updateItem(id, { x: 0.05, y: 0.05 });
    const session = beginItemRotation(id)!;
    const before = { ...item() };
    expect(previewItemRotation(session, 45).ok).toBe(false);
    expect(commitItemRotation(session, 45)).toBe(false); expect(item()).toEqual(before);
  });
});
