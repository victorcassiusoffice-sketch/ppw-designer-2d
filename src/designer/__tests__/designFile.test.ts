import { describe, expect, it } from 'vitest';
import {
  DESIGN_FILE_LIMITS,
  DESIGN_FORMAT_VERSION,
  countUnknownProducts,
  designFileName,
  designFormatVersion,
  designFileText,
  readDesignFile,
} from '../designFile';
import { normaliseLoadedProperty, type Property } from '../../store/propertyStore';
import { createGuidedDesign } from '../aiDesignContract';

const square = [
  { x: 0, y: 0 },
  { x: 6, y: 0 },
  { x: 6, y: 4 },
  { x: 0, y: 4 },
];
/** A design as this app keeps it and as the desktop game saves it. */
const design = () => ({
  id: 'saved-by-the-game',
  name: 'House from the game',
  activeRoomId: 'r1',
  rooms: [
    {
      id: 'r1',
      name: 'Living room',
      polygon: square,
      placedItems: [
        { instanceId: 'thing00001', productId: 'chair', x: 1, y: 1, rotation: 0 },
        { instanceId: 'thing00002', productId: 'm-903', x: 3, y: 1, rotation: 90 },
      ],
    },
    { id: 'out', name: 'Outdoors', polygon: [], placedItems: [], kind: 'outdoor' },
  ],
});

describe('a whole design as a file', () => {
  it('knows the design object itself', () => {
    const value = design();
    const read = readDesignFile(value);
    expect(read?.kind).toBe('design');
    // It only looks: the object in the file is handed on as it is.
    expect(read?.property).toBe(value);
  });

  it('knows the design inside a project hand-over file', () => {
    const snapshot = design();
    const read = readDesignFile({ kind: 'handover', fingerprint: 'abc', tasks: [], snapshot });
    expect(read?.kind).toBe('handover');
    expect(read?.property).toBe(snapshot);
  });

  it('leaves a Designer draft to the draft reader', () => {
    expect(readDesignFile(createGuidedDesign({ bedrooms: 1 }))).toBeNull();
    expect(readDesignFile({ draft: createGuidedDesign({ bedrooms: 2 }) })).toBeNull();
  });

  it('answers null for what is not a design', () => {
    for (const value of [
      null,
      7,
      'text',
      [],
      {},
      { rooms: [] },
      { rooms: 'many' },
      { rooms: [{ id: 'r1' }] },
      { rooms: [{ id: '', polygon: square }] },
      { rooms: [{ id: 5, polygon: square }] },
      { rooms: [{ id: 'r1', polygon: [{ x: 0, y: 'zero' }] }] },
      { rooms: [{ id: 'r1', polygon: [{ x: 0 }] }] },
      { rooms: [{ id: 'r1', polygon: [{ x: Number.NaN, y: 0 }] }] },
      { rooms: [{ id: 'r1', polygon: square, placedItems: 'none' }] },
      { rooms: [{ id: 'r1', polygon: square }, 'second'] },
      { snapshot: { rooms: [] } },
    ])
      expect(readDesignFile(value), JSON.stringify(value)).toBeNull();
  });

  it('refuses, in words, a design too large to open here', () => {
    const room = (id: string) => ({ id, polygon: square, placedItems: [] });
    const many = {
      rooms: Array.from({ length: DESIGN_FILE_LIMITS.rooms + 1 }, (_, i) => room(`r${i}`)),
    };
    expect(() => readDesignFile(many)).toThrow(/more than 400 rooms/);
    const corners = Array.from({ length: DESIGN_FILE_LIMITS.pointsPerRoom + 1 }, (_, i) => ({
      x: i,
      y: 0,
    }));
    expect(() => readDesignFile({ rooms: [{ id: 'r1', polygon: corners }] })).toThrow(/corners/);
    const things = Array.from({ length: DESIGN_FILE_LIMITS.itemsPerRoom + 1 }, () => ({}));
    expect(() =>
      readDesignFile({ rooms: [{ id: 'r1', polygon: square, placedItems: things }] }),
    ).toThrow(/things/);
    // At the limit it is still a design.
    const full = {
      rooms: Array.from({ length: DESIGN_FILE_LIMITS.rooms }, (_, i) => room(`r${i}`)),
    };
    expect(readDesignFile(full)?.kind).toBe('design');
  });

  it('counts the placed things whose product a catalogue does not have', () => {
    const value = design();
    expect(countUnknownProducts(value, new Set(['chair', 'm-903']))).toBe(0);
    expect(countUnknownProducts(value, new Set(['chair']))).toBe(1);
    expect(countUnknownProducts(value, new Set())).toBe(2);
    expect(
      countUnknownProducts(
        { rooms: [{ placedItems: [{ productId: 9 }, {}] }, {}] },
        new Set(['9']),
      ),
    ).toBe(2);
  });
  it('saves a design as a file that opens again as the same design', () => {
    // A design with more in it than rooms: a storey over the ground, a thing of a merchant's product, a paint.
    const saved = normaliseLoadedProperty({
      id: 'round-trip',
      name: 'Maison d’été 2',
      activeRoomId: 'r1',
      levels: [
        { id: 'ground', name: 'Ground', index: 0 },
        { id: 'upper', name: 'Upper', index: 1 },
      ],
      rooms: [
        {
          id: 'r1',
          name: 'Living room',
          polygon: square,
          placedItems: [{ instanceId: 'thing00002', productId: 'm-903', x: 3, y: 1, rotation: 90 }],
        },
        { id: 'r2', name: 'Bedroom', polygon: square, placedItems: [], levelId: 'upper' },
      ],
    } as unknown as Property);
    const text = designFileText(saved);
    expect(text.endsWith('\n')).toBe(true);
    const read = readDesignFile(JSON.parse(text));
    expect(read?.kind).toBe('design');
    // Opened again and cleaned as every opened design is, it is the design that was saved.
    expect(normaliseLoadedProperty(read!.property as Property)).toEqual(saved);
    // And nothing is in the file but the design.
    expect(Object.keys(JSON.parse(text)).sort()).toEqual(Object.keys(saved).sort());
  });

  it('names the file after the design, in plain letters', () => {
    expect(designFileName('Maison d’été 2')).toBe('maison-d-ete-2.json');
    expect(designFileName('  My  House / plan #3  ')).toBe('my-house-plan-3.json');
    expect(designFileName('../../etc/passwd')).toBe('etc-passwd.json');
    expect(designFileName('')).toBe('design.json');
    expect(designFileName('设计')).toBe('design.json');
    expect(designFileName(undefined)).toBe('design.json');
    expect(designFileName('a'.repeat(200))).toBe(`${'a'.repeat(60)}.json`);
  });
  it('reads the format version a design says it has; without one it is version 1', () => {
    expect(DESIGN_FORMAT_VERSION).toBe(2);
    expect(designFormatVersion(design())).toBe(1);
    expect(designFormatVersion({ ...design(), formatVersion: 3 })).toBe(3);
    for (const said of [0, -2, 1.5, '2', null, Number.NaN, {}])
      expect(designFormatVersion({ ...design(), formatVersion: said }), String(said)).toBe(1);
    expect(designFormatVersion(null)).toBe(1);
    expect(designFormatVersion('text')).toBe(1);
  });
});
