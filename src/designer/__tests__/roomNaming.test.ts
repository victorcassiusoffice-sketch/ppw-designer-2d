/**
 * Room naming — the actual cause of "no need for room 2, 3 etc."
 *
 * Four competing schemes produced a sidebar where three drawn rooms all read
 * "Room 1" while quick-rectangle emitted "Room 2"/"Room 3". These pin the one
 * replacement.
 */
import { describe, it, expect } from 'vitest';
import {
  nextRoomName,
  disambiguate,
  isPlaceholderName,
  ROOM_TYPES,
  GENERIC_ROOM_NAME,
} from '../roomNaming';

describe('nextRoomName', () => {
  it('names the first room from the vocabulary, not "Room 1"', () => {
    expect(nextRoomName([])).toBe(ROOM_TYPES[0]);
    expect(nextRoomName([])).not.toMatch(/^Room\b/);
  });

  it('never repeats a name — the bug that made the list unusable', () => {
    const rooms: { name: string }[] = [];
    for (let i = 0; i < 6; i++) rooms.push({ name: nextRoomName(rooms) });
    expect(new Set(rooms.map((r) => r.name)).size).toBe(6);
  });

  it('walks down the vocabulary as types are taken', () => {
    expect(nextRoomName([{ name: ROOM_TYPES[0] }])).toBe(ROOM_TYPES[1]);
    expect(nextRoomName([{ name: ROOM_TYPES[0] }, { name: ROOM_TYPES[1] }])).toBe(ROOM_TYPES[2]);
  });

  it('numbers the TYPE, not a global counter, once the vocabulary runs out', () => {
    const all = ROOM_TYPES.map((name) => ({ name }));
    const next = nextRoomName(all);
    expect(next).toBe(GENERIC_ROOM_NAME);
    expect(nextRoomName([...all, { name: GENERIC_ROOM_NAME }])).toBe(`${GENERIC_ROOM_NAME} 2`);
  });

  it('honours a preferred type and disambiguates it', () => {
    expect(nextRoomName([], 'Sauna')).toBe('Sauna');
    expect(nextRoomName([{ name: 'Sauna' }], 'Sauna')).toBe('Sauna 2');
    expect(nextRoomName([{ name: 'Sauna' }, { name: 'Sauna 2' }], 'Sauna')).toBe('Sauna 3');
  });

  it('ignores blank names when deciding what is taken', () => {
    expect(nextRoomName([{ name: '' }, { name: '   ' }])).toBe(ROOM_TYPES[0]);
  });
});

describe('disambiguate', () => {
  it('returns the base when free', () => {
    expect(disambiguate('Gym Floor', new Set())).toBe('Gym Floor');
  });
  it('falls back to a generic base for an empty string', () => {
    expect(disambiguate('   ', new Set())).toBe(GENERIC_ROOM_NAME);
  });
});

describe('isPlaceholderName', () => {
  it('recognises the old auto-generated names', () => {
    for (const n of ['Room', 'Room 1', 'room 12', 'New Room', '', '  ']) {
      expect(isPlaceholderName(n), n).toBe(true);
    }
  });
  it('treats a real name as deliberate', () => {
    for (const n of ['Sauna', 'Treatment Room', "Vic's Studio"]) {
      expect(isPlaceholderName(n), n).toBe(false);
    }
  });
});
