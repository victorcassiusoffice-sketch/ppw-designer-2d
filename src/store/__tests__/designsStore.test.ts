/**
 * M1.D.1 — designsStore save/load round-trip Vitest.
 *
 * Covers the public state machine of `useDesignsStore`:
 *   - `saveAs(name, snapshot)` round-trip via the legacy
 *     `{ roomDimensions, placedItems }` shape (Week 1/2 surface).
 *   - `savePropertyAs(name, property)` round-trip with a multi-room
 *     Property (Week 2.5+ surface).
 *   - `__draft__` draft slot is excluded from `list()` but visible via
 *     `getDraft()` (the `useAutoSave` hot path).
 *   - `remove`, `rename`, `setCurrent` invariants.
 *
 * This is the stability gate for unlocking the Konva MVP lock entry
 * (M1.D.6): Save/Load must round-trip cleanly before we declare the
 * MVP stable.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useDesignsStore, DRAFT_ID } from '../designsStore';
import { rectToPolygon } from '../../lib/geometry';
import type { Property } from '../propertyStore';

beforeEach(() => {
  // vitest env is "node" — no `localStorage`. The store's persist
  // middleware is fine with that (createJSONStorage resolves lazily and
  // no-ops when `localStorage` is undefined). Resetting the in-memory
  // state is enough for test isolation.
  useDesignsStore.setState({ designs: {}, currentId: null });
});

describe('designsStore — save/load round-trip', () => {
  it('round-trips a legacy snapshot via saveAs → list', () => {
    const id = useDesignsStore.getState().saveAs('Kitchen plan', {
      roomDimensions: { lengthM: 5, widthM: 4 },
      placedItems: [
        { instanceId: 'i1', productId: 'p1', x: 1, y: 1, rotation: 0 },
      ],
    });
    const all = useDesignsStore.getState().list();
    expect(all).toHaveLength(1);
    expect(all[0]!.id).toBe(id);
    expect(all[0]!.name).toBe('Kitchen plan');
    expect(all[0]!.placedItems).toHaveLength(1);
    expect(all[0]!.property.rooms).toHaveLength(1);
    expect(all[0]!.property.rooms[0]!.placedItems[0]!.instanceId).toBe('i1');
  });

  it('round-trips a multi-room Property via savePropertyAs', () => {
    const room1Id = 'room-1-id';
    const room2Id = 'room-2-id';
    const property: Property = {
      id: 'prop-1',
      name: 'Wellness Suite',
      activeRoomId: room1Id,
      rooms: [
        {
          id: room1Id,
          name: 'Plunge Room',
          polygon: rectToPolygon({ lengthM: 4, widthM: 3 }),
          placedItems: [
            { instanceId: 'i1', productId: 'chair-001', x: 0.5, y: 0.5, rotation: 90 },
          ],
        },
        {
          id: room2Id,
          name: 'Recovery Room',
          polygon: rectToPolygon({ lengthM: 6, widthM: 5 }),
          placedItems: [],
        },
      ],
    };
    const id = useDesignsStore.getState().savePropertyAs('Suite v1', property);
    const reloaded = useDesignsStore.getState().designs[id]!;
    expect(reloaded.property.rooms).toHaveLength(2);
    expect(reloaded.property.rooms[0]!.name).toBe('Plunge Room');
    expect(reloaded.property.rooms[0]!.placedItems[0]!.rotation).toBe(90);
    expect(reloaded.property.rooms[1]!.name).toBe('Recovery Room');
    // v1 mirror is the FIRST room only — confirms projectToV1 behaviour.
    expect(reloaded.placedItems).toHaveLength(1);
    expect(reloaded.placedItems[0]!.instanceId).toBe('i1');
  });

  it('saveDraft writes the __draft__ slot but list() excludes it', () => {
    useDesignsStore.getState().saveAs('Named A', {
      roomDimensions: { lengthM: 5, widthM: 4 },
      placedItems: [],
    });
    useDesignsStore.getState().saveDraft({
      roomDimensions: { lengthM: 3, widthM: 3 },
      placedItems: [
        { instanceId: 'd1', productId: 'pd', x: 0, y: 0, rotation: 0 },
      ],
    });
    const list = useDesignsStore.getState().list();
    expect(list).toHaveLength(1);
    expect(list.find((d) => d.id === DRAFT_ID)).toBeUndefined();
    const draft = useDesignsStore.getState().getDraft();
    expect(draft).toBeDefined();
    expect(draft!.id).toBe(DRAFT_ID);
    expect(draft!.placedItems[0]!.instanceId).toBe('d1');
  });

  it('remove deletes only the target row and clears currentId when removing it', () => {
    const idA = useDesignsStore.getState().saveAs('A', {
      roomDimensions: { lengthM: 5, widthM: 4 },
      placedItems: [],
    });
    const idB = useDesignsStore.getState().saveAs('B', {
      roomDimensions: { lengthM: 6, widthM: 4 },
      placedItems: [],
    });
    useDesignsStore.getState().setCurrent(idA);
    useDesignsStore.getState().remove(idA);
    const designs = useDesignsStore.getState().designs;
    expect(designs[idA]).toBeUndefined();
    expect(designs[idB]).toBeDefined();
    expect(useDesignsStore.getState().currentId).toBeNull();
  });

  it('rename updates both the SavedDesign.name and the embedded property.name', () => {
    const id = useDesignsStore.getState().saveAs('Old name', {
      roomDimensions: { lengthM: 5, widthM: 4 },
      placedItems: [],
    });
    useDesignsStore.getState().rename(id, 'New name');
    const row = useDesignsStore.getState().designs[id]!;
    expect(row.name).toBe('New name');
    expect(row.property.name).toBe('New name');
  });

  it('rename is a no-op when the id does not exist', () => {
    const before = useDesignsStore.getState().designs;
    useDesignsStore.getState().rename('nope', 'whatever');
    expect(useDesignsStore.getState().designs).toEqual(before);
  });

  it('list is sorted newest-first by savedAt', () => {
    const idA = useDesignsStore.getState().saveAs('A', {
      roomDimensions: { lengthM: 5, widthM: 4 },
      placedItems: [],
    });
    // Backdate A so B is strictly newer regardless of clock resolution.
    useDesignsStore.setState((s) => ({
      designs: {
        ...s.designs,
        [idA]: { ...s.designs[idA]!, savedAt: '2026-01-01T00:00:00.000Z' },
      },
    }));
    const idB = useDesignsStore.getState().saveAs('B', {
      roomDimensions: { lengthM: 6, widthM: 4 },
      placedItems: [],
    });
    const ordered = useDesignsStore.getState().list();
    expect(ordered.map((d) => d.id)).toEqual([idB, idA]);
  });

  it('savePropertyDraft mirrors v1 fields from the first room', () => {
    const roomId = 'r1';
    const property: Property = {
      id: 'p',
      name: '(unsaved draft)',
      activeRoomId: roomId,
      rooms: [
        {
          id: roomId,
          name: 'Only Room',
          polygon: rectToPolygon({ lengthM: 7, widthM: 5 }),
          placedItems: [
            { instanceId: 'i1', productId: 'x', x: 1, y: 1, rotation: 0 },
            { instanceId: 'i2', productId: 'y', x: 2, y: 2, rotation: 180 },
          ],
        },
      ],
    };
    useDesignsStore.getState().savePropertyDraft(property);
    const draft = useDesignsStore.getState().getDraft()!;
    expect(draft.id).toBe(DRAFT_ID);
    expect(draft.roomDimensions.lengthM).toBeCloseTo(7);
    expect(draft.roomDimensions.widthM).toBeCloseTo(5);
    expect(draft.placedItems).toHaveLength(2);
  });
});
