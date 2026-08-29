/**
 * freeWalls — pure helpers for free-standing (open-run) walls and the
 * one-shot bridge from the legacy mm `wallStore`.
 */
import { describe, it, expect } from 'vitest';
import {
  MIN_FREE_WALL_LENGTH_M,
  freeWallLengthM,
  fromLegacyWallSegments,
  isFreeWallLike,
  runToFreeWalls,
  wallsOnLevel,
} from '../freeWalls';
import { WALL_THICKNESS_M } from '../wallAwarePlacement';

describe('freeWallLengthM', () => {
  it('is the euclidean distance between the endpoints', () => {
    expect(freeWallLengthM({ a: { x: 0, y: 0 }, b: { x: 3, y: 4 } })).toBe(5);
    expect(freeWallLengthM({ a: { x: 1, y: 1 }, b: { x: 1, y: 1 } })).toBe(0);
  });
});

describe('wallsOnLevel', () => {
  it('absent levelId is ground, same rule as rooms', () => {
    const walls = [{ id: 'a' }, { id: 'b', levelId: 'one' }, { id: 'c', levelId: 'ground' }];
    expect(wallsOnLevel(walls, 'ground').map((w) => w.id)).toEqual(['a', 'c']);
    expect(wallsOnLevel(walls, 'one').map((w) => w.id)).toEqual(['b']);
  });
});

describe('runToFreeWalls', () => {
  it('turns an open polyline into one wall per consecutive pair', () => {
    const out = runToFreeWalls(
      [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 3 }],
      'one',
    );
    expect(out).toEqual([
      { a: { x: 0, y: 0 }, b: { x: 4, y: 0 }, thicknessM: WALL_THICKNESS_M, levelId: 'one' },
      { a: { x: 4, y: 0 }, b: { x: 4, y: 3 }, thicknessM: WALL_THICKNESS_M, levelId: 'one' },
    ]);
  });

  it('drops zero-length pairs (a double click) and keeps the rest', () => {
    const out = runToFreeWalls(
      [{ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 2, y: 0 }],
      'ground',
    );
    expect(out).toHaveLength(1);
    expect(out[0].b).toEqual({ x: 2, y: 0 });
  });

  it('a single vertex or an empty run is no wall at all', () => {
    expect(runToFreeWalls([], 'ground')).toEqual([]);
    expect(runToFreeWalls([{ x: 1, y: 1 }], 'ground')).toEqual([]);
  });

  it('honours an explicit thickness', () => {
    const out = runToFreeWalls([{ x: 0, y: 0 }, { x: 1, y: 0 }], 'ground', 0.2);
    expect(out[0].thicknessM).toBe(0.2);
  });

  it('copies the vertices rather than aliasing the caller\'s objects', () => {
    const a = { x: 0, y: 0 };
    const out = runToFreeWalls([a, { x: 1, y: 0 }], 'ground');
    a.x = 99;
    expect(out[0].a.x).toBe(0);
  });
});

describe('fromLegacyWallSegments', () => {
  it('converts millimetres to metres, 4 dp, on the ground level', () => {
    const out = fromLegacyWallSegments([
      { start: { x_mm: 0, y_mm: 0 }, end: { x_mm: 3500, y_mm: 0 }, thickness_mm: 100 },
      { start: { x_mm: 1234.56, y_mm: 7 }, end: { x_mm: 1234.56, y_mm: 2007 }, thickness_mm: 150 },
    ]);
    expect(out).toEqual([
      { a: { x: 0, y: 0 }, b: { x: 3.5, y: 0 }, thicknessM: 0.1, levelId: 'ground' },
      { a: { x: 1.2346, y: 0.007 }, b: { x: 1.2346, y: 2.007 }, thicknessM: 0.15, levelId: 'ground' },
    ]);
  });

  it('falls back to the world thickness when the segment has none', () => {
    const out = fromLegacyWallSegments([
      { start: { x_mm: 0, y_mm: 0 }, end: { x_mm: 1000, y_mm: 0 } },
      { start: { x_mm: 0, y_mm: 0 }, end: { x_mm: 1000, y_mm: 0 }, thickness_mm: 0 },
    ]);
    expect(out[0].thicknessM).toBe(WALL_THICKNESS_M);
    expect(out[1].thicknessM).toBe(WALL_THICKNESS_M);
  });

  it('drops zero-length and non-finite segments', () => {
    const out = fromLegacyWallSegments([
      { start: { x_mm: 5, y_mm: 5 }, end: { x_mm: 5, y_mm: 5 } },
      { start: { x_mm: NaN, y_mm: 0 }, end: { x_mm: 1000, y_mm: 0 } },
      { start: { x_mm: 0, y_mm: 0 }, end: { x_mm: 1000, y_mm: 0 } },
    ]);
    expect(out).toHaveLength(1);
  });

  it('tolerates a malformed entry in the array', () => {
    const out = fromLegacyWallSegments([
      null as never,
      { start: { x_mm: 0, y_mm: 0 }, end: { x_mm: 500, y_mm: 0 } },
    ]);
    expect(out).toHaveLength(1);
  });
});

describe('isFreeWallLike', () => {
  const good = { id: 'w1', a: { x: 0, y: 0 }, b: { x: 1, y: 0 }, thicknessM: 0.1 };

  it('accepts a well-formed wall, with or without a levelId', () => {
    expect(isFreeWallLike(good)).toBe(true);
    expect(isFreeWallLike({ ...good, levelId: 'one' })).toBe(true);
  });

  it('rejects garbage', () => {
    expect(isFreeWallLike(null)).toBe(false);
    expect(isFreeWallLike({ ...good, id: '' })).toBe(false);
    expect(isFreeWallLike({ ...good, a: { x: 'a', y: 0 } })).toBe(false);
    expect(isFreeWallLike({ ...good, b: null })).toBe(false);
    expect(isFreeWallLike({ ...good, thicknessM: 0 })).toBe(false);
    expect(isFreeWallLike({ ...good, thicknessM: Infinity })).toBe(false);
    expect(isFreeWallLike({ ...good, levelId: 3 })).toBe(false);
  });

  it('is structural only — a zero-length wall passes and is the store\'s job to drop', () => {
    expect(isFreeWallLike({ ...good, b: { x: 0, y: 0 } })).toBe(true);
    expect(MIN_FREE_WALL_LENGTH_M).toBeGreaterThan(0);
  });
});
