/** @vitest-environment jsdom */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { emptyCity } from '../../designer/city';
import { emptyEco } from '../../designer/eco';

// The design in the browser's storage is loaded at the very moment the store's module is first run, before the
// rest of that module has been run. What the load uses must be ready by then. These tests start the module anew
// with a design already in storage, as a page load does.

const square = [
  { x: 0, y: 0 },
  { x: 6, y: 0 },
  { x: 6, y: 4 },
  { x: 0, y: 4 },
];
const stored = (property: unknown, version = 2) =>
  localStorage.setItem(
    'ppw_property_v2',
    JSON.stringify({ state: { property, showGrid: true, pxPerMetre: 100 }, version }),
  );
const house = () => ({
  id: 'at-start-up',
  name: 'House that was in storage',
  activeRoomId: 'r1',
  rooms: [{ id: 'r1', name: 'Room', polygon: square, placedItems: [] }],
});

/** A design with every kind of part the loading cleans in its own way. */
const houseWithEverything = () => ({
  ...house(),
  formatVersion: 1,
  futureField: { kept: true },
  levels: [
    { id: 'ground', name: 'Ground floor', index: 0 },
    { id: 'first', name: 'First floor', index: 1 },
    { id: 'roof', name: 'Roof', index: 2, kind: 'roof' },
  ],
  rooms: [
    {
      id: 'r1',
      name: 'Room',
      polygon: square,
      placedItems: [],
      levelId: 'ground',
      futureRoomField: 3,
    },
    { id: 'r2', name: 'Room above', polygon: square, placedItems: [], levelId: 'first' },
  ],
  walls: [
    { id: 'w1', a: { x: 1, y: 1 }, b: { x: 4, y: 1 }, thicknessM: 0.1, futureWallField: 'kept' },
  ],
  site: { widthM: 30, depthM: 20, originM: { x: -5, y: -5 } },
  stairs: [
    {
      id: 's1',
      fromLevelId: 'ground',
      toLevelId: 'first',
      x: 3,
      y: 2,
      widthM: 1,
      runM: 3,
      rotation: 0,
    },
  ],
  roof: { style: 'gable', material: 'tile', pitchDeg: 30, overhangM: 0.3 },
  garden: {
    surfaces: [],
    fences: [
      { id: 'f1', a: { x: -2, y: -2 }, b: { x: 8, y: -2 }, heightM: 1.2, material: 'timber' },
    ],
  },
  services: { version: 1, runs: [], fixtures: [] },
  foundation: { version: 1, enabled: false, elements: [] },
  shade: { version: 1, enabled: false, sails: [] },
  city: emptyCity(),
  eco: emptyEco(),
  engineering: { carriedByANewerBuild: true },
  terrainCuts: [],
  boundaryComponents: [],
});

describe('the design in storage is there when the page starts', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.resetModules();
  });

  it('a plain design', async () => {
    stored(house());
    const { usePropertyStore } = await import('../propertyStore');
    expect(usePropertyStore.getState().property.name).toBe('House that was in storage');
    expect(usePropertyStore.getState().property.rooms).toHaveLength(1);
  });

  it('a design with sections, one readable and one not', async () => {
    stored({
      ...house(),
      eco: emptyEco(),
      foundation: { version: 4, piles: [] },
      futureField: { kept: true },
    });
    const { usePropertyStore } = await import('../propertyStore');
    const property = usePropertyStore.getState().property as unknown as Record<string, unknown> & {
      unread?: Record<string, unknown>;
    };
    expect(property.name).toBe('House that was in storage');
    expect(property.eco).toEqual(emptyEco());
    expect(property.foundation).toBeUndefined();
    expect(property.unread).toEqual({ foundation: { version: 4, piles: [] } });
    expect(property.futureField).toEqual({ kept: true });
  });

  it('a design stored by the first version of the storage wrapper', async () => {
    stored({ ...house(), futureField: 7 }, 1);
    const { usePropertyStore } = await import('../propertyStore');
    const property = usePropertyStore.getState().property as unknown as Record<string, unknown>;
    expect(property.name).toBe('House that was in storage');
    expect(property.futureField).toBe(7);
  });
  it('a design with every kind of part: the same at the start as when it is loaded later', async () => {
    stored(houseWithEverything());
    const { usePropertyStore } = await import('../propertyStore');
    const atStart = usePropertyStore.getState().property;
    expect(atStart.name).toBe('House that was in storage');
    expect(atStart.rooms).toHaveLength(2);
    // Loading it again, once the whole module has been run, is known to work: the start must give the same.
    await usePropertyStore.persist.rehydrate();
    expect(usePropertyStore.getState().property).toEqual(atStart);
    const asRecord = atStart as unknown as Record<string, unknown>;
    expect(asRecord.futureField).toEqual({ kept: true });
    expect(asRecord.unread).toEqual({ engineering: { carriedByANewerBuild: true } });
  });

  it('the same for a design stored by the first version of the storage wrapper', async () => {
    stored(houseWithEverything(), 1);
    const { usePropertyStore } = await import('../propertyStore');
    const atStart = usePropertyStore.getState().property;
    expect(atStart.name).toBe('House that was in storage');
    expect(atStart.rooms).toHaveLength(2);
    expect((atStart as unknown as Record<string, unknown>).unread).toEqual({
      engineering: { carriedByANewerBuild: true },
    });
  });
});
