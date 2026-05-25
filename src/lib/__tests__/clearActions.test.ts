/**
 * @vitest-environment jsdom
 *
 * clearActions — full-room Clear (Vic 2026-05-25).
 *
 * Reproduction (desktop + mobile, local + production) proved the old
 * mode-gated Clear only wiped one layer (move→items / wall→walls), leaving
 * walls / floors / paint behind. Vic chose a full reset. These tests pin
 * the new contract at the store level (the repo convention — see
 * src/__tests__/cart/auto-add.test.tsx — store-level integration over a
 * heavier @testing-library render):
 *
 *   1. Clear wipes products + walls + floor zones + wall paint together.
 *   2. The room polygon/size and OTHER rooms survive the clear.
 *   3. The whole wipe is ONE undo frame — a single Ctrl+Z restores it all.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { clearActiveRoomContents } from '../clearActions';
import {
  useHistoryStore,
  installHistorySubscriptions,
  __test,
} from '../../store/historyStore';
import { usePropertyStore } from '../../store/propertyStore';
import {
  useWallStore,
  DEFAULT_HEIGHT_MM,
  DEFAULT_THICKNESS_MM,
} from '../../store/wallStore';
import { useFloorZoneStore } from '../../store/floorZoneStore';
import { useWallTreatmentStore } from '../../store/wallTreatmentStore';

let teardown: (() => void) | null = null;

beforeEach(() => {
  __test.resetSubscriptions();
  usePropertyStore.getState().resetToDefault();
  useWallStore.getState().clearWalls();
  useFloorZoneStore.getState().clearZones();
  useWallTreatmentStore.getState().clearTreatments();
  if (typeof sessionStorage !== 'undefined') sessionStorage.clear();
  teardown = installHistorySubscriptions({ coalesceMs: 0 });
});

afterEach(() => {
  if (teardown) {
    teardown();
    teardown = null;
  }
});

function makeWall(x: number) {
  return {
    start: { x_mm: x, y_mm: 0 },
    end: { x_mm: x + 1000, y_mm: 0 },
    thickness_mm: DEFAULT_THICKNESS_MM,
    height_mm: DEFAULT_HEIGHT_MM,
    type: 'full' as const,
  };
}

/** Seed every content layer in the active room. */
function seedAllLayers() {
  const ps = usePropertyStore.getState();
  ps.addItem({ productId: 'flat-bench', x: 1, y: 1, rotation: 0 });
  ps.addItem({ productId: 'k1-nordictrack-2450', x: 2, y: 2, rotation: 90 });
  useWallStore.getState().addWall(makeWall(0));
  useWallStore.getState().addWall(makeWall(2000));
  useFloorZoneStore.getState().addZone({
    polygon: [
      { x_mm: 0, y_mm: 0 },
      { x_mm: 1000, y_mm: 0 },
      { x_mm: 1000, y_mm: 1000 },
    ],
    material_id: 'eco-cork',
  });
  useWallTreatmentStore.getState().setTreatment({
    wall_id: 'w1',
    kind: 'paint',
    product_id: 'cream-shell',
  });
}

function layerCounts() {
  const room = usePropertyStore.getState().property.rooms[0];
  return {
    items: room.placedItems.length,
    walls: useWallStore.getState().walls.length,
    zones: useFloorZoneStore.getState().zones.length,
    treatments: Object.keys(useWallTreatmentStore.getState().treatments).length,
  };
}

describe('clearActiveRoomContents — full reset', () => {
  it('wipes products, walls, floor zones AND wall paint in one call', () => {
    seedAllLayers();
    const before = layerCounts();
    expect(before.items).toBeGreaterThan(0);
    expect(before.walls).toBeGreaterThan(0);
    expect(before.zones).toBeGreaterThan(0);
    expect(before.treatments).toBeGreaterThan(0);

    clearActiveRoomContents();

    expect(layerCounts()).toEqual({ items: 0, walls: 0, zones: 0, treatments: 0 });
  });

  it('preserves the room polygon/size (clears contents, not the room)', () => {
    const polygonBefore = JSON.stringify(
      usePropertyStore.getState().property.rooms[0].polygon,
    );
    seedAllLayers();

    clearActiveRoomContents();

    const polygonAfter = JSON.stringify(
      usePropertyStore.getState().property.rooms[0].polygon,
    );
    expect(polygonAfter).toBe(polygonBefore);
  });

  it('only clears the active room — other rooms keep their items', () => {
    const ps = usePropertyStore.getState();
    const room1Id = ps.property.rooms[0].id;
    ps.addItem({ productId: 'flat-bench', x: 1, y: 1, rotation: 0 });
    // Second room becomes active; place an item there.
    const room2Id = usePropertyStore.getState().addRoom({ name: 'Cold Plunge' });
    usePropertyStore.getState().addItem({ productId: 'sauna-2p', x: 1, y: 1, rotation: 0 });
    // Back to room 1 and clear it.
    usePropertyStore.getState().setActiveRoom(room1Id);

    clearActiveRoomContents();

    const rooms = usePropertyStore.getState().property.rooms;
    const room1 = rooms.find((r) => r.id === room1Id)!;
    const room2 = rooms.find((r) => r.id === room2Id)!;
    expect(room1.placedItems.length).toBe(0);
    expect(room2.placedItems.length).toBe(1);
  });

  it('is a single undo frame — one Ctrl+Z restores every layer', () => {
    seedAllLayers();
    const before = layerCounts();
    const pastBefore = useHistoryStore.getState().past.length;

    clearActiveRoomContents();
    expect(layerCounts()).toEqual({ items: 0, walls: 0, zones: 0, treatments: 0 });
    // Exactly one new history frame for the whole multi-store wipe.
    expect(useHistoryStore.getState().past.length).toBe(pastBefore + 1);

    useHistoryStore.getState().undo();
    expect(layerCounts()).toEqual(before);
  });
});
