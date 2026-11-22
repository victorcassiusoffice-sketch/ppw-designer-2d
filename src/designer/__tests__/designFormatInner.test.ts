/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  normaliseLoadedProperty,
  usePropertyStore,
  type Property,
} from '../../store/propertyStore';
import { CLADDING_PRODUCTS } from '../../data/claddingCatalog';
import { WALL_PAINTS } from '../../data/wallPaints';
import { FLOOR_MATERIALS } from '../../data/floorMaterials';
import { hydrateCurrentSite, siteHydrationWarning } from '../../site/hydration';
import { sampleSite } from '../../site/sample';
import { canonicaliseRoomGeometry } from '../openings';
import { designFileText, readDesignFile } from '../designFile';
import { CARRIED_ASIDE_NAMES, DESIGN_KEYS, SECTION_NAMES } from '../designFormat';
import { ASIDE_VALUE_LIMIT, UNKNOWN_KEY_LIMITS, keepUnknownKeys } from '../unknownKeys';

type Loose = Record<string, unknown>;
const open = (value: unknown) => normaliseLoadedProperty(value as Property) as unknown as Loose;
const ONE_WAY = [
  { x: 0, y: 0 },
  { x: 6, y: 0 },
  { x: 6, y: 4 },
  { x: 0, y: 4 },
];
const OTHER_WAY = [ONE_WAY[0], ONE_WAY[3], ONE_WAY[2], ONE_WAY[1]];
const KEPT = canonicaliseRoomGeometry(ONE_WAY).changed ? OTHER_WAY : ONE_WAY;
const TURNED = KEPT === ONE_WAY ? OTHER_WAY : ONE_WAY;

/** A room whose inner lists each hold one field this build does not know. Ids come from the app's own tables. */
const room = (polygon: typeof ONE_WAY) => ({
  id: 'r1',
  name: 'Room',
  polygon,
  placedItems: [],
  wallPaint: [{ edgeIndex: 0, paintId: WALL_PAINTS[0].id, futurePaintField: { coats: 3 } }],
  wallCladding: [{ edgeIndex: 1, productId: CLADDING_PRODUCTS[0].id, futureCladdingField: 'kept' }],
  wallConstruction: [{ edgeIndex: 2, kind: 'brick', futureConstructionField: [1, 2] }],
  floorFinish: { materialId: FLOOR_MATERIALS[0].id, futureFinishField: true },
  floorTiles: [
    {
      materialId: FLOOR_MATERIALS[0].id,
      tileWm: 0.5,
      tileHm: 0.5,
      originM: { x: 0, y: 0 },
      runs: [0, 0, 4, 1, 0, 4],
      futureZoneField: 'kept',
    },
  ],
});
const design = (rooms: unknown[], more: Loose = {}) => ({
  id: 'inner',
  name: 'House',
  activeRoomId: 'r1',
  rooms,
  ...more,
});

function expectInnerFieldsKept(opened: Loose) {
  const r = (opened.rooms as Loose[])[0];
  expect((r.wallPaint as Loose[])[0].futurePaintField).toEqual({ coats: 3 });
  expect((r.wallCladding as Loose[])[0].futureCladdingField).toBe('kept');
  expect((r.wallConstruction as Loose[])[0].futureConstructionField).toEqual([1, 2]);
  expect((r.floorFinish as Loose).futureFinishField).toBe(true);
  expect((r.floorTiles as Loose[])[0].futureZoneField).toBe('kept');
}

