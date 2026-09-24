/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { usePropertyStore, type Property } from '../../store/propertyStore';
import { __test, abortDrawTransaction, beginDrawTransaction, installHistorySubscriptions, isDrawTransactionActive, useHistoryStore } from '../../store/historyStore';
import { previewWallBuild, reconcileWallBuildChain, type WallBuildChain } from '../../designer/wallBuildGesture';
import { commitWallBuild } from '../wallBuildActions';

const v = (x: number, y: number) => ({ x, y });
const blank = (): Property => ({ id: 'p', name: 'House', activeRoomId: 'r', rooms: [{ id: 'r', name: 'Treatment Room', polygon: [], placedItems: [] }] });
let cleanup = () => {};
beforeEach(() => {
  abortDrawTransaction(); __test.resetSubscriptions();
  usePropertyStore.setState({ property: blank(), selectedInstanceId: null });
  cleanup = installHistorySubscriptions({ coalesceMs: 0 });
});
afterEach(() => { abortDrawTransaction(); cleanup(); });
function add(x: number, y: number, chain: WallBuildChain | null = null) {
  const from = chain?.vertices[chain.vertices.length - 1] ?? v(0, 0);
  const draft = previewWallBuild(usePropertyStore.getState().property, from, v(x, y), { chain });
  return commitWallBuild(draft, chain);
}

