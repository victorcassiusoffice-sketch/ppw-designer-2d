/**
 * roof — the roof level + its slabs (eco / solar 2026-09-04).
 *
 * Contract under test: the roof is one level, always on top, whose slabs
 * mirror the drawn rooms of the highest storey that has any; slabs are real
 * Rooms (kind 'roof') with stable ids so what the customer puts on them
 * survives a re-sync; a pre-roof property is untouched.
 */
import { describe, it, expect } from 'vitest';
import {
  ROOF_LEVEL_ID,
  groundLevel,
  isLevelLike,
  isRoofLevel,
  isRoofRoom,
  levelsOf,
  nextLevelIndex,
  nextLevelName,
  roofLevel,
  roofLevelOf,
  roofSourceLevelId,
  sortLevels,
  storeyLevels,
  type Level,
} from '../levels';
import { roofAreaM2, roofRoomIdFor, roofSlabPolygons, syncRoofRooms } from '../roof';
import type { Property, Room } from '../../store/propertyStore';

const SQ = (x: number, y: number, w: number, h: number) => [
  { x, y },
  { x: x + w, y },
  { x: x + w, y: y + h },
  { x, y: y + h },
];

function room(id: string, extra: Partial<Room> = {}): Room {
  return { id, name: id, polygon: [], placedItems: [], ...extra };
}

function property(rooms: Room[], levels?: Level[], activeRoomId = rooms[0]?.id ?? 'x'): Property {
  const p: Property = { id: 'p', name: 'Test', activeRoomId, rooms };
  if (levels) p.levels = levels;
  return p;
}

describe('levels — roof helpers', () => {
  it('roofLevel sits at the next storey index and is marked kind roof', () => {
    const r = roofLevel([groundLevel(), { id: 'one', name: 'First floor', index: 1 }]);
    expect(r).toEqual({ id: 'roof', name: 'Roof', index: 2, kind: 'roof' });
    expect(isRoofLevel(r)).toBe(true);
    expect(isRoofLevel(groundLevel())).toBe(false);
    expect(isRoofLevel({ id: 'roof' })).toBe(true);
  });

  it('nextLevelIndex ignores the roof, so a storey added later slots beneath it', () => {
    const levels = [groundLevel(), roofLevel([groundLevel()])];
    expect(nextLevelIndex(levels)).toBe(1);
    expect(nextLevelName(levels)).toBe('First floor');
  });

  it('sortLevels keeps the roof last on an index tie; storeyLevels drops it', () => {
    const levels = sortLevels([roofLevel([groundLevel()]), { id: 'mezz', name: 'Mezz', index: 1 }, groundLevel()]);
    expect(levels.map((l) => l.id)).toEqual(['ground', 'mezz', 'roof']);
    expect(storeyLevels(levels).map((l) => l.id)).toEqual(['ground', 'mezz']);
    expect(roofLevelOf({ levels })?.id).toBe('roof');
    expect(roofLevelOf({})).toBeNull();
  });

  it('isLevelLike accepts kind roof and rejects any other kind', () => {
    expect(isLevelLike({ id: 'roof', name: 'Roof', index: 1, kind: 'roof' })).toBe(true);
    expect(isLevelLike({ id: 'x', name: 'X', index: 1, kind: 'attic' })).toBe(false);
    expect(isLevelLike({ id: 'x', name: 'X', index: 1 })).toBe(true);
  });

  it('roofSourceLevelId is the highest storey with a drawn room', () => {
    const levels = [groundLevel(), { id: 'one', name: 'First', index: 1 }, roofLevel([groundLevel()])];
    const rooms = [room('g', { polygon: SQ(0, 0, 5, 4) }), room('u', { levelId: 'one' })];
    expect(roofSourceLevelId(levels, rooms)).toBe('ground');
    rooms[1].polygon = SQ(0, 0, 3, 3);
    expect(roofSourceLevelId(levels, rooms)).toBe('one');
    expect(roofSourceLevelId(levels, [room('blank')])).toBeNull();
    // A slab on the roof is never its own source.
    expect(
      roofSourceLevelId(levels, [room('roof-g', { kind: 'roof', levelId: 'roof', polygon: SQ(0, 0, 5, 4) })]),
    ).toBeNull();
  });
});

