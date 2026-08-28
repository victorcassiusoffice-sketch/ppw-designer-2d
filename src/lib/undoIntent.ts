/**
 * undoIntent — ONE definition of what "undo" means, for every control.
 *
 * Vic 2026-08-28: "during mid drawing a line, the undo button doesn't work
 * properly either."
 *
 * He was right, and the cause was that undo had two different implementations:
 *
 *   - KEYBOARD: `RoomDrawMode` intercepts Ctrl+Z while vertices are in flight
 *     and pops the last one (correct, Sims-like), and `useKeyboardShortcuts`
 *     additionally no-ops undo while a draw transaction is open.
 *   - BUTTON: `TopBar` called `useHistoryStore.undo()` directly, with no
 *     draw-transaction awareness at all.
 *
 * Same gesture, two behaviours, depending on which control you reached for.
 * This module is the single answer both now route through.
 *
 * THE LADDER (most specific first — the innermost in-flight thing wins, which
 * is what every drawing tool does):
 *
 *   1. Room draw with vertices down .... remove the last vertex
 *   2. Wall draw mid-segment ........... cancel the in-flight segment
 *   3. Draw mode, nothing in flight .... do nothing (there is no user-visible
 *                                        action to undo, and reaching the
 *                                        global history here would pop the
 *                                        transaction's own bookkeeping frame)
 *   4. Otherwise ....................... normal history undo
 */

import { useHistoryStore, isDrawTransactionActive } from '../store/historyStore';
import { useDrawProgressStore } from '../store/drawProgressStore';
import { useWallStore } from '../store/wallStore';

/** What `performUndo` actually did — useful for tests and for tooltips. */
export type UndoOutcome = 'vertex' | 'wall-segment' | 'none' | 'history';

export function performUndo(): UndoOutcome {
  // 1 — a room polygon being drawn: step back one vertex.
  const draw = useDrawProgressStore.getState();
  if (draw.enabled && draw.vertices.length > 0) {
    draw.setVertices(draw.vertices.slice(0, -1));
    return 'vertex';
  }

  // 2 — a wall segment anchored but not yet dropped: abandon that segment,
  // staying in the wall tool so the user can carry straight on.
  const wall = useWallStore.getState();
  if (wall.draw.phase === 'drawing') {
    wall.setDraw({ phase: 'armed' });
    return 'wall-segment';
  }

  // 3 — inside a draw transaction with nothing in flight.
  if (isDrawTransactionActive()) return 'none';

  // 4 — ordinary undo.
  useHistoryStore.getState().undo();
  return 'history';
}

export function performRedo(): boolean {
  // Redo has no in-flight equivalent: there is no "un-removed vertex" to put
  // back, so it is simply unavailable until the draw closes.
  if (isDrawTransactionActive()) return false;
  useHistoryStore.getState().redo();
  return true;
}

/**
 * Whether an undo would currently do something, for enabling the button.
 * Mirrors the ladder exactly so the control can never look dead while it
 * would in fact work (or look live while it would no-op).
 */
export function canUndo(): boolean {
  const draw = useDrawProgressStore.getState();
  if (draw.enabled && draw.vertices.length > 0) return true;
  if (useWallStore.getState().draw.phase === 'drawing') return true;
  if (isDrawTransactionActive()) return false;
  return useHistoryStore.getState().past.length > 0;
}
