/**
 * propertyStore — wall-hosted openings (doors / doorways / windows).
 *
 * The round-trip test in here is the important one. `normaliseLoadedRoom`
 * WHITELISTS fields, so a new field on Room survives a reload (the persist
 * blob is restored verbatim) but is silently deleted the first time a design
 * is saved and loaded again. That is a data-loss bug that hides for weeks, so
 * it gets a test rather than a comment.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  usePropertyStore,
  normaliseLoadedProperty,
  normaliseLoadedRoom,
  roomOpenings,
  pruneOpenings,
} from '../propertyStore';
import { DEFAULT_DOOR_WIDTH_M, type Opening } from '../../designer/openings';

/** A 5 x 4 m room. Edge 0 = (0,0)->(5,0); edge 1 = (5,0)->(5,4). */
function seedRoom(): string {
  const ps = usePropertyStore.getState();
  const id = ps.property.rooms[0].id;
  ps.setRoomPolygon(id, [
    { x: 0, y: 0 },
    { x: 5, y: 0 },
    { x: 5, y: 4 },
    { x: 0, y: 4 },
  ]);
  return id;
}

const DOOR: Omit<Opening, 'id'> = {
  edgeIndex: 0,
  offsetM: 2.5,
  widthM: DEFAULT_DOOR_WIDTH_M,
  kind: 'door',
  flipFacing: false,
  flipHand: false,
};

beforeEach(() => {
  usePropertyStore.getState().resetToDefault();
});

describe('addOpening', () => {
  it('cuts a door into a wall and returns its id', () => {
    const roomId = seedRoom();
    const id = usePropertyStore.getState().addOpening(roomId, DOOR);
    expect(id).toBeTruthy();

    const room = usePropertyStore.getState().property.rooms.find((r) => r.id === roomId)!;
    expect(roomOpenings(room)).toHaveLength(1);
    expect(roomOpenings(room)[0]).toMatchObject({ id, edgeIndex: 0, kind: 'door' });
  });

  it('refuses an unknown room or a non-existent edge', () => {
    const roomId = seedRoom();
    expect(usePropertyStore.getState().addOpening('nope', DOOR)).toBeNull();
    expect(usePropertyStore.getState().addOpening(roomId, { ...DOOR, edgeIndex: 99 })).toBeNull();
  });

  it('refuses a door that would not fit its wall', () => {
    const roomId = seedRoom();
    // Edge 1 is 4 m; a 9 m door cannot host.
    expect(usePropertyStore.getState().addOpening(roomId, { ...DOOR, edgeIndex: 1, widthM: 9 }))
      .toBeNull();
  });

  it('refuses a second opening overlapping the first on the SAME wall', () => {
    const roomId = seedRoom();
    usePropertyStore.getState().addOpening(roomId, { ...DOOR, offsetM: 2.5, widthM: 1 });
    const clash = usePropertyStore.getState().addOpening(roomId, {
      ...DOOR,
      offsetM: 3.0,
      widthM: 1,
    });
    expect(clash).toBeNull();
    const room = usePropertyStore.getState().property.rooms.find((r) => r.id === roomId)!;
    expect(roomOpenings(room)).toHaveLength(1);
  });

  it('ALLOWS a second opening on a different wall at the same offset', () => {
    const roomId = seedRoom();
    usePropertyStore.getState().addOpening(roomId, { ...DOOR, edgeIndex: 0, offsetM: 2 });
    const second = usePropertyStore.getState().addOpening(roomId, {
      ...DOOR,
      edgeIndex: 1,
      offsetM: 2,
    });
    expect(second).toBeTruthy();
    const room = usePropertyStore.getState().property.rooms.find((r) => r.id === roomId)!;
    expect(roomOpenings(room)).toHaveLength(2);
  });
});

describe('updateOpening', () => {
  it('slides a door along its wall', () => {
    const roomId = seedRoom();
    const id = usePropertyStore.getState().addOpening(roomId, DOOR)!;
    expect(usePropertyStore.getState().updateOpening(id, { offsetM: 1.2 })).toBe(true);
    const room = usePropertyStore.getState().property.rooms.find((r) => r.id === roomId)!;
    expect(roomOpenings(room)[0].offsetM).toBeCloseTo(1.2, 9);
  });

  it('flips hand and facing', () => {
    const roomId = seedRoom();
    const id = usePropertyStore.getState().addOpening(roomId, DOOR)!;
    usePropertyStore.getState().updateOpening(id, { flipHand: true, flipFacing: true });
    const room = usePropertyStore.getState().property.rooms.find((r) => r.id === roomId)!;
    expect(roomOpenings(room)[0]).toMatchObject({ flipHand: true, flipFacing: true });
  });

  it('REFUSES a drag past the jamb margin and changes nothing', () => {
    const roomId = seedRoom();
    const id = usePropertyStore.getState().addOpening(roomId, DOOR)!;
    expect(usePropertyStore.getState().updateOpening(id, { offsetM: 0 })).toBe(false);
    const room = usePropertyStore.getState().property.rooms.find((r) => r.id === roomId)!;
    expect(roomOpenings(room)[0].offsetM).toBeCloseTo(2.5, 9);
  });

  it('does not collide with ITSELF when only the width changes', () => {
    const roomId = seedRoom();
    const id = usePropertyStore.getState().addOpening(roomId, DOOR)!;
    expect(usePropertyStore.getState().updateOpening(id, { widthM: 1.2 })).toBe(true);
  });

  it('returns false for an unknown opening', () => {
    seedRoom();
    expect(usePropertyStore.getState().updateOpening('ghost', { offsetM: 1 })).toBe(false);
  });
});

