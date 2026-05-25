/**
 * placementIntentStore — unit coverage for the mobile-toolbar → canvas
 * placement bridge.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { usePlacementIntentStore } from '../placementIntentStore';

beforeEach(() => {
  usePlacementIntentStore.getState().consume();
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
});
