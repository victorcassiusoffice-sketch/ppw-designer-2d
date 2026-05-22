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
  setEnabled: (next: boolean) => void;
  setVertices: (next: Polygon | ((prev: Polygon) => Polygon)) => void;
  reset: () => void;
}

export const useDrawProgressStore = create<DrawProgressState>((set) => ({
  enabled: false,
  vertices: [],
  setEnabled: (next) => set({ enabled: next }),
  setVertices: (next) =>
    set((s) => ({ vertices: typeof next === 'function' ? next(s.vertices) : next })),
  reset: () => set({ enabled: false, vertices: [] }),
}));
