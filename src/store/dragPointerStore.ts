/**
 * dragPointerStore — the transport seam between a catalog drag gesture and
 * the canvas (units + Sims drag-drop brief 2026-08-28, D-B3).
 *
 * The hook that owns the gesture (`useDragToPlace`) publishes raw client
 * coordinates here; `RoomCanvas` subscribes, converts them with the SAME
 * `screenToRoom` path the ghost and the commit already use, and paints or
 * commits. Because both the ghost and the drop read the same published
 * (x, y), **a drop lands exactly where the ghost was by construction** rather
 * than by two pieces of arithmetic happening to agree.
 *
 * Deliberately NOT wired into history: this is not one of the four stores
 * `installHistorySubscriptions` subscribes to, so dragging costs zero undo
 * frames while the eventual `addItem` still produces exactly one through the
 * existing 250 ms coalescer.
 *
 * `placementIntentStore` is deliberately left alone — its test asserts
 * `intent.target` deep-equals `{clientX, clientY}` exactly, so widening that
 * shape would be a live test break, and its `placeAtCenter` path is a
 * different interaction ("+ Add to room") with different semantics.
 */

import { create } from 'zustand';

export interface DragPointer {
  productId: string;
  clientX: number;
  clientY: number;
}

export interface DragDrop extends DragPointer {
  /** Shift held at release = keep the product in hand and stamp again. */
  shiftKey: boolean;
  /**
   * Strictly increasing, so a consumer effect can fire on every drop even
   * when two consecutive drops share identical coordinates.
   */
  nonce: number;
}

interface DragPointerState {
  drag: DragPointer | null;
  drop: DragDrop | null;
  /** Is the pointer currently over the canvas? Drives which ghost shows. */
  overCanvas: boolean;

  begin: (productId: string, clientX: number, clientY: number) => void;
  move: (productId: string, clientX: number, clientY: number) => void;
  release: (shiftKey: boolean) => void;
  cancel: () => void;
  consumeDrop: () => void;
  setOverCanvas: (next: boolean) => void;
}

let nonceSeq = 0;

export const useDragPointerStore = create<DragPointerState>((set, get) => ({
  drag: null,
  drop: null,
  overCanvas: false,

  begin: (productId, clientX, clientY) =>
    set({ drag: { productId, clientX, clientY }, drop: null }),

  move: (productId, clientX, clientY) => set({ drag: { productId, clientX, clientY } }),

  release: (shiftKey) => {
    const d = get().drag;
    if (!d) return;
    nonceSeq += 1;
    set({ drag: null, drop: { ...d, shiftKey, nonce: nonceSeq } });
  },

  cancel: () => set({ drag: null, drop: null }),

  consumeDrop: () => set({ drop: null }),

  setOverCanvas: (next) => {
    if (get().overCanvas !== next) set({ overCanvas: next });
  },
}));
