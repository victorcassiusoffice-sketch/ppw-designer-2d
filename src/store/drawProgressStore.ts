/**
 * Batch 3 Fix 3.2 — shared draw-progress state.
 *
 * RoomCanvas owns the live polygon while the user is dropping
 * vertices; RoomList sidebar wants to display vertex / perim / area
 * counters next to the active room. Both surfaces need the same
 * source of truth, so the in-flight vertices live here instead of in
 * RoomCanvas-local React state.
 *
 * Intentionally tiny — no persistence, no history hook-up (the draw
 * progress itself is ephemeral; the COMMITTED room polygon is what
 * history snapshots care about, and that lives in propertyStore).
 */

import { create } from 'zustand';
import type { Polygon } from '../lib/geometry';

export interface DrawProgressState {
  /** Is the user actively in draw mode (mirrors App-level `drawMode`). */
  enabled: boolean;
  /** Live polygon vertices being placed; reset to [] on entry + close + cancel. */
  vertices: Polygon;
  /**
   * "Keep drawing after this one closes" (units brief 2026-08-28, D12).
   *
   * An in-flight INTENT, not design content, which is why it lives in this
   * ephemeral store and not in the property or the history snapshot. It is
   * read and cleared by an App-level effect AFTER the commit, deliberately
   * not inside setDrawMode or handleDrawCommit: two source-pin tests
   * extract those functions by regex and require their dep arrays to stay
   * literally `[]` and to begin with `[addRoom`.
   */
  continueAfterCommit: boolean;
  setEnabled: (next: boolean) => void;
  setVertices: (next: Polygon | ((prev: Polygon) => Polygon)) => void;
  setContinueAfterCommit: (next: boolean) => void;
  reset: () => void;
}

export const useDrawProgressStore = create<DrawProgressState>((set) => ({
  enabled: false,
  vertices: [],
  continueAfterCommit: false,
  setEnabled: (next) => set({ enabled: next }),
  setVertices: (next) =>
    set((s) => ({ vertices: typeof next === 'function' ? next(s.vertices) : next })),
  setContinueAfterCommit: (next) => set({ continueAfterCommit: next }),
  reset: () => set({ enabled: false, vertices: [], continueAfterCommit: false }),
}));