describe('direct 3D wall commits', () => {
  it('persists a single released wall and makes each following segment one undo action', () => {
    const first = add(4, 0);
    expect(first.ok).toBe(true); if (!first.ok) return;
    expect(usePropertyStore.getState().property.walls).toHaveLength(1);
    expect(useHistoryStore.getState().past).toHaveLength(1);
    const second = add(4, 4, first.chain);
    expect(second.ok).toBe(true); if (!second.ok) return;
    expect(usePropertyStore.getState().property.walls).toHaveLength(2);
    expect(useHistoryStore.getState().past).toHaveLength(2);
    useHistoryStore.getState().undo();
    expect(usePropertyStore.getState().property.walls).toHaveLength(1);
    expect(reconcileWallBuildChain(usePropertyStore.getState().property, second.chain)).toEqual(first.chain);
    useHistoryStore.getState().redo();
    expect(usePropertyStore.getState().property.walls).toHaveLength(2);
    // UI retains the authored run, then derives its restored continuation.
    const restored = reconcileWallBuildChain(usePropertyStore.getState().property, second.chain);
    expect(restored).toBe(second.chain);
    const third = add(0, 4, restored);
    expect(third).toMatchObject({ ok: true, preview: { a: v(4, 4), b: v(0, 4) } });
    expect(usePropertyStore.getState().property.walls).toHaveLength(3);
  });

  it('branches from the surviving endpoint after undo and discards the old redo branch', () => {
    const first = add(4, 0); expect(first.ok).toBe(true); if (!first.ok) return;
    const second = add(4, 4, first.chain); expect(second.ok).toBe(true); if (!second.ok) return;
    useHistoryStore.getState().undo();
    const surviving = reconcileWallBuildChain(usePropertyStore.getState().property, second.chain);
    const branch = add(6, 2, surviving);
    expect(branch).toMatchObject({ ok: true, preview: { a: v(4, 0), b: v(6, 2) } });
    expect(useHistoryStore.getState().future).toHaveLength(0);
    expect(usePropertyStore.getState().property.walls?.some((wall) => wall.id === second.chain?.wallIds[1])).toBe(false);
  });

  it('closes only the owned run into a room, preserving unrelated walls and making conversion reversible', () => {
    usePropertyStore.getState().addFreeWalls([{ a: v(8, 0), b: v(8, 4), thicknessM: 0.12 }]);
    useHistoryStore.getState().reset();
    const foreign = usePropertyStore.getState().property.walls![0];
    let chain: WallBuildChain | null = null;
    for (const [x, y] of [[4, 0], [4, 4], [0, 4]]) {
      const result = add(x, y, chain); expect(result.ok).toBe(true); if (!result.ok) return; chain = result.chain;
    }
    const beforeClosure = structuredClone(usePropertyStore.getState().property);
    const result = add(0, 0, chain);
    expect(result).toMatchObject({ ok: true, roomId: 'r', chain: null });
    expect(usePropertyStore.getState().property.rooms[0].polygon).toEqual([v(0, 0), v(4, 0), v(4, 4), v(0, 4)]);
    expect(usePropertyStore.getState().property.walls).toEqual([foreign]);
    expect(useHistoryStore.getState().past).toHaveLength(4);
    expect(isDrawTransactionActive()).toBe(false);
    useHistoryStore.getState().undo();
    expect(usePropertyStore.getState().property).toEqual(beforeClosure);
    useHistoryStore.getState().redo();
    expect(usePropertyStore.getState().property.walls).toEqual([foreign]);
    expect(usePropertyStore.getState().property.rooms[0].polygon).toHaveLength(4);
  });

  it('adds upper-floor walls above existing ground walls and includes the roof update in closure undo', () => {
    const p = blank();
    p.levels = [{ id: 'ground', name: 'Ground', index: 0 }, { id: 'upper', name: 'Upper', index: 1 }, { id: 'roof', name: 'Roof', index: 2, kind: 'roof' }];
    p.activeLevelId = 'upper';
    p.walls = [{ id: 'ground-wall', a: v(0, 0), b: v(4, 0), thicknessM: 0.12 }];
    usePropertyStore.setState({ property: p }); useHistoryStore.getState().reset();
    let chain: WallBuildChain | null = null;
    for (const [x, y] of [[4, 0], [4, 4], [0, 4]]) {
      const result = add(x, y, chain); expect(result.ok).toBe(true); if (!result.ok) return; chain = result.chain;
    }
    expect(usePropertyStore.getState().property.walls?.filter((wall) => wall.levelId === 'upper')).toHaveLength(3);
    const before = structuredClone(usePropertyStore.getState().property);
    const result = add(0, 0, chain); expect(result.ok).toBe(true); if (!result.ok) return;
    expect(usePropertyStore.getState().property.rooms.find((room) => room.id === result.roomId)?.levelId).toBe('upper');
    expect(usePropertyStore.getState().property.rooms.find((room) => room.kind === 'roof')?.polygon).toHaveLength(4);
    expect(usePropertyStore.getState().property.walls?.[0].id).toBe('ground-wall');
    expect(useHistoryStore.getState().past).toHaveLength(4);
    useHistoryStore.getState().undo(); expect(usePropertyStore.getState().property).toEqual(before);
  });

  it('revalidates stale geometry against new walls without mutating history', () => {
    const draft = previewWallBuild(usePropertyStore.getState().property, v(0, 0), v(4, 0));
    expect(commitWallBuild(draft, null).ok).toBe(true);
    const before = JSON.stringify(usePropertyStore.getState().property);
    expect(commitWallBuild(draft, null)).toMatchObject({ ok: false, reason: 'duplicate-wall' });
    expect(useHistoryStore.getState().past).toHaveLength(1);
    expect(JSON.stringify(usePropertyStore.getState().property)).toBe(before);
  });

  it('rejects unsafe room closure without losing the real walls already drawn', () => {
    const p = blank(); p.rooms[0].polygon = [v(-1, -1), v(6, -1), v(6, 6), v(-1, 6)];
    usePropertyStore.setState({ property: p }); useHistoryStore.getState().reset();
    let chain: WallBuildChain | null = null;
    for (const [x, y] of [[4, 0], [4, 4], [0, 4]]) {
      const result = add(x, y, chain); expect(result.ok).toBe(true); if (!result.ok) return; chain = result.chain;
    }
    const before = JSON.stringify(usePropertyStore.getState().property);
    expect(add(0, 0, chain)).toMatchObject({ ok: false, reason: 'overlapping-room' });
    expect(JSON.stringify(usePropertyStore.getState().property)).toBe(before);
    expect(useHistoryStore.getState().past).toHaveLength(3);
  });

  it('keeps previews/cancellation out of history and respects an already open plan-pen transaction', () => {
    for (let x = 1; x < 5; x++) previewWallBuild(usePropertyStore.getState().property, v(0, 0), v(x, 0));
    expect(useHistoryStore.getState().past).toHaveLength(0);
    expect(usePropertyStore.getState().property.walls).toBeUndefined();
    beginDrawTransaction('plan pen');
    expect(add(4, 0)).toMatchObject({ ok: false, reason: 'drawing-in-progress' });
    expect(isDrawTransactionActive()).toBe(true);
    expect(useHistoryStore.getState().past).toHaveLength(1);
    expect(usePropertyStore.getState().property.walls).toBeUndefined();
  });
});
