import { describe, expect, it } from 'vitest';
import { UNKNOWN_KEY_LIMITS, keepUnknownKeys } from '../unknownKeys';
import { designFileText, readDesignFile } from '../designFile';
import { normaliseLoadedProperty, type Property } from '../../store/propertyStore';

const square = [
  { x: 0, y: 0 },
  { x: 6, y: 0 },
  { x: 6, y: 4 },
  { x: 0, y: 4 },
];
const known = new Set(['id', 'name']);

describe('keys a build does not know are kept', () => {
  it('carries an unknown key through as it is, as a copy', () => {
    const future = {
      arcs: [{ centre: { x: 1, y: 2 }, radiusM: 3.5 }],
      note: 'été',
      on: true,
      n: null,
    };
    const into: Record<string, unknown> = { id: 'kept-as-cleaned' };
    const kept = keepUnknownKeys(
      { id: 'raw', name: 'raw', zebra: 1, futureWalls: future },
      known,
      into,
    );
    expect(kept).toEqual(['futureWalls', 'zebra']);
    expect(into).toEqual({ id: 'kept-as-cleaned', futureWalls: future, zebra: 1 });
    // A copy: what was read is not shared with what is kept.
    expect(into.futureWalls).not.toBe(future);
  });

  it('never touches a key the build knows, and never writes over one that is there', () => {
    const into: Record<string, unknown> = { extra: 'already there' };
    expect(
      keepUnknownKeys({ id: 'raw', name: 'raw', extra: 'from the file' }, known, into),
    ).toEqual([]);
    expect(into).toEqual({ extra: 'already there' });
  });

  it('carries only plain words', () => {
    const raw = JSON.parse(
      '{"__proto__":{"polluted":true},"constructor":1,"prototype":1,"selectedItemId":"x","with-dash":1,"with.dot":1,"_leading":1,"9digit":1,"":1,"ok_1":1}',
    ) as unknown;
    const into: Record<string, unknown> = {};
    expect(keepUnknownKeys(raw, known, into)).toEqual(['ok_1']);
    expect(Object.keys(into)).toEqual(['ok_1']);
    expect(({} as { polluted?: boolean }).polluted).toBeUndefined();
    expect(keepUnknownKeys({ ['a'.repeat(65)]: 1, ['b'.repeat(64)]: 1 }, known, {})).toEqual([
      'b'.repeat(64),
    ]);
  });

  it('carries only plain JSON of a bounded size', () => {
    let deep: unknown = 1;
    for (let i = 0; i <= UNKNOWN_KEY_LIMITS.depth; i++) deep = [deep];
    const raw = {
      fn: () => 1,
      undef: undefined,
      nan: Number.NaN,
      inf: [Number.POSITIVE_INFINITY],
      date: new Date(0),
      map: new Map(),
      tooDeep: deep,
      tooMany: Array.from({ length: UNKNOWN_KEY_LIMITS.values }, (_, i) => i),
      innerProto: JSON.parse('{"a":{"__proto__":{"x":1}}}') as unknown,
      fine: Array.from({ length: 100 }, (_, i) => ({ i })),
    };
    const into: Record<string, unknown> = {};
    expect(keepUnknownKeys(raw, known, into)).toEqual(['fine']);
  });

  it('answers nothing for what is not an object', () => {
    for (const raw of [null, undefined, 3, 'text', [{ a: 1 }]])
      expect(keepUnknownKeys(raw, known, {})).toEqual([]);
  });
});

describe('a design keeps the fields this build does not know', () => {
  const design = () => ({
    id: 'from-a-newer-build',
    name: 'House with new fields',
    activeRoomId: 'r1',
    formatVersion: 3,
    costLines: [{ kind: 'labour', trade: 'painter', hours: 6 }],
    wallHeightM: 9,
    rooms: [
      {
        id: 'r1',
        name: 'Room',
        polygon: square,
        placedItems: [],
        ceilingFinish: { materialId: 'new-thing' },
        lengthM: 6,
        widthM: 4,
      },
    ],
  });

  it('on open: the design itself and each room', () => {
    const opened = normaliseLoadedProperty(design() as unknown as Property) as unknown as Record<
      string,
      unknown
    > & { rooms: Array<Record<string, unknown>> };
    expect(opened.formatVersion).toBe(3);
    expect(opened.costLines).toEqual([{ kind: 'labour', trade: 'painter', hours: 6 }]);
    expect(opened.rooms[0].ceilingFinish).toEqual({ materialId: 'new-thing' });
    // A key the build knows is still cleaned its own way: a wall height out of range is dropped.
    expect(opened.wallHeightM).toBeUndefined();
    // The rectangle fields of the first designs are read and never carried.
    expect(opened.rooms[0].lengthM).toBeUndefined();
    expect(opened.rooms[0].widthM).toBeUndefined();
  });

  it('again and again: opening twice changes nothing more', () => {
    const once = normaliseLoadedProperty(design() as unknown as Property);
    expect(normaliseLoadedProperty(once)).toEqual(once);
  });

  it('through a file: saved, opened again, saved again', () => {
    const opened = normaliseLoadedProperty(design() as unknown as Property);
    const file = readDesignFile(JSON.parse(designFileText(opened)));
    const again = normaliseLoadedProperty(file!.property as Property);
    expect(again).toEqual(opened);
    expect(designFileText(again)).toBe(designFileText(opened));
    expect(designFileText(again)).toContain('"costLines"');
    expect(designFileText(again)).toContain('"ceilingFinish"');
  });

  it('a design with nothing unknown in it is as it always was', () => {
    const plain = {
      id: 'plain',
      name: 'Plain',
      activeRoomId: 'r1',
      rooms: [{ id: 'r1', name: 'Room', polygon: square, placedItems: [] }],
    };
    const opened = normaliseLoadedProperty(plain as unknown as Property);
    expect(Object.keys(opened).sort()).toEqual(['activeRoomId', 'id', 'name', 'rooms']);
    expect(Object.keys(opened.rooms[0]).sort()).toEqual(
      [
        'floorFinish',
        'floorTiles',
        'id',
        'name',
        'openings',
        'placedItems',
        'polygon',
        'wallConstruction',
      ].filter((key) => key in opened.rooms[0]),
    );
  });
});
