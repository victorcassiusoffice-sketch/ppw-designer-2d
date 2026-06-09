/**
 * @vitest-environment jsdom
 *
 * placementActions — Phase B / Tweak 01 rotation tests.
 *
 * Covers:
 *   - rotateSelected accepts any signed delta (was `90 | -90`).
 *   - 15° fine step (Shift+R) lands on the 15° snap grid.
 *   - 90° + 15° rotations compose normally (mod 360).
 *   - A 'rotate' label appears on the resulting history frame so the
 *     undo toast reads cleanly.
 *   - rotateSelected returns silently when nothing is selected.
 *   - The unified history stack records the rotation as ONE undoable
 *     frame (Tweak 07 hook for Tweak 01).
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  rotateSelected,
  duplicateSelected,
  ROTATION_STEP_FINE_DEG,
  ROTATION_STEP_COARSE_DEG,
} from '../placementActions';
import { useDesignStore } from '../../store/designStore';
import { usePropertyStore } from '../../store/propertyStore';
import { useHistoryStore, installHistorySubscriptions, __test } from '../../store/historyStore';
import { getAllProducts } from '../../data/products';

let teardown: (() => void) | null = null;

beforeEach(() => {
  __test.resetSubscriptions();
  usePropertyStore.getState().resetToDefault();
  // Blank-canvas-on-open (2026-06-09): resetToDefault now opens an EMPTY
  // room, but placement/rotate/duplicate validate against the room polygon —
  // so seed a generous 12×12 m rectangle here, mirroring a user who has
  // drawn their room before placing products.
  const ps = usePropertyStore.getState();
  ps.setRoomPolygon(ps.property.activeRoomId, [
    { x: 0, y: 0 },
    { x: 12, y: 0 },
    { x: 12, y: 12 },
    { x: 0, y: 12 },
  ]);
  if (typeof sessionStorage !== 'undefined') sessionStorage.clear();
  teardown = installHistorySubscriptions({ coalesceMs: 0 });
});

afterEach(() => {
  if (teardown) {
    teardown();
    teardown = null;
  }
});

function placeOne(): string {
  // Use a real seeded product so rotateSelected can look up dimensions.
  const product = getAllProducts()[0];
  return useDesignStore.getState().addItem({
    productId: product.id,
    x: 1,
    y: 1,
    rotation: 0,
  });
}

describe('rotateSelected — Phase B rotation API', () => {
  it('rotates by ROTATION_STEP_COARSE_DEG (R-key default)', () => {
    const id = placeOne();
    useDesignStore.getState().selectItem(id);
    rotateSelected(ROTATION_STEP_COARSE_DEG);
    const item = useDesignStore.getState().placedItems.find((i) => i.instanceId === id);
    expect(item?.rotation).toBe(90);
  });

  it('rotates by ROTATION_STEP_FINE_DEG (Shift+R 15° step)', () => {
    const id = placeOne();
    useDesignStore.getState().selectItem(id);
    rotateSelected(ROTATION_STEP_FINE_DEG);
    const item = useDesignStore.getState().placedItems.find((i) => i.instanceId === id);
    expect(item?.rotation).toBe(15);
  });

  it('coarse + fine compose (105° after 90° + 15°)', () => {
    const id = placeOne();
    useDesignStore.getState().selectItem(id);
    rotateSelected(ROTATION_STEP_COARSE_DEG);
    rotateSelected(ROTATION_STEP_FINE_DEG);
    const item = useDesignStore.getState().placedItems.find((i) => i.instanceId === id);
    expect(item?.rotation).toBe(105);
  });

  it('wraps negatives correctly (-15° from 0° lands on 345°)', () => {
    const id = placeOne();
    useDesignStore.getState().selectItem(id);
    rotateSelected(-ROTATION_STEP_FINE_DEG);
    const item = useDesignStore.getState().placedItems.find((i) => i.instanceId === id);
    expect(item?.rotation).toBe(345);
  });

  it('no-ops silently when nothing is selected', () => {
    useDesignStore.getState().selectItem(null);
    expect(() => rotateSelected(ROTATION_STEP_COARSE_DEG)).not.toThrow();
  });

  it('labels the history frame "rotate" (Tweak 07 hook)', () => {
    const id = placeOne();
    useDesignStore.getState().selectItem(id);
    // Reset history so we can isolate the rotate frame.
    __test.resetSubscriptions();
    teardown = installHistorySubscriptions({ coalesceMs: 0 });

    rotateSelected(ROTATION_STEP_COARSE_DEG);
    const past = useHistoryStore.getState().past;
    expect(past.length).toBeGreaterThanOrEqual(1);
    const lastLabelled = past.find((s) => s.label === 'rotate');
    expect(lastLabelled).toBeDefined();
  });

  it('duplicateSelected adds a copy and selects it (M4)', () => {
    // Use a small (0.5 m) product with open space so an offset slot is free
    // (large products can't clear the ≤1 m duplicate offsets — separate).
    const id = useDesignStore.getState().addItem({
      productId: 'k1-floor-eva-kids',
      x: 0.5,
      y: 0.5,
      rotation: 0,
    });
    useDesignStore.getState().selectItem(id);
    const before = useDesignStore.getState().placedItems.length;
    duplicateSelected();
    const items = useDesignStore.getState().placedItems;
    expect(items.length).toBe(before + 1);
    // The newly-selected item is the copy, not the original.
    const sel = useDesignStore.getState().selectedInstanceId;
    expect(sel).not.toBe(id);
    expect(items.find((i) => i.instanceId === sel)).toBeDefined();
  });

  it('records exactly one undoable rotation per call', () => {
    const id = placeOne();
    useDesignStore.getState().selectItem(id);
    __test.resetSubscriptions();
    teardown = installHistorySubscriptions({ coalesceMs: 0 });

    rotateSelected(ROTATION_STEP_COARSE_DEG);
    const beforeUndoCount = useHistoryStore.getState().past.length;

    useHistoryStore.getState().undo();
    const item = useDesignStore.getState().placedItems.find((i) => i.instanceId === id);
    expect(item?.rotation).toBe(0); // undone back to initial
    expect(useHistoryStore.getState().past.length).toBe(beforeUndoCount - 1);
  });
});