describe("a field this build does not know inside a room's inner lists", () => {
  it('is kept on open: wall paint, cladding, what a wall is made of, the floor finish, a zone of tiles', () => {
    const opened = open(design([room(KEPT)]));
    expectInnerFieldsKept(opened);
    // What this build reads is as before.
    const r = (opened.rooms as Loose[])[0];
    expect((r.wallPaint as Loose[])[0].paintId).toBe(WALL_PAINTS[0].id);
    expect((r.wallCladding as Loose[])[0].productId).toBe(CLADDING_PRODUCTS[0].id);
    expect((r.wallConstruction as Loose[])[0].kind).toBe('brick');
    expect((r.floorTiles as Loose[])[0].tileWm).toBe(0.5);
  });

  it('is kept when the outline is turned round on open, and the entries follow their walls', () => {
    const opened = open(design([room(TURNED)]));
    expectInnerFieldsKept(opened);
    const r = (opened.rooms as Loose[])[0];
    // Four edges: an old edge i is the new edge 3 - i.
    expect((r.wallPaint as Loose[])[0].edgeIndex).toBe(3);
    expect((r.wallCladding as Loose[])[0].edgeIndex).toBe(2);
    expect((r.wallConstruction as Loose[])[0].edgeIndex).toBe(1);
  });

  it('opening again changes nothing more, and a file gives the same back', () => {
    const once = open(design([room(TURNED)]));
    expect(open(once)).toEqual(once);
    expect(open(readDesignFile(JSON.parse(designFileText(once)))!.property)).toEqual(once);
  });

  it('is kept on a reload from the browser storage that turns the outline round', async () => {
    localStorage.clear();
    localStorage.setItem(
      'ppw_property_v2',
      JSON.stringify({
        state: { property: design([room(TURNED)]), showGrid: true, pxPerMetre: 100 },
        version: 2,
      }),
    );
    await usePropertyStore.persist.rehydrate();
    const stored = usePropertyStore.getState().property as unknown as Loose;
    expect((stored.rooms as Loose[])[0].polygon).toEqual(KEPT);
    expectInnerFieldsKept(stored);
  });

  it('a bad entry is still dropped whole, with what it carried', () => {
    const bad = room(KEPT);
    (bad.wallPaint[0] as Loose).paintId = '';
    (bad.wallConstruction[0] as Loose).kind = 'straw';
    (bad.floorTiles[0] as Loose).tileWm = -1;
    const r = (open(design([bad])).rooms as Loose[])[0];
    expect(r.wallPaint).toBeUndefined();
    expect(r.wallConstruction).toBeUndefined();
    expect(r.floorTiles).toBeUndefined();
  });
});

describe('the materials settings', () => {
  it('are always read as their version 1, whatever number they say (an older rule of this app, kept)', () => {
    for (const materials of [
      { version: 1, scope: 'active' },
      { scope: 'active' },
      {},
      'text',
      { version: 900 },
    ]) {
      const opened = open(design([room(KEPT)], { materials }));
      expect((opened.materials as Loose).version, JSON.stringify(materials)).toBe(1);
      expect('unread' in opened).toBe(false);
    }
    expect('materials' in open(design([room(KEPT)]))).toBe(false);
  });

  it('carry a field at their top level that this build does not know; inside a group it is not carried', () => {
    const newer = {
      version: 2,
      scope: 'active',
      carbon: { kgPerBlock: 1.2 },
      wall: { thicknessM: 0.2, futureWallSetting: true },
    };
    const opened = open(design([room(KEPT)], { materials: newer }));
    const materials = opened.materials as Loose;
    expect(materials.scope).toBe('active');
    expect(materials.carbon).toEqual({ kgPerBlock: 1.2 });
    expect((materials.wall as Loose).thicknessM).toBe(0.2);
    expect('futureWallSetting' in (materials.wall as Loose)).toBe(false);
    expect(open(opened)).toEqual(opened);
  });

  it('the same on a reload from the browser storage', async () => {
    localStorage.clear();
    const newer = { version: 2, scope: 'active', carbon: { kgPerBlock: 1.2 } };
    localStorage.setItem(
      'ppw_property_v2',
      JSON.stringify({
        state: {
          property: design([room(KEPT)], { materials: newer }),
          showGrid: true,
          pxPerMetre: 100,
        },
        version: 2,
      }),
    );
    await usePropertyStore.persist.rehydrate();
    const stored = usePropertyStore.getState().property as unknown as Loose;
    expect((stored.materials as Loose).carbon).toEqual({ kgPerBlock: 1.2 });
    expect((stored.materials as Loose).version).toBe(1);
  });

  it('are not one of the parts kept aside; the plot on the map is the one carried part', () => {
    expect(SECTION_NAMES).not.toContain('materials');
    expect(SECTION_NAMES).toHaveLength(8);
    expect(DESIGN_KEYS.has('materials')).toBe(true);
    expect(CARRIED_ASIDE_NAMES).toEqual(['siteWorld']);
  });
});

