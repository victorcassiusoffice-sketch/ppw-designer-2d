/**
 * @vitest-environment jsdom
 *
 * historyStore — Phase A.0 / Tweak 07 unit tests.
 *
 * Covers the acceptance criteria from
 * `06-Roadmap/sims-parity/master/CODE-RUNNER-DESIGN-TWEAK-1/07-undo-button.md`:
 *
 *   1. Place an item → undo → item gone, then redo → item back.
 *   2. Draw walls → undo each → walls disappear in reverse order.
 *   3. Clear-layer → undo → restored.
 *   4. 50-frame cap evicts the oldest.
 *   5. Top-10 frames serialise to sessionStorage and re-hydrate.
 *   6. recordSnapshot hook is usable by future Tweaks (rotate / floor /
 *      treatment / 3D-place).
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  useHistoryStore,
  installHistorySubscriptions,
  HISTORY_LIMIT,
  SESSION_PERSIST_LIMIT,
  SESSION_KEY,
  abortDrawTransaction,
  beginDrawTransaction,
  endDrawTransaction,
  isDrawTransactionActive,
  __test,
} from '../historyStore';
import { usePropertyStore } from '../propertyStore';
import { useWallStore, DEFAULT_HEIGHT_MM, DEFAULT_THICKNESS_MM } from '../wallStore';

let teardown: (() => void) | null = null;

beforeEach(() => {
  // Wipe any lingering state from prior tests in this file (Vitest reuses
  // module state across tests in the same worker).
  __test.resetSubscriptions();
  usePropertyStore.getState().resetToDefault();
  useWallStore.getState().clearWalls();
  if (typeof sessionStorage !== 'undefined') sessionStorage.clear();
  // Install with coalesceMs = 0 so every change is its own frame.
  teardown = installHistorySubscriptions({ coalesceMs: 0 });
});

afterEach(() => {
  if (teardown) {
    teardown();
    teardown = null;
  }
});

function makeWall(x: number) {
  return {
    start: { x_mm: x, y_mm: 0 },
    end: { x_mm: x + 1000, y_mm: 0 },
    thickness_mm: DEFAULT_THICKNESS_MM,
    height_mm: DEFAULT_HEIGHT_MM,
    type: 'full' as const,
  };
}

describe('historyStore — place / undo / redo round-trip (criterion 4a)', () => {
  it('records placement and restores empty state on undo, item on redo', () => {
    const ps = usePropertyStore.getState();
    const initialItems = ps.property.rooms[0].placedItems.length;
    ps.addItem({ productId: 'flat-bench', x: 1, y: 1, rotation: 0 });
    expect(usePropertyStore.getState().property.rooms[0].placedItems.length).toBe(
      initialItems + 1,
    );

    useHistoryStore.getState().undo();
    expect(usePropertyStore.getState().property.rooms[0].placedItems.length).toBe(
      initialItems,
    );

    useHistoryStore.getState().redo();
    expect(usePropertyStore.getState().property.rooms[0].placedItems.length).toBe(
      initialItems + 1,
    );
  });
});

describe('historyStore — move (updateItem) is undoable', () => {
  it('reverts an item move', () => {
    const ps = usePropertyStore.getState();
    const id = ps.addItem({ productId: 'mat', x: 1, y: 1, rotation: 0 });
    usePropertyStore.getState().updateItem(id, { x: 3, y: 4 });
    expect(usePropertyStore.getState().property.rooms[0].placedItems[0].x).toBe(3);

    useHistoryStore.getState().undo(); // undo move
    expect(usePropertyStore.getState().property.rooms[0].placedItems[0].x).toBe(1);
  });
});

describe('historyStore — delete is undoable', () => {
  it('restores a deleted item', () => {
    const ps = usePropertyStore.getState();
    const id = ps.addItem({ productId: 'kettlebell', x: 2, y: 2, rotation: 0 });
    usePropertyStore.getState().removeItem(id);
    expect(usePropertyStore.getState().property.rooms[0].placedItems).toHaveLength(0);

    useHistoryStore.getState().undo();
    expect(usePropertyStore.getState().property.rooms[0].placedItems).toHaveLength(1);
    expect(usePropertyStore.getState().property.rooms[0].placedItems[0].productId).toBe(
      'kettlebell',
    );
  });
});

describe('historyStore — wall draw is undoable (criterion 4 draw-wall)', () => {
  it('removes walls in reverse order on repeated undo', () => {
    const ws = useWallStore.getState();
    ws.addWall(makeWall(0));
    ws.addWall(makeWall(2000));
    ws.addWall(makeWall(4000));
    expect(useWallStore.getState().walls).toHaveLength(3);

    useHistoryStore.getState().undo();
    expect(useWallStore.getState().walls).toHaveLength(2);
    useHistoryStore.getState().undo();
    expect(useWallStore.getState().walls).toHaveLength(1);
    useHistoryStore.getState().undo();
    expect(useWallStore.getState().walls).toHaveLength(0);
  });
});

describe('historyStore — clear-layer is undoable (criterion 4 clear-layer)', () => {
  it('restores all walls after clearWalls + undo', () => {
    const ws = useWallStore.getState();
    ws.addWall(makeWall(0));
    ws.addWall(makeWall(2000));
    ws.clearWalls();
    expect(useWallStore.getState().walls).toHaveLength(0);

    useHistoryStore.getState().undo();
    expect(useWallStore.getState().walls).toHaveLength(2);
  });

  it('restores all placed items after clearActiveRoomItems + undo', () => {
    const ps = usePropertyStore.getState();
    ps.addItem({ productId: 'mat', x: 1, y: 1, rotation: 0 });
    ps.addItem({ productId: 'bench', x: 2, y: 2, rotation: 0 });
    ps.clearActiveRoomItems();
    expect(usePropertyStore.getState().property.rooms[0].placedItems).toHaveLength(0);

    useHistoryStore.getState().undo();
    expect(usePropertyStore.getState().property.rooms[0].placedItems).toHaveLength(2);
  });
});

describe('historyStore — 50-frame cap (criterion 3)', () => {
  it('evicts oldest when more than HISTORY_LIMIT frames pushed', () => {
    const ps = usePropertyStore.getState();
    // Push HISTORY_LIMIT + 5 mutations so we exercise the cap.
    for (let i = 0; i < HISTORY_LIMIT + 5; i++) {
      ps.addItem({ productId: `p${i}`, x: i, y: i, rotation: 0 });
    }
    expect(useHistoryStore.getState().past.length).toBe(HISTORY_LIMIT);
  });
});

describe('historyStore — sessionStorage top-10 persistence (criterion 6)', () => {
  it('writes only the top-10 frames to sessionStorage', () => {
    const ps = usePropertyStore.getState();
    for (let i = 0; i < SESSION_PERSIST_LIMIT + 5; i++) {
      ps.addItem({ productId: `p${i}`, x: i, y: i, rotation: 0 });
    }
    const raw = sessionStorage.getItem(SESSION_KEY);
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw as string);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed.length).toBeLessThanOrEqual(SESSION_PERSIST_LIMIT);
  });
});

describe('historyStore — recordSnapshot hook for future Tweaks (criterion 5)', () => {
  it('lets imperative callers push an action snapshot manually', () => {
    const ps = usePropertyStore.getState();
    const id = ps.addItem({ productId: 'bench', x: 1, y: 1, rotation: 0 });

    // Simulate a Tweak 01 rotate that talks to Konva imperatively before
    // it lands in the store: caller snapshots first, then mutates.
    useHistoryStore.getState().recordSnapshot('rotate');
    usePropertyStore.getState().updateItem(id, { rotation: 90 });

    // Two frames in past (one from addItem, one from recordSnapshot).
    expect(useHistoryStore.getState().past.length).toBeGreaterThanOrEqual(2);

    useHistoryStore.getState().undo();
    // Subscriber-pushed updateItem frame undoes first → rotation back to 0.
    expect(usePropertyStore.getState().property.rooms[0].placedItems[0].rotation).toBe(0);
  });
});

describe('historyStore — redo cleared by a new action (standard semantics)', () => {
  it('drops future stack on a new mutation after undo', () => {
    const ps = usePropertyStore.getState();
    ps.addItem({ productId: 'a', x: 1, y: 1, rotation: 0 });
    ps.addItem({ productId: 'b', x: 2, y: 2, rotation: 0 });

    useHistoryStore.getState().undo();
    expect(useHistoryStore.getState().future.length).toBe(1);

    ps.addItem({ productId: 'c', x: 3, y: 3, rotation: 0 });
    expect(useHistoryStore.getState().future.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Attached multi-room (2026-08-26) — abortDrawTransaction.
//
// Entering draw mode no longer wipes the canvas, so a draw that changes
// nothing must leave history EXACTLY as it found it. Otherwise every visit
// to draw mode strands a phantom frame and the user's next Ctrl+Z silently
// does nothing.
// ---------------------------------------------------------------------------

describe('historyStore — abortDrawTransaction', () => {
  it('begin → abort leaves past.length unchanged', () => {
    const before = useHistoryStore.getState().past.length;
    beginDrawTransaction('draw new room');
    // begin pushes its entry frame up front...
    expect(useHistoryStore.getState().past.length).toBe(before + 1);
    abortDrawTransaction();
    // ...and abort pops it back off WITHOUT applying it.
    expect(useHistoryStore.getState().past.length).toBe(before);
  });

  it('abort re-writes the sessionStorage mirror so it tracks the pop', () => {
    beginDrawTransaction('draw new room');
    const during = JSON.parse(sessionStorage.getItem(SESSION_KEY) ?? '[]');
    abortDrawTransaction();
    const after = JSON.parse(sessionStorage.getItem(SESSION_KEY) ?? '[]');
    // The mirror is the only in-page view of history; without the rewrite a
    // correct implementation still looks wrong from the outside.
    expect(after.length).toBe(during.length - 1);
  });

  it('abort does NOT apply the popped frame (state is left alone)', () => {
    const roomId = usePropertyStore.getState().property.activeRoomId;
    usePropertyStore.getState().setRoomPolygon(roomId, [
      { x: 0, y: 0 }, { x: 5, y: 0 }, { x: 5, y: 4 }, { x: 0, y: 4 },
    ]);
    beginDrawTransaction('draw new room');
    // A mutation inside the transaction is suppressed, not reverted.
    usePropertyStore.getState().renameRoom(roomId, 'Renamed Mid Draw');
    abortDrawTransaction();
    expect(
      usePropertyStore.getState().property.rooms.find((r) => r.id === roomId)?.name,
    ).toBe('Renamed Mid Draw');
  });

  it('begin → mutate → end keeps exactly ONE new frame', () => {
    const before = useHistoryStore.getState().past.length;
    beginDrawTransaction('draw new room');
    usePropertyStore.getState().addRoom({
      name: 'Drawn',
      polygon: [{ x: 0, y: 0 }, { x: 3, y: 0 }, { x: 3, y: 3 }],
    });
    endDrawTransaction();
    expect(useHistoryStore.getState().past.length).toBe(before + 1);
  });

  it('abort AFTER end is a no-op (the commit path convention)', () => {
    // handleDrawCommit ends the transaction explicitly, then App's exit
    // branch aborts. That second call must not eat the committed frame.
    const before = useHistoryStore.getState().past.length;
    beginDrawTransaction('draw new room');
    usePropertyStore.getState().addRoom({
      name: 'Drawn',
      polygon: [{ x: 0, y: 0 }, { x: 3, y: 0 }, { x: 3, y: 3 }],
    });
    endDrawTransaction();
    abortDrawTransaction();
    expect(useHistoryStore.getState().past.length).toBe(before + 1);
  });

  it('abort with NO transaction open is a safe no-op', () => {
    const before = useHistoryStore.getState().past.length;
    abortDrawTransaction();
    abortDrawTransaction();
    expect(useHistoryStore.getState().past.length).toBe(before);
  });

  it('after an abort, later mutations still record normally', () => {
    beginDrawTransaction('draw new room');
    abortDrawTransaction();
    const before = useHistoryStore.getState().past.length;
    usePropertyStore.getState().addRoom({
      name: 'After',
      polygon: [{ x: 0, y: 0 }, { x: 2, y: 0 }, { x: 2, y: 2 }],
    });
    expect(useHistoryStore.getState().past.length).toBe(before + 1);
  });

  it('isDrawTransactionActive tracks begin / end / abort', () => {
    expect(isDrawTransactionActive()).toBe(false);
    beginDrawTransaction('draw new room');
    expect(isDrawTransactionActive()).toBe(true);
    abortDrawTransaction();
    expect(isDrawTransactionActive()).toBe(false);
    beginDrawTransaction('draw new room');
    endDrawTransaction();
    expect(isDrawTransactionActive()).toBe(false);
  });
});
