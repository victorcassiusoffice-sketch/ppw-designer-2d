/** @vitest-environment jsdom */
import { beforeEach, describe, expect, it } from 'vitest';
import {
  normaliseLoadedProperty,
  usePropertyStore,
  type Property,
} from '../../store/propertyStore';
import { designFileText, readDesignFile } from '../designFile';
import {
  DESIGN_FORMAT_VERSION,
  DESIGN_KEYS,
  FREE_WALL_KEYS,
  GARDEN_FENCE_KEYS,
  GARDEN_KEYS,
  GARDEN_POOL_KEYS,
  GARDEN_SURFACE_KEYS,
  LEVEL_KEYS,
  NO_KEYS,
  ROOF_KEYS,
  ROOM_KEYS,
  SECTION_NAMES,
  SITE_KEYS,
  STAIR_KEYS,
} from '../designFormat';

const square = [
  { x: 0, y: 0 },
  { x: 6, y: 0 },
  { x: 6, y: 4 },
  { x: 0, y: 4 },
];

/**
 * A design as a NEWER build might write it: in every part there is one field this build does not know. The
 * names are made up; what counts is that each sits inside another part of the design.
 */
const newerDesign = () => ({
  id: 'newer',
  name: 'House from a newer build',
  activeRoomId: 'r1',
  formatVersion: 2,
  futureDesignField: [{ kind: 'made up', hours: 6 }],
  levels: [
    { id: 'ground', name: 'Ground floor', index: 0, futureLevelField: { use: 'living' } },
    { id: 'first', name: 'First floor', index: 1 },
    { id: 'roof', name: 'Roof', index: 2, kind: 'roof', futureRoofLevelField: 1 },
  ],
  rooms: [
    { id: 'r1', name: 'Room', polygon: square, placedItems: [], futureRoomField: [1, 2] },
    { id: 'r2', name: 'Room above', polygon: square, placedItems: [], levelId: 'first' },
  ],
  walls: [
    {
      id: 'w1',
      a: { x: 1, y: 1 },
      b: { x: 4, y: 1 },
      thicknessM: 0.1,
      arc: { bulgeM: 0.4, side: 'left' },
    },
  ],
  site: {
    widthM: 30,
    depthM: 20,
    originM: { x: -5, y: -5 },
    futureSiteField: { datum: 'local' },
  },
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
      futureStairField: 'winder',
    },
  ],
  roof: {
    style: 'gable',
    material: 'tile',
    pitchDeg: 30,
    overhangM: 0.3,
    futureRoofField: { gutters: true },
  },
  garden: {
    futureGardenField: [{ id: 'pond-1' }],
    surfaces: [
      {
        id: 'g1',
        kind: 'lawn',
        x: -4,
        y: -4,
        widthM: 3,
        depthM: 2,
        elevationM: 0,
        futureSurfaceField: 'meadow',
        pilotPermeable: true,
      },
      {
        id: 'g2',
        kind: 'pool',
        x: 8,
        y: -4,
        widthM: 4,
        depthM: 3,
        elevationM: 0,
        pool: {
          shellDepthM: 1.5,
          waterDepthM: 1.2,
          wallThicknessM: 0.2,
          baseThicknessM: 0.2,
          excavationMarginM: 0.5,
          stage: 'filled',
          futurePoolField: { heated: true },
        },
      },
    ],
    fences: [
      {
        id: 'f1',
        a: { x: -5, y: -5 },
        b: { x: 5, y: -5 },
        heightM: 1.2,
        material: 'timber',
        futureFenceField: 2,
      },
    ],
  },
});

type Loose = Record<string, unknown>;
const open = (value: unknown) => normaliseLoadedProperty(value as Property) as unknown as Loose;

/** What must be in a design after this build opened it: every made-up field, where it was. */
function expectEveryFieldKept(opened: Loose) {
  expect(opened.formatVersion).toBe(2);
  expect(opened.futureDesignField).toEqual([{ kind: 'made up', hours: 6 }]);
  const levels = opened.levels as Loose[];
  expect(levels.find((l) => l.id === 'ground')?.futureLevelField).toEqual({ use: 'living' });
  expect(levels.find((l) => l.id === 'roof')?.futureRoofLevelField).toBe(1);
  expect((opened.rooms as Loose[])[0].futureRoomField).toEqual([1, 2]);
  expect((opened.walls as Loose[])[0].arc).toEqual({ bulgeM: 0.4, side: 'left' });
  expect((opened.site as Loose).futureSiteField).toEqual({ datum: 'local' });
  expect((opened.stairs as Loose[])[0].futureStairField).toBe('winder');
  expect((opened.roof as Loose).futureRoofField).toEqual({ gutters: true });
  const garden = opened.garden as Loose;
  expect(garden.futureGardenField).toEqual([{ id: 'pond-1' }]);
  const surfaces = garden.surfaces as Loose[];
  expect(surfaces[0].futureSurfaceField).toBe('meadow');
  expect((surfaces[1].pool as Loose).futurePoolField).toEqual({ heated: true });
  expect((garden.fences as Loose[])[0].futureFenceField).toBe(2);
}