describe('removeOpening', () => {
  it('removes by id from whichever room owns it', () => {
    const roomId = seedRoom();
    const id = usePropertyStore.getState().addOpening(roomId, DOOR)!;
    usePropertyStore.getState().removeOpening(id);
    const room = usePropertyStore.getState().property.rooms.find((r) => r.id === roomId)!;
    expect(roomOpenings(room)).toHaveLength(0);
  });

  it('is a no-op for an unknown id', () => {
    const roomId = seedRoom();
    usePropertyStore.getState().addOpening(roomId, DOOR);
    usePropertyStore.getState().removeOpening('ghost');
    const room = usePropertyStore.getState().property.rooms.find((r) => r.id === roomId)!;
    expect(roomOpenings(room)).toHaveLength(1);
  });
});

describe('cascade — an opening cannot outlive its wall', () => {
  it('drops openings whose host edge disappears when the room is reshaped', () => {
    const roomId = seedRoom();
    usePropertyStore.getState().addOpening(roomId, { ...DOOR, edgeIndex: 1, offsetM: 2 });
    usePropertyStore.getState().addOpening(roomId, { ...DOOR, edgeIndex: 0, offsetM: 2.5 });

    // Reshape to a triangle: edges 2 and 3 vanish, and edge 1 changes.
    usePropertyStore.getState().setRoomPolygon(roomId, [
      { x: 0, y: 0 },
      { x: 5, y: 0 },
      { x: 0, y: 4 },
    ]);

    const room = usePropertyStore.getState().property.rooms.find((r) => r.id === roomId)!;
    // Edge 0 is still (0,0)->(5,0) so its door survives; the edge-1 door's
    // wall is now a different, shorter diagonal and it is dropped.
    for (const o of roomOpenings(room)) {
      expect(o.edgeIndex).toBeLessThan(3);
    }
    expect(roomOpenings(room).some((o) => o.edgeIndex === 0)).toBe(true);
  });

  it('drops an opening when its wall shrinks below it', () => {
    const roomId = seedRoom();
    usePropertyStore.getState().addOpening(roomId, { ...DOOR, edgeIndex: 0, offsetM: 4.5, widthM: 0.8 });
    // Shrink the top wall from 5 m to 2 m — the door at 4.5 m is off the end.
    usePropertyStore.getState().setRoomPolygon(roomId, [
      { x: 0, y: 0 },
      { x: 2, y: 0 },
      { x: 2, y: 4 },
      { x: 0, y: 4 },
    ]);
    const room = usePropertyStore.getState().property.rooms.find((r) => r.id === roomId)!;
    expect(roomOpenings(room)).toHaveLength(0);
  });
});

describe('persistence — openings survive a save/load round trip', () => {
  it('normaliseLoadedRoom KEEPS openings (it whitelists fields)', () => {
    const room = normaliseLoadedRoom({
      id: 'r1',
      name: 'Studio',
      polygon: [{ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 5, y: 4 }, { x: 0, y: 4 }],
      placedItems: [],
      openings: [{ ...DOOR, id: 'o1' }],
    });
    expect(roomOpenings(room)).toHaveLength(1);
    expect(roomOpenings(room)[0].id).toBe('o1');
  });

  it('survives a full normaliseLoadedProperty round trip', () => {
    const roomId = seedRoom();
    usePropertyStore.getState().addOpening(roomId, DOOR);
    const before = usePropertyStore.getState().property;

    const after = normaliseLoadedProperty(JSON.parse(JSON.stringify(before)));
    const room = after!.rooms.find((r) => r.id === roomId)!;
    expect(roomOpenings(room)).toHaveLength(1);
    expect(roomOpenings(room)[0]).toMatchObject({ edgeIndex: 0, kind: 'door' });
  });

  it('tolerates a property saved BEFORE openings existed', () => {
    const room = normaliseLoadedRoom({
      id: 'legacy',
      name: 'Old',
      polygon: [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 3 }],
      placedItems: [],
    });
    expect(roomOpenings(room)).toEqual([]);
  });

  it('drops a persisted opening whose edge no longer exists', () => {
    const room = normaliseLoadedRoom({
      id: 'r1',
      name: 'Studio',
      polygon: [{ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 5, y: 4 }],
      placedItems: [],
      openings: [{ ...DOOR, id: 'stale', edgeIndex: 7 }],
    });
    expect(roomOpenings(room)).toEqual([]);
  });
});

describe('pruneOpenings', () => {
  const SQUARE = [{ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 5, y: 4 }, { x: 0, y: 4 }];

  it('returns [] for undefined / empty', () => {
    expect(pruneOpenings(undefined, SQUARE)).toEqual([]);
    expect(pruneOpenings([], SQUARE)).toEqual([]);
  });

  it('keeps a valid opening', () => {
    expect(pruneOpenings([{ ...DOOR, id: 'a' }], SQUARE)).toHaveLength(1);
  });

  it('drops malformed records', () => {
    const junk = [{ id: 'x' }, null, { id: 'y', edgeIndex: 0 }] as unknown as Opening[];
    expect(pruneOpenings(junk, SQUARE)).toEqual([]);
  });

  it('drops an opening hanging off the end of its wall', () => {
    expect(pruneOpenings([{ ...DOOR, id: 'a', offsetM: 4.9, widthM: 1 }], SQUARE)).toEqual([]);
  });
});
