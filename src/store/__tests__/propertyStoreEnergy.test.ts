/**
 * propertyStore — the per-item energy overrides (electrics fix 2026-09-20,
 * E-03): `setItemPowerW` mirrors `setItemHours` — whole watts, capped, and
 * the canonical "no override" form is the ABSENT field, so a saved design
 * round-trips byte-for-byte when nothing was typed.
 *
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { usePropertyStore, type PlacedItem, type Property } from '../propertyStore';

const RECT = [
  { x: 0, y: 0 },
  { x: 6, y: 0 },
  { x: 6, y: 5 },
  { x: 0, y: 5 },
];

function item(id: string): PlacedItem {
  return { instanceId: id, productId: 'k1-nordictrack-rw900', x: 1, y: 1, rotation: 0 };
}

function seed(): void {
  const property: Property = {
    id: 'p',
    name: 'T',
    activeRoomId: 'r1',
    rooms: [
      { id: 'r1', name: 'Gym', polygon: RECT, placedItems: [item('a')] },
      { id: 'r2', name: 'Studio', polygon: RECT, placedItems: [item('b')] },
    ],
  };
  usePropertyStore.setState({ property });
}

function placed(id: string): PlacedItem | undefined {
  for (const r of usePropertyStore.getState().property.rooms) {
    const hit = r.placedItems.find((i) => i.instanceId === id);
    if (hit) return hit;
  }
  return undefined;
}

describe('setItemPowerW', () => {
  beforeEach(seed);

  it('stores whole watts on the item, in whichever room it lives', () => {
    usePropertyStore.getState().setItemPowerW('b', 40.4);
    expect(placed('b')?.powerW).toBe(40);
    expect(placed('a')?.powerW).toBeUndefined();
    usePropertyStore.getState().setItemPowerW('a', 350.6);
    expect(placed('a')?.powerW).toBe(351);
  });

  it('null, zero, negative and non-finite values clear the override (absent field)', () => {
    const store = usePropertyStore.getState();
    store.setItemPowerW('a', 120);
    expect(placed('a')?.powerW).toBe(120);
    store.setItemPowerW('a', null);
    expect('powerW' in placed('a')!).toBe(false);
    store.setItemPowerW('a', 120);
    store.setItemPowerW('a', 0);
    expect('powerW' in placed('a')!).toBe(false);
    store.setItemPowerW('a', -5);
    expect('powerW' in placed('a')!).toBe(false);
    store.setItemPowerW('a', Number.NaN);
    expect('powerW' in placed('a')!).toBe(false);
  });

  it('caps at 100 kW and ignores an unknown item', () => {
    const before = usePropertyStore.getState().property;
    usePropertyStore.getState().setItemPowerW('ghost', 50);
    expect(usePropertyStore.getState().property).toBe(before);
    usePropertyStore.getState().setItemPowerW('a', 1e9);
    expect(placed('a')?.powerW).toBe(100_000);
  });

  it('leaves the hours override and the power switch alone', () => {
    const store = usePropertyStore.getState();
    store.setItemHours('a', 3);
    store.setItemPower('a', false);
    store.setItemPowerW('a', 75);
    expect(placed('a')).toMatchObject({ hoursPerDay: 3, powerOn: false, powerW: 75 });
  });
});
