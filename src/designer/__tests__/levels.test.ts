/**
 * levels — pure storey helpers. The headline contract is "absent means
 * ground": every property saved before levels existed has none of these
 * fields and must read as a single ground floor.
 */
import { describe, it, expect } from 'vitest';
import {
  GROUND_LEVEL_ID,
  activeLevelIdOf,
  groundLevel,
  isLevelLike,
  isOutdoorRoom,
  levelBelow,
  levelNameForIndex,
  levelsOf,
  nextLevelIndex,
  nextLevelName,
  roomLevelId,
  roomsOnLevel,
  sortLevels,
  visibleRooms,
  type Level,
} from '../levels';

const L = (id: string, index: number, name = id): Level => ({ id, name, index });

describe('levelsOf / activeLevelIdOf — absent means ground', () => {
  it('a property with no levels field is a lone ground floor', () => {
    expect(levelsOf({})).toEqual([{ id: 'ground', name: 'Ground floor', index: 0 }]);
    expect(levelsOf({ levels: [] })).toEqual([groundLevel()]);
  });

  it('returns the stored levels sorted by index', () => {
    const out = levelsOf({ levels: [L('two', 2), L('ground', 0), L('one', 1)] });
    expect(out.map((l) => l.id)).toEqual(['ground', 'one', 'two']);
  });

  it('groundLevel() is a fresh object every call', () => {
    const a = groundLevel();
    a.name = 'mutated';
    expect(groundLevel().name).toBe('Ground floor');
  });

  it('activeLevelIdOf falls back to the lowest level when absent or unknown', () => {
    expect(activeLevelIdOf({})).toBe(GROUND_LEVEL_ID);
    expect(activeLevelIdOf({ activeLevelId: 'nope' })).toBe(GROUND_LEVEL_ID);
    const levels = [L('ground', 0), L('one', 1)];
    expect(activeLevelIdOf({ levels, activeLevelId: 'one' })).toBe('one');
    expect(activeLevelIdOf({ levels, activeLevelId: 'gone' })).toBe('ground');
  });
});

describe('sortLevels', () => {
  it('sorts by index, then id, and does not mutate its input', () => {
    const input = [L('b', 1), L('a', 1), L('z', 0)];
    const out = sortLevels(input);
    expect(out.map((l) => l.id)).toEqual(['z', 'a', 'b']);
    expect(input.map((l) => l.id)).toEqual(['b', 'a', 'z']);
  });
});

describe('roomLevelId / roomsOnLevel', () => {
  it('a room with no levelId is on the ground floor', () => {
    expect(roomLevelId({})).toBe('ground');
    expect(roomLevelId({ levelId: '' })).toBe('ground');
    expect(roomLevelId({ levelId: 'one' })).toBe('one');
  });

  it('roomsOnLevel filters by the resolved level', () => {
    const rooms = [{ id: 'a' }, { id: 'b', levelId: 'one' }, { id: 'c', levelId: 'ground' }];
    expect(roomsOnLevel(rooms, 'ground').map((r) => r.id)).toEqual(['a', 'c']);
    expect(roomsOnLevel(rooms, 'one').map((r) => r.id)).toEqual(['b']);
    expect(roomsOnLevel(rooms, 'two')).toEqual([]);
  });
});

describe('outdoor rooms', () => {
  it('isOutdoorRoom is true only for kind === outdoor', () => {
    expect(isOutdoorRoom({})).toBe(false);
    expect(isOutdoorRoom({ kind: 'room' })).toBe(false);
    expect(isOutdoorRoom({ kind: 'outdoor' })).toBe(true);
  });

  it('visibleRooms drops the outdoor containers', () => {
    const rooms = [{ id: 'a' }, { id: 'o', kind: 'outdoor' }, { id: 'b', kind: 'room' }];
    expect(visibleRooms(rooms).map((r) => r.id)).toEqual(['a', 'b']);
  });
});

describe('naming', () => {
  it('ordinals for the first four storeys, then Level N', () => {
    expect(levelNameForIndex(0)).toBe('Ground floor');
    expect(levelNameForIndex(1)).toBe('First floor');
    expect(levelNameForIndex(2)).toBe('Second floor');
    expect(levelNameForIndex(3)).toBe('Third floor');
    expect(levelNameForIndex(4)).toBe('Level 4');
    expect(levelNameForIndex(12)).toBe('Level 12');
  });

  it('nextLevelIndex is max + 1, never a re-used gap', () => {
    expect(nextLevelIndex([])).toBe(0);
    expect(nextLevelIndex([L('ground', 0)])).toBe(1);
    expect(nextLevelIndex([L('ground', 0), L('two', 2)])).toBe(3);
  });

  it('nextLevelName walks the ordinals from the current set', () => {
    const levels: Level[] = [];
    const names: string[] = [];
    for (let i = 0; i < 6; i++) {
      const name = nextLevelName(levels);
      names.push(name);
      levels.push({ id: `l${i}`, name, index: nextLevelIndex(levels) });
    }
    expect(names).toEqual([
      'Ground floor', 'First floor', 'Second floor', 'Third floor', 'Level 4', 'Level 5',
    ]);
  });

  it('never hands out a name that is already taken', () => {
    // Someone renamed the ground floor to "First floor"; the next storey must
    // not read the same as an existing tab.
    const levels = [L('ground', 0, 'First floor')];
    expect(nextLevelName(levels)).toBe('Level 1');
    const both = [L('ground', 0, 'First floor'), L('x', 5, 'Level 1')];
    // index would be 6 → 'Level 6' is free
    expect(nextLevelName(both)).toBe('Level 6');
    const clash = [L('ground', 0, 'Level 1'), L('a', 0, 'First floor')];
    expect(nextLevelName(clash)).toBe('Level 1 (2)');
  });
});

describe('levelBelow', () => {
  const levels = [L('ground', 0), L('one', 1), L('three', 3)];

  it('is the highest level strictly under the given one', () => {
    expect(levelBelow(levels, 'three')?.id).toBe('one');
    expect(levelBelow(levels, 'one')?.id).toBe('ground');
  });

  it('is null for ground and for an unknown id', () => {
    expect(levelBelow(levels, 'ground')).toBeNull();
    expect(levelBelow(levels, 'nope')).toBeNull();
  });
});

describe('isLevelLike', () => {
  it('accepts a well-formed level and rejects garbage', () => {
    expect(isLevelLike({ id: 'a', name: 'A', index: 1 })).toBe(true);
    expect(isLevelLike(null)).toBe(false);
    expect(isLevelLike('a')).toBe(false);
    expect(isLevelLike({ id: '', name: 'A', index: 1 })).toBe(false);
    expect(isLevelLike({ id: 'a', index: 1 })).toBe(false);
    expect(isLevelLike({ id: 'a', name: 'A', index: '1' })).toBe(false);
    expect(isLevelLike({ id: 'a', name: 'A', index: NaN })).toBe(false);
  });
});
