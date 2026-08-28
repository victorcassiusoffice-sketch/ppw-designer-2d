/**
 * The shared undo ladder, plus the three latent history defects behind Vic's
 * "the undo button doesn't work properly mid-draw".
 *
 * The order these were fixed in mattered: re-routing the button FIRST would
 * have made the visible symptom disappear while history carried on eating real
 * user frames — the worst possible outcome, a silent corruption behind a
 * now-working-looking control. So each underlying defect gets its own test.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  useHistoryStore,
  beginDrawTransaction,
  endDrawTransaction,
  abortDrawTransaction,
  isDrawTransactionActive,
  installHistorySubscriptions,
} from '../../store/historyStore';
import { usePropertyStore } from '../../store/propertyStore';
import { useDrawProgressStore } from '../../store/drawProgressStore';
import { useWallStore } from '../../store/wallStore';
import { performUndo, performRedo, canUndo } from '../undoIntent';

beforeEach(() => {
  useHistoryStore.getState().reset();
  usePropertyStore.getState().resetToDefault();
  useDrawProgressStore.getState().reset();
  useWallStore.getState().replace([]);
  useWallStore.getState().setDraw({ phase: 'idle' });
});

describe('the ladder — most specific in-flight thing wins', () => {
  it('mid-draw with vertices, undo removes the LAST VERTEX', () => {
    const dp = useDrawProgressStore.getState();
    dp.setEnabled(true);
    dp.setVertices([{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }]);

    expect(performUndo()).toBe('vertex');
    expect(useDrawProgressStore.getState().vertices).toHaveLength(2);

    expect(performUndo()).toBe('vertex');
    expect(useDrawProgressStore.getState().vertices).toHaveLength(1);
  });

  it('mid wall-segment, undo abandons the in-flight segment', () => {
    useWallStore.getState().setDraw({ phase: 'drawing', anchor: { x_mm: 0, y_mm: 0 } });
    expect(performUndo()).toBe('wall-segment');
    expect(useWallStore.getState().draw.phase).toBe('armed');
  });

  it('in a draw transaction with nothing in flight, undo does NOTHING', () => {
    beginDrawTransaction();
    useDrawProgressStore.getState().setEnabled(true);
    expect(performUndo()).toBe('none');
    abortDrawTransaction();
  });

  it('otherwise it is an ordinary history undo', () => {
    installHistorySubscriptions();
    const id = usePropertyStore.getState().property.rooms[0].id;
    usePropertyStore.getState().renameRoom(id, 'Sauna');
    useHistoryStore.getState().flush();
    expect(useHistoryStore.getState().past.length).toBeGreaterThan(0);

    expect(performUndo()).toBe('history');
  });
});

describe('canUndo mirrors the ladder', () => {
  it('is true mid-draw even when the history stack is empty', () => {
    expect(useHistoryStore.getState().past).toHaveLength(0);
    const dp = useDrawProgressStore.getState();
    dp.setEnabled(true);
    dp.setVertices([{ x: 0, y: 0 }]);
    // The button used to be disabled here - dead at the exact moment undo is
    // most useful.
    expect(canUndo()).toBe(true);
  });

  it('is false inside a draw transaction with nothing in flight', () => {
    beginDrawTransaction();
    expect(canUndo()).toBe(false);
    abortDrawTransaction();
  });
});

describe('defect 1 — undo inside a transaction must not lift suppression', () => {
  it('undo() is refused while a draw transaction is open', () => {
    installHistorySubscriptions();
    const id = usePropertyStore.getState().property.rooms[0].id;
    usePropertyStore.getState().renameRoom(id, 'Before');
    useHistoryStore.getState().flush();
    const before = useHistoryStore.getState().past.length;

    beginDrawTransaction();
    // The TopBar button used to reach this directly, with no guard.
    useHistoryStore.getState().undo();
    expect(
      useHistoryStore.getState().past.length,
      'undo inside a transaction must not pop the transaction frame',
    ).toBe(before + 1);

    abortDrawTransaction();
    expect(useHistoryStore.getState().past.length).toBe(before);
  });

  it('redo() is refused while a draw transaction is open', () => {
    beginDrawTransaction();
    expect(performRedo()).toBe(false);
    abortDrawTransaction();
  });
});

describe('defect 2 — abort pops its OWN frame, not whatever is last', () => {
  it('begin -> abort leaves the history exactly as it found it', () => {
    installHistorySubscriptions();
    const id = usePropertyStore.getState().property.rooms[0].id;
    usePropertyStore.getState().renameRoom(id, 'Studio');
    useHistoryStore.getState().flush();
    const before = useHistoryStore.getState().past.length;

    beginDrawTransaction();
    abortDrawTransaction();
    expect(useHistoryStore.getState().past.length).toBe(before);
  });

  it('begin -> mutate -> end keeps exactly one new frame', () => {
    installHistorySubscriptions();
    // Flush FIRST: beginDrawTransaction flushes any pending coalesced push,
    // so a frame left over from the beforeEach reset would otherwise land
    // between the baseline and the entry frame and read as a second frame.
    useHistoryStore.getState().flush();
    const before = useHistoryStore.getState().past.length;
    beginDrawTransaction();
    const id = usePropertyStore.getState().property.rooms[0].id;
    usePropertyStore.getState().renameRoom(id, 'Committed');
    endDrawTransaction();
    expect(useHistoryStore.getState().past.length).toBe(before + 1);
  });

  it('abort after end is a harmless no-op', () => {
    installHistorySubscriptions();
    beginDrawTransaction();
    endDrawTransaction();
    const after = useHistoryStore.getState().past.length;
    abortDrawTransaction();
    expect(useHistoryStore.getState().past.length).toBe(after);
  });

  it('a REAL frame recorded after the entry frame is never eaten by abort', () => {
    // Guards the reason abort pops by identity rather than off the end.
    installHistorySubscriptions();
    beginDrawTransaction();
    const entryDepth = useHistoryStore.getState().past.length;

    // Simulate a frame sneaking in during the transaction (which is exactly
    // what defect 1 used to allow).
    useHistoryStore.getState().recordSnapshot('sneaky');
    useHistoryStore.getState().flush();
    const withSneak = useHistoryStore.getState().past.length;

    expect(withSneak).toBe(entryDepth + 1);

    abortDrawTransaction();
    // EXACTLY one frame removed - the transaction's own. The blind
    // `past.slice(0, -1)` would have taken the sneaky frame instead and left
    // the entry frame stranded in the history forever.
    expect(useHistoryStore.getState().past).toHaveLength(withSneak - 1);
    expect(isDrawTransactionActive()).toBe(false);
  });
});
