/** @vitest-environment jsdom */
import { beforeEach, describe, expect, it } from 'vitest';
import { normaliseLoadedProperty, usePropertyStore, type Property } from '../propertyStore';
import { emptyEco } from '../../designer/eco';
import { designFileText, readDesignFile } from '../../designer/designFile';

const square = [
  { x: 0, y: 0 },
  { x: 6, y: 0 },
  { x: 6, y: 4 },
  { x: 0, y: 4 },
];
const base = () => ({
  id: 'sections',
  name: 'House with sections',
  activeRoomId: 'r1',
  rooms: [{ id: 'r1', name: 'Room', polygon: square, placedItems: [] }],
});
/** A section as a newer build might write it: with a field this build does not know. */
const newerEco = () => ({ ...emptyEco(), carbonLedger: [{ kgCO2e: 12.5 }] });
const newerServices = () => ({ version: 2, runs: [], fixtures: [], manifolds: [{ id: 'm1' }] });
const open = (value: unknown) =>
  normaliseLoadedProperty(value as Property) as unknown as Record<string, unknown> & {
    unread?: Record<string, unknown>;
  };

describe('a section this build cannot read is kept aside, not dropped', () => {
  it('a section it can read is the section, and nothing is set aside', () => {
    const opened = open({
      ...base(),
      eco: emptyEco(),
      services: { version: 1, runs: [], fixtures: [] },
    });
    expect(opened.eco).toEqual(emptyEco());
    expect(opened.services).toBeDefined();
    expect('unread' in opened).toBe(false);
  });

  it('a section with a field it does not know is not shown, and is kept as it was stored', () => {
    const opened = open({
      ...base(),
      eco: newerEco(),
      services: newerServices(),
      terrainCuts: [{ odd: true }],
    });
    // Not read: the app's own code never sees an unchecked section.
    expect(opened.eco).toBeUndefined();
    expect(opened.services).toBeUndefined();
    expect(opened.terrainCuts).toBeUndefined();
    // Kept: under the section's own name, as it was stored.
    expect(opened.unread).toEqual({
      eco: newerEco(),
      services: newerServices(),
      terrainCuts: [{ odd: true }],
    });
  });

  it('opening again and again changes nothing more', () => {
    const once = open({ ...base(), eco: newerEco(), city: { version: 7, anything: [1, 2, 3] } });
    expect(once.unread).toEqual({ eco: newerEco(), city: { version: 7, anything: [1, 2, 3] } });
    expect(open(once)).toEqual(once);
    expect(open(open(once))).toEqual(once);
  });

  it('through a file: saved and opened again, what was set aside is still there', () => {
    const opened = open({ ...base(), eco: newerEco() });
    const again = open(readDesignFile(JSON.parse(designFileText(opened)))!.property);
    expect(again).toEqual(opened);
    expect(designFileText(again)).toContain('"carbonLedger"');
  });

  it('a build that can read the section gets it back as the section', () => {
    // What a newer build set aside nothing of: here, what was aside is a shape this build reads.
    const opened = open({ ...base(), unread: { eco: emptyEco() } });
    expect(opened.eco).toEqual(emptyEco());
    expect('unread' in opened).toBe(false);
  });

  it('what the design itself holds decides over what was set aside', () => {
    // A valid section written since: it is the section, and the old one that was aside is let go.
    const moved = open({ ...base(), eco: emptyEco(), unread: { eco: newerEco() } });
    expect(moved.eco).toEqual(emptyEco());
    expect('unread' in moved).toBe(false);
    // An unreadable section written since: it takes the place of the one that was aside.
    const replaced = open({
      ...base(),
      eco: { ...emptyEco(), secondNewField: 1 },
      unread: { eco: newerEco() },
    });
    expect(replaced.unread).toEqual({ eco: { ...emptyEco(), secondNewField: 1 } });
  });

  it('only sections are kept aside, and only as plain JSON', () => {
    expect('unread' in open({ ...base(), unread: 'text' })).toBe(false);
    expect('unread' in open({ ...base(), unread: [emptyEco()] })).toBe(false);
    expect('unread' in open({ ...base(), unread: { nonsense: { a: 1 }, rooms: [] } })).toBe(false);
    const mixed = open({ ...base(), unread: { nonsense: 1, shade: { version: 9 } } });
    expect(mixed.unread).toEqual({ shade: { version: 9 } });
  });
});

describe('the same on a reload from the browser storage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('keeps aside a section the build cannot read, where it was dropped before', async () => {
    localStorage.setItem(
      'ppw_property_v2',
      JSON.stringify({
        state: {
          property: {
            ...base(),
            eco: newerEco(),
            foundation: { version: 4, piles: [] },
            shade: undefined,
          },
          showGrid: true,
          pxPerMetre: 100,
        },
        version: 2,
      }),
    );
    await usePropertyStore.persist.rehydrate();
    const property = usePropertyStore.getState().property as unknown as Record<string, unknown> & {
      unread?: Record<string, unknown>;
    };
    expect(property.name).toBe('House with sections');
    expect(property.eco).toBeUndefined();
    expect(property.foundation).toBeUndefined();
    expect(property.unread).toEqual({ eco: newerEco(), foundation: { version: 4, piles: [] } });
  });

  it('gives a section back when what was aside can be read', async () => {
    localStorage.setItem(
      'ppw_property_v2',
      JSON.stringify({
        state: {
          property: { ...base(), unread: { eco: emptyEco() } },
          showGrid: true,
          pxPerMetre: 100,
        },
        version: 2,
      }),
    );
    await usePropertyStore.persist.rehydrate();
    const property = usePropertyStore.getState().property as unknown as Record<string, unknown>;
    expect(property.eco).toEqual(emptyEco());
    expect('unread' in property).toBe(false);
  });

  it('leaves a design with readable sections as it was', async () => {
    const stored = { ...base(), eco: emptyEco() };
    localStorage.setItem(
      'ppw_property_v2',
      JSON.stringify({ state: { property: stored, showGrid: true, pxPerMetre: 100 }, version: 2 }),
    );
    await usePropertyStore.persist.rehydrate();
    const property = usePropertyStore.getState().property as unknown as Record<string, unknown>;
    expect(property.eco).toEqual(emptyEco());
    expect('unread' in property).toBe(false);
    expect(property.rooms).toHaveLength(1);
  });
});
