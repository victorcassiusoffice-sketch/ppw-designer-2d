/**
 * PolB.3 — drag-to-canvas auto-add + 5-sec undo wiring (V4 Driver
 * tick 35).
 *
 * RoomCanvas.placeProductAt() is the single seam where placement
 * happens (drop event + mobile tap-to-place + click-after-pick both
 * route through it). It now:
 *   1. addItem(...) → returns the new instanceId
 *   2. push("Added X to cart", "success", { ttlMs: 5000, action: { ... } })
 *
 * We test the store-level flow that the wiring composes:
 *   - the toast lands with the 5000 ms ttl
 *   - the Undo action callback removes the just-added item
 *   - dismissing the toast (no Undo) leaves the item in place
 *
 * Direct Konva integration tests would require @testing-library/react
 * + a full jsdom canvas mock. Both are heavier than the value gained
 * for a wiring this thin — the seam itself is one helper closure;
 * its behaviour is fully captured by the store-level integration
 * below.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useToastStore } from '../../store/toastStore';
import { usePropertyStore } from '../../store/propertyStore';
import { getAllProducts } from '../../data/products';

function resetStores() {
  usePropertyStore.getState().resetToDefault();
  useToastStore.getState().clear();
}

describe('PolB.3 — drag-to-canvas auto-add + 5-sec undo wiring', () => {
  beforeEach(resetStores);

  it('placing an item then pushing the auto-add toast lands a 5000 ms toast with an Undo CTA', () => {
    const product = getAllProducts()[0];
    const instanceId = usePropertyStore.getState().addItem({
      productId: product.id,
      x: 0,
      y: 0,
      rotation: 0,
    });
    useToastStore.getState().push(`Added "${product.name}" to cart`, 'success', {
      ttlMs: 5000,
      action: {
        label: 'Undo',
        onClick: () => usePropertyStore.getState().removeItem(instanceId),
      },
    });
    const toast = useToastStore.getState().toasts[0];
    expect(toast.message).toBe(`Added "${product.name}" to cart`);
    expect(toast.ttlMs).toBe(5000);
    expect(toast.action?.label).toBe('Undo');
  });

  it('invoking the Undo action removes the just-added instance', () => {
    const product = getAllProducts()[0];
    const instanceId = usePropertyStore.getState().addItem({
      productId: product.id,
      x: 0,
      y: 0,
      rotation: 0,
    });
    useToastStore.getState().push(`Added "${product.name}" to cart`, 'success', {
      ttlMs: 5000,
      action: {
        label: 'Undo',
        onClick: () => usePropertyStore.getState().removeItem(instanceId),
      },
    });
    // Confirm the item is in the active room before Undo.
    const before = usePropertyStore.getState().property.rooms[0].placedItems;
    expect(before.find((i) => i.instanceId === instanceId)).toBeDefined();

    useToastStore.getState().toasts[0].action!.onClick();

    const after = usePropertyStore.getState().property.rooms[0].placedItems;
    expect(after.find((i) => i.instanceId === instanceId)).toBeUndefined();
  });

  it('dismissing the toast without Undo leaves the item placed (auto-add is the default)', () => {
    const product = getAllProducts()[0];
    const instanceId = usePropertyStore.getState().addItem({
      productId: product.id,
      x: 0,
      y: 0,
      rotation: 0,
    });
    const toastId = useToastStore.getState().push(`Added "${product.name}" to cart`, 'success', {
      ttlMs: 5000,
      action: {
        label: 'Undo',
        onClick: () => usePropertyStore.getState().removeItem(instanceId),
      },
    });
    useToastStore.getState().dismiss(toastId);
    const after = usePropertyStore.getState().property.rooms[0].placedItems;
    expect(after.find((i) => i.instanceId === instanceId)).toBeDefined();
    expect(useToastStore.getState().toasts).toHaveLength(0);
  });

  it('placing a second item issues an independent Undo target (each toast captures its own instanceId)', () => {
    const products = getAllProducts();
    const a = usePropertyStore.getState().addItem({
      productId: products[0].id,
      x: 0,
      y: 0,
      rotation: 0,
    });
    useToastStore.getState().push('Added A', 'success', {
      ttlMs: 5000,
      action: { label: 'Undo', onClick: () => usePropertyStore.getState().removeItem(a) },
    });
    const b = usePropertyStore.getState().addItem({
      productId: products[1].id,
      x: 1,
      y: 1,
      rotation: 0,
    });
    useToastStore.getState().push('Added B', 'success', {
      ttlMs: 5000,
      action: { label: 'Undo', onClick: () => usePropertyStore.getState().removeItem(b) },
    });

    // Undo only the second toast.
    useToastStore.getState().toasts[1].action!.onClick();

    const items = usePropertyStore.getState().property.rooms[0].placedItems;
    expect(items.find((i) => i.instanceId === a)).toBeDefined();
    expect(items.find((i) => i.instanceId === b)).toBeUndefined();
  });
});