describe('a field this build does not know is kept inside every part of a design', () => {
  it('on open', () => {
    const opened = open(newerDesign());
    expectEveryFieldKept(opened);
    // And what this build does know is still read and cleaned as before.
    expect((opened.rooms as Loose[]).map((r) => r.id)).toEqual(['r1', 'r2']);
    expect((opened.walls as Loose[])[0].thicknessM).toBe(0.1);
    expect((opened.site as Loose).widthM).toBe(30);
    expect((opened.stairs as Loose[])[0].runM).toBe(3);
    expect((opened.roof as Loose).pitchDeg).toBe(30);
    expect(((opened.garden as Loose).surfaces as Loose[]).map((s) => s.kind)).toEqual([
      'lawn',
      'pool',
    ]);
  });

  it('opening again and again changes nothing more', () => {
    const once = open(newerDesign());
    expect(open(once)).toEqual(once);
    expect(open(open(once))).toEqual(once);
  });

  it('through a file: saved and opened again', () => {
    const opened = open(newerDesign());
    const again = open(readDesignFile(JSON.parse(designFileText(opened)))!.property);
    expect(again).toEqual(opened);
    expectEveryFieldKept(again);
  });

  it('a field worked out for the screen is not stored', () => {
    const opened = open(newerDesign());
    const lawn = ((opened.garden as Loose).surfaces as Loose[])[0];
    expect('pilotPermeable' in lawn).toBe(false);
  });

  it('a made-up field never takes the place of one this build reads', () => {
    const design = newerDesign();
    // A roof pitch far too steep is brought back into the range, as before; nothing carried replaces it.
    (design.roof as Loose).pitchDeg = 500;
    const opened = open(design);
    expect((opened.roof as Loose).pitchDeg).toBe(60);
    expect((opened.roof as Loose).futureRoofField).toEqual({ gutters: true });
  });

  it('a garden that holds only a part this build does not know stays in the design', () => {
    const design = { ...newerDesign(), garden: { futureGardenField: [{ id: 'pond-1' }] } };
    const garden = open(design).garden as Loose;
    expect(garden.futureGardenField).toEqual([{ id: 'pond-1' }]);
    expect(garden.surfaces).toEqual([]);
    expect(garden.fences).toEqual([]);
    // An empty garden is still no garden.
    expect(open({ ...newerDesign(), garden: { surfaces: [], fences: [] } }).garden).toBeUndefined();
  });
});

describe('the same on a reload from the browser storage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('keeps every field, where it was', async () => {
    localStorage.setItem(
      'ppw_property_v2',
      JSON.stringify({
        state: { property: newerDesign(), showGrid: true, pxPerMetre: 100 },
        version: 2,
      }),
    );
    await usePropertyStore.persist.rehydrate();
    const stored = usePropertyStore.getState().property as unknown as Loose;
    expect(stored.name).toBe('House from a newer build');
    expectEveryFieldKept(stored);
    // What the app then stores again holds them too.
    const written = JSON.parse(localStorage.getItem('ppw_property_v2')!).state.property as Loose;
    expectEveryFieldKept(written);
  });
});

describe('the one table of names', () => {
  it('names every part once, and no dangerous name', () => {
    const tables = {
      DESIGN_KEYS,
      ROOM_KEYS,
      LEVEL_KEYS,
      FREE_WALL_KEYS,
      SITE_KEYS,
      STAIR_KEYS,
      ROOF_KEYS,
      GARDEN_KEYS,
      GARDEN_SURFACE_KEYS,
      GARDEN_POOL_KEYS,
      GARDEN_FENCE_KEYS,
    };
    for (const [table, keys] of Object.entries(tables)) {
      expect(keys.size, table).toBeGreaterThan(0);
      for (const key of keys) expect(key, `${table}: ${key}`).toMatch(/^[A-Za-z][A-Za-z0-9]*$/);
    }
    expect(NO_KEYS.size).toBe(0);
    expect(DESIGN_FORMAT_VERSION).toBe(2);
  });

  it('every section is a key of the design, and so is the place where unread sections are kept', () => {
    for (const name of SECTION_NAMES) expect(DESIGN_KEYS.has(name), name).toBe(true);
    expect(DESIGN_KEYS.has('unread')).toBe(true);
    expect(new Set(SECTION_NAMES).size).toBe(SECTION_NAMES.length);
  });

  it('holds every key the loader writes for a design and for a room', () => {
    // A key the loader writes and the table lacks would be harmless (the loader's value wins), but the table
    // would no longer be the list of what a design holds: this keeps the two together.
    const opened = open({
      ...newerDesign(),
      eco: { version: 1, trees: [], greenRoofs: [] },
      wallHeightM: 2.6,
    });
    const made = new Set(['futureDesignField']);
    for (const key of Object.keys(opened))
      expect(DESIGN_KEYS.has(key) || made.has(key), `design key ${key}`).toBe(true);
    for (const room of opened.rooms as Loose[])
      for (const key of Object.keys(room))
        expect(ROOM_KEYS.has(key) || key === 'futureRoomField', `room key ${key}`).toBe(true);
  });
});
