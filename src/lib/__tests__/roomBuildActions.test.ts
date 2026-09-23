/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { usePropertyStore, type Property } from '../../store/propertyStore';
import { __test, abortDrawTransaction, beginDrawTransaction, installHistorySubscriptions, isDrawTransactionActive, useHistoryStore } from '../../store/historyStore';
import { previewRectRoomBuild } from '../../designer/roomBuildGesture';
import { commitRectRoomBuild } from '../roomBuildActions';

function blank(): Property {
  return { id: 'p', name: 'House', activeRoomId: 'blank', rooms: [{ id: 'blank', name: 'Treatment Room', polygon: [], placedItems: [] }] };
}
let cleanup = () => {};
beforeEach(() => {
  abortDrawTransaction();
  __test.resetSubscriptions();
  usePropertyStore.setState({ property: blank(), selectedInstanceId: null });
  cleanup = installHistorySubscriptions({ coalesceMs: 0 });
});
afterEach(() => {
  abortDrawTransaction();
  cleanup();
});
const preview = () => previewRectRoomBuild(usePropertyStore.getState().property, { x: 0, y: 0 }, { x: 4, y: 3 });

describe('3D room release commit', () => {
  it('fills the seed room without orphaning it, including a name change in exactly one undo/redo frame', () => {
    const before = structuredClone(usePropertyStore.getState().property);
    const result = commitRectRoomBuild(preview(), 'Studio');
    expect(result).toMatchObject({ ok: true, roomId: 'blank' });
    expect(usePropertyStore.getState().property.rooms).toHaveLength(1);
    expect(usePropertyStore.getState().property.rooms[0]).toMatchObject({ name: 'Studio', polygon: preview().polygon });
    expect(useHistoryStore.getState().past).toHaveLength(1);
    expect(isDrawTransactionActive()).toBe(false);
    const committed = structuredClone(usePropertyStore.getState().property);
    useHistoryStore.getState().undo();
    expect(usePropertyStore.getState().property).toEqual(before);
    useHistoryStore.getState().redo();
    expect(usePropertyStore.getState().property).toEqual(committed);
  });

  it('adds an attached room without changing the existing room or its contents', () => {
    expect(commitRectRoomBuild(preview()).ok).toBe(true);
    const first = structuredClone(usePropertyStore.getState().property.rooms[0]);
    const attached = previewRectRoomBuild(usePropertyStore.getState().property, { x: 4, y: 0 }, { x: 7, y: 3 });
    const result = commitRectRoomBuild(attached);
    expect(result.ok).toBe(true);
    const current = usePropertyStore.getState().property;
    expect(current.rooms).toHaveLength(2);
    expect(current.rooms[0]).toEqual(first);
    expect(current.activeRoomId).not.toBe(first.id);
    expect(useHistoryStore.getState().past).toHaveLength(2);
    useHistoryStore.getState().undo();
    expect(usePropertyStore.getState().property.rooms).toEqual([first]);
  });

  it('revalidates a stale preview and refuses overlap without mutating the store or history', () => {
    const stale = preview();
    expect(commitRectRoomBuild(stale).ok).toBe(true);
    const before = JSON.stringify(usePropertyStore.getState().property);
    const frames = useHistoryStore.getState().past.length;
    expect(commitRectRoomBuild(stale)).toMatchObject({ ok: false, reason: 'overlapping-room' });
    expect(JSON.stringify(usePropertyStore.getState().property)).toBe(before);
    expect(useHistoryStore.getState().past).toHaveLength(frames);
  });

  it('does not let a gesture change floors or create a room on the roof', () => {
    const property = blank();
    property.levels = [{ id: 'ground', name: 'Ground', index: 0 }, { id: 'roof', name: 'Roof', index: 1, kind: 'roof' }];
    usePropertyStore.setState({ property });
    const draft = preview();
    usePropertyStore.getState().setActiveLevel('roof');
    const before = JSON.stringify(usePropertyStore.getState().property);
    const frames = useHistoryStore.getState().past.length;
    expect(commitRectRoomBuild(draft)).toMatchObject({ ok: false, reason: 'level-changed' });
    expect(commitRectRoomBuild(preview())).toMatchObject({ ok: false, reason: 'roof-level' });
    expect(JSON.stringify(usePropertyStore.getState().property)).toBe(before);
    expect(useHistoryStore.getState().past).toHaveLength(frames);
  });

  it('stamps an upper room on its active floor and updates the derived roof in the same history frame', () => {
    const property = blank();
    property.levels = [{ id: 'ground', name: 'Ground', index: 0 }, { id: 'upper', name: 'Upper', index: 1 }, { id: 'roof', name: 'Roof', index: 2, kind: 'roof' }];
    property.activeLevelId = 'upper';
    // Active room intentionally belongs to another floor: it must not be filled.
    usePropertyStore.setState({ property });
    useHistoryStore.getState().reset();
    const before = structuredClone(property);
    const result = commitRectRoomBuild(preview());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const rooms = usePropertyStore.getState().property.rooms;
    expect(rooms.find((room) => room.id === result.roomId)).toMatchObject({ levelId: 'upper' });
    expect(rooms.find((room) => room.id === 'blank')?.polygon).toEqual([]);
    expect(rooms.find((room) => room.kind === 'roof')?.polygon).toEqual(result.preview.polygon);
    expect(useHistoryStore.getState().past).toHaveLength(1);
    useHistoryStore.getState().undo();
    expect(usePropertyStore.getState().property).toEqual(before);
  });

  it('leaves an existing wall-pen transaction untouched instead of stealing its undo frame', () => {
    const before = JSON.stringify(usePropertyStore.getState().property);
    beginDrawTransaction('existing wall pen');
    expect(commitRectRoomBuild(preview())).toMatchObject({ ok: false, reason: 'drawing-in-progress' });
    expect(isDrawTransactionActive()).toBe(true);
    expect(useHistoryStore.getState().past).toHaveLength(1);
    expect(JSON.stringify(usePropertyStore.getState().property)).toBe(before);
  });

  it('keeps cancelled previews and rejected tiny gestures out of undo history', () => {
    for (let x = 1; x < 5; x++) previewRectRoomBuild(usePropertyStore.getState().property, { x: 0, y: 0 }, { x, y: 3 });
    expect(useHistoryStore.getState().past).toHaveLength(0);
    expect(commitRectRoomBuild(previewRectRoomBuild(usePropertyStore.getState().property, { x: 0, y: 0 }, { x: 0.01, y: 0.01 }))).toMatchObject({ ok: false, reason: 'too-small' });
    expect(useHistoryStore.getState().past).toHaveLength(0);
    expect(usePropertyStore.getState().property.rooms[0].polygon).toEqual([]);
  });
});
