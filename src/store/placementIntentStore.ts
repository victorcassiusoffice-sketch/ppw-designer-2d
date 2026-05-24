/**
 * placementIntentStore — bridge from out-of-canvas UI (the mobile Sims
 * bottom toolbar + product popup, both mounted in the App tree) to the
 * RoomCanvas placement FSM.
 *
 * Why a store and not a prop: RoomCanvas owns the screen→room transform,
 * collision validation, snap-to-grid and the placed-items mutation
 * (`placeProductAt`). The mobile toolbar lives as a sibling of the canvas
 * section, so it can't call `placeProductAt` directly. Rather than lift
 * that whole pipeline into App, the toolbar publishes a one-shot
 * "placement intent" here; RoomCanvas subscribes, consumes it, and runs
 * the exact same validated placement path as a desktop drag. This mirrors
 * the existing `pendingProductId` tap-to-place bridge — additive, no
 * engine change, Konva stable-lock (26c144c) untouched.
 *
 * Two intent shapes:
 *   • { target: 'center' }            — popup "+ Add to room" auto-places
 *                                       at the centre of the visible canvas.
 *   • { target: { clientX, clientY }} — drag-from-thumbnail / drag-from-popup
 *                                       releases at the drop point.
 *
 * `nonce` makes every request distinct so the consuming effect fires even
 * when the same product is placed twice in a row.
 */
import { create } from 'zustand';

export type PlacementTarget = 'center' | { clientX: number; clientY: number };

export interface PlacementIntent {
  productId: string;
  target: PlacementTarget;
  /** Monotonic id so repeated identical placements still trigger the effect. */
  nonce: number;
}

interface PlacementIntentState {
  intent: PlacementIntent | null;
  /** Auto-place at the centre of the visible canvas (popup "+" path). */
  placeAtCenter: (productId: string) => void;
  /** Place at an exact screen coordinate (drag-release path). */
  placeAt: (productId: string, clientX: number, clientY: number) => void;
  /** RoomCanvas calls this once it has handled the current intent. */
  consume: () => void;
}

let nonceSeq = 0;

export const usePlacementIntentStore = create<PlacementIntentState>((set) => ({
  intent: null,
  placeAtCenter: (productId) =>
    set({ intent: { productId, target: 'center', nonce: ++nonceSeq } }),
  placeAt: (productId, clientX, clientY) =>
    set({ intent: { productId, target: { clientX, clientY }, nonce: ++nonceSeq } }),
  consume: () => set({ intent: null }),
}));