describe('syncRoofRooms', () => {
  const ground = room('g1', { name: 'Gym', polygon: SQ(0, 0, 5, 4) });
  const ground2 = room('g2', { name: 'Studio', polygon: SQ(5, 0, 3, 4) });
  const levels = [groundLevel(), roofLevel([groundLevel()])];

  it('is a no-op without a roof level (same reference)', () => {
    const p = property([ground]);
    expect(syncRoofRooms(p)).toBe(p);
  });

  it('mirrors every drawn room of the storey beneath as a roof slab', () => {
    const p = property([ground, ground2], levels);
    const out = syncRoofRooms(p);
    const slabs = out.rooms.filter(isRoofRoom);
    expect(slabs.map((s) => s.id)).toEqual([roofRoomIdFor('g1'), roofRoomIdFor('g2')]);
    expect(slabs[0]).toMatchObject({ name: 'Gym', kind: 'roof', levelId: ROOF_LEVEL_ID, polygon: SQ(0, 0, 5, 4), placedItems: [] });
    // The polygon is a COPY, never the source's array.
    expect(slabs[0].polygon).not.toBe(ground.polygon);
    // Source rooms untouched, in order, first.
    expect(out.rooms.slice(0, 2)).toEqual([ground, ground2]);
    expect(roofAreaM2(out)).toBe(32);
    expect(roofSlabPolygons(out)).toHaveLength(2);
  });

  it('is idempotent — a second sync returns the same reference', () => {
    const once = syncRoofRooms(property([ground, ground2], levels));
    expect(syncRoofRooms(once)).toBe(once);
  });

  it('keeps what is on a slab when the room beneath is resized or renamed', () => {
    const once = syncRoofRooms(property([ground], levels));
    const slabId = roofRoomIdFor('g1');
    const withPanel: Property = {
      ...once,
      rooms: once.rooms.map((r) =>
        r.id === slabId ? { ...r, placedItems: [{ instanceId: 'i1', productId: 'panel', x: 0.05, y: 0.05, rotation: 0 }] } : r,
      ),
    };
    const resized: Property = {
      ...withPanel,
      rooms: withPanel.rooms.map((r) => (r.id === 'g1' ? { ...r, name: 'Big gym', polygon: SQ(0, 0, 8, 6) } : r)),
    };
    const out = syncRoofRooms(resized);
    const slab = out.rooms.find((r) => r.id === slabId)!;
    expect(slab.polygon).toEqual(SQ(0, 0, 8, 6));
    expect(slab.name).toBe('Big gym');
    expect(slab.placedItems).toHaveLength(1);
  });

  it('drops an empty orphan slab but keeps one that holds work', () => {
    const once = syncRoofRooms(property([ground, ground2], levels));
    const keepId = roofRoomIdFor('g2');
    const withWork: Property = {
      ...once,
      rooms: once.rooms
        .filter((r) => r.id !== 'g1' && r.id !== 'g2') // both sources removed
        .map((r) => (r.id === keepId ? { ...r, floorFinish: { materialId: 'gym-interlock' } } : r)),
    };
    const out = syncRoofRooms(withWork);
    expect(out.rooms.filter(isRoofRoom).map((r) => r.id)).toEqual([keepId]);
  });

  it('drops the blank room the focus invariant seeded on the roof once slabs exist', () => {
    const seeded = room('blank', { levelId: ROOF_LEVEL_ID });
    const out = syncRoofRooms(property([ground, seeded], levels, 'blank'));
    expect(out.rooms.some((r) => r.id === 'blank')).toBe(false);
    expect(out.rooms.filter(isRoofRoom)).toHaveLength(1);
  });

  it('follows the highest storey with drawn rooms', () => {
    const three = [groundLevel(), { id: 'one', name: 'First', index: 1 }, roofLevel([groundLevel(), { id: 'one', name: 'First', index: 1 }])];
    const upper = room('u1', { name: 'Loft', levelId: 'one', polygon: SQ(1, 1, 3, 3) });
    const out = syncRoofRooms(property([ground, upper], three));
    const slabs = out.rooms.filter(isRoofRoom);
    expect(slabs.map((s) => s.name)).toEqual(['Loft']);
    expect(levelsOf(out).map((l) => l.id)).toEqual(['ground', 'one', 'roof']);
  });
});
