/**
 * placementIntentStore — unit coverage for the mobile-toolbar → canvas
 * placement bridge.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { usePlacementIntentStore } from '../placementIntentStore';

beforeEach(() => {
  usePlacementIntentStore.getState().consume();
  usePlacementIntentStore.getState().consumeMove();
  usePlacementIntentStore.getState().registerMovePreviewResolver(() => null)();
});

describe('placementIntentStore', () => {
  it('placeAtCenter publishes a centre-target intent', () => {
    usePlacementIntentStore.getState().placeAtCenter('p1');
    const { intent } = usePlacementIntentStore.getState();
    expect(intent).not.toBeNull();
    expect(intent?.productId).toBe('p1');
    expect(intent?.target).toBe('center');
  });

  it('placeAt publishes an exact-coordinate intent', () => {
    usePlacementIntentStore.getState().placeAt('p2', 120, 340);
    const { intent } = usePlacementIntentStore.getState();
    expect(intent?.productId).toBe('p2');
    expect(intent?.target).toEqual({ clientX: 120, clientY: 340 });
  });

  it('increments nonce so repeat placements of the same product still fire', () => {
    usePlacementIntentStore.getState().placeAtCenter('p3');
    const n1 = usePlacementIntentStore.getState().intent?.nonce ?? 0;
    usePlacementIntentStore.getState().placeAtCenter('p3');
    const n2 = usePlacementIntentStore.getState().intent?.nonce ?? 0;
    expect(n2).toBeGreaterThan(n1);
  });

  it('consume clears the pending intent', () => {
    usePlacementIntentStore.getState().placeAt('p4', 1, 2);
    usePlacementIntentStore.getState().consume();
    expect(usePlacementIntentStore.getState().intent).toBeNull();
  });

  it('previews synchronously without publishing a move intent or notifying subscribers', () => {
    const bridge = usePlacementIntentStore.getState();
    const result = { ok: true as const, x: 2, y: 3, rotation: 90, roomId: 'room', crossRoom: false, reason: 'wall-aware' as const };
    const resolver = vi.fn(() => result);
    const unregister = bridge.registerMovePreviewResolver(resolver);
    const listener = vi.fn();
    const unsubscribe = usePlacementIntentStore.subscribe(listener);
    expect(bridge.previewMove('chair', 2.12, 3.2, true)).toBe(result);
    expect(resolver).toHaveBeenCalledWith('chair', 2.12, 3.2, true);
    expect(usePlacementIntentStore.getState().moveIntent).toBeNull();
    expect(usePlacementIntentStore.getState().intent).toBeNull();
    expect(listener).not.toHaveBeenCalled();
    unsubscribe();
    unregister();
  });

  it('an older canvas cleanup cannot remove the latest resolver', () => {
    const bridge = usePlacementIntentStore.getState();
    const oldCleanup = bridge.registerMovePreviewResolver(() => null);
    const refusal = { ok: false as const, reason: 'collision' as const, message: "Item won't fit there." };
    const cleanup = bridge.registerMovePreviewResolver(() => refusal);
    oldCleanup();
    expect(bridge.previewMove('chair', 0, 0)).toBe(refusal);
    cleanup();
    expect(bridge.previewMove('chair', 0, 0)).toBeNull();
  });

  it('ignores invalid pointer coordinates before calling the resolver', () => {
    const bridge = usePlacementIntentStore.getState();
    const resolver = vi.fn(() => null);
    const unregister = bridge.registerMovePreviewResolver(resolver);
    expect(bridge.previewMove('chair', NaN, 0)).toBeNull();
    expect(bridge.previewMove('chair', 0, Infinity)).toBeNull();
    expect(resolver).not.toHaveBeenCalled();
    unregister();
  });
});