describe('the plot on the map that this build cannot verify', () => {
  const original = usePropertyStore.getState().property;
  const envelope = (world: unknown) => ({
    widthM: 25,
    depthM: 20,
    originM: { x: -5, y: -5 },
    world,
  });
  beforeEach(() => {
    localStorage.clear();
    const property = { ...original };
    delete property.site;
    usePropertyStore.setState({ property });
  });
  afterEach(() => {
    usePropertyStore.setState({ property: original });
  });

  it('is kept aside as it was stored, and the plain plot stays', () => {
    const newer = { ...sampleSite(), version: 2, futureWorldField: { datum: 'local' } };
    usePropertyStore.getState().setSite(envelope(newer));
    hydrateCurrentSite();
    const property = usePropertyStore.getState().property as unknown as Loose;
    expect(property.site).toEqual({ widthM: 25, depthM: 20, originM: { x: -5, y: -5 } });
    expect((property.unread as Loose).siteWorld).toEqual(newer);
    expect(siteHydrationWarning()).toContain('could not be verified');
    // Asked again, nothing more happens: the design is not written again.
    const held = usePropertyStore.getState().property;
    hydrateCurrentSite();
    expect(usePropertyStore.getState().property).toBe(held);
  });

  it('is carried by the loader, which does not read it, through a file and a reload', async () => {
    const newer = { ...sampleSite(), version: 2 };
    usePropertyStore.getState().setSite(envelope(newer));
    hydrateCurrentSite();
    const held = usePropertyStore.getState().property;
    const opened = open(readDesignFile(JSON.parse(designFileText(held)))!.property);
    expect((opened.unread as Loose).siteWorld).toEqual(newer);
    await usePropertyStore.persist.rehydrate();
    expect((usePropertyStore.getState().property as unknown as Loose).unread).toEqual({
      siteWorld: newer,
    });
  });

  it('is given back as the plot on the map by a build that can verify it', () => {
    const world = sampleSite();
    usePropertyStore.getState().loadProperty({
      ...original,
      site: { widthM: 25, depthM: 20, originM: { x: -5, y: -5 } },
      unread: { siteWorld: world },
    } as Property);
    expect(usePropertyStore.getState().property.site?.world).toBeUndefined();
    hydrateCurrentSite();
    const property = usePropertyStore.getState().property;
    expect(property.site?.world).toEqual(world);
    expect('unread' in property).toBe(false);
  });

  it('only the plot on the map is carried under that name: another name under `unread` is not', () => {
    const opened = open(
      design([room(KEPT)], { unread: { siteWorld: { version: 9 }, madeUpPart: { a: 1 } } }),
    );
    expect(opened.unread).toEqual({ siteWorld: { version: 9 } });
  });
});

describe('how much may be kept', () => {
  it('a whole part kept aside may be bigger than one carried field', () => {
    expect(ASIDE_VALUE_LIMIT).toBeGreaterThan(UNKNOWN_KEY_LIMITS.values);
    const big = { heights: Array.from({ length: UNKNOWN_KEY_LIMITS.values + 5 }, (_, i) => i) };
    const asField: Loose = {};
    expect(keepUnknownKeys({ big }, new Set(), asField)).toEqual([]);
    const asPart: Loose = {};
    expect(keepUnknownKeys({ big }, new Set(), asPart, ASIDE_VALUE_LIMIT)).toEqual(['big']);
    // The plot on the map with many heights is kept aside whole.
    const opened = open(design([room(KEPT)], { unread: { siteWorld: { version: 2, ...big } } }));
    expect(((opened.unread as Loose).siteWorld as Loose).heights).toHaveLength(
      UNKNOWN_KEY_LIMITS.values + 5,
    );
  });
});
