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
 * Intent shapes:
 *   • { target: 'center' }            — popup "+ Add to room" auto-places
 *                                       at the centre of the visible canvas.
 *   • { target: { clientX, clientY }} — drag-from-thumbnail / drag-from-popup
 *                                       releases at the drop point.
 *   • { target: { roomX, roomY } }    — 3D Mode (2026-09-17): a point on the
 *                                       plan, already resolved by the 3D
 *                                       stage's floor ray. RoomCanvas places
 *                                       it with the same validated path.
 *
 * 3D Mode also moves EXISTING items through here (`moveTo`): the stage
 * publishes the wanted top-left in plan metres and RoomCanvas resolves it
 * with the plan's own drop rules (designer/itemDrop.ts) — one law for a
 * drag on the plan and a drag on the 3D floor.
 *
 * `nonce` makes every request distinct so the consuming effect fires even
 * when the same product is placed twice in a row.
 */
import { create } from 'zustand';
import type { DropResult } from '../designer/itemDrop';

export type MovePreviewResolver = (instanceId: string, roomX: number, roomY: number, shiftKey: boolean) => DropResult | null;
export interface PlacementPreview {
  xM: number; yM: number; rotation: number; valid: boolean; w: number; h: number;
  parentInstanceId?: string;
  mountHeightCm?: number;
}
export type PlacementPreviewResolver = (productId: string, roomX: number, roomY: number) => PlacementPreview | null;

export type PlacementTarget = 'center' | { clientX: number; clientY: number } | { roomX: number; roomY: number };

export interface PlacementIntent {
  productId: string;
  target: PlacementTarget;
  /** Monotonic id so repeated identical placements still trigger the effect. */
  nonce: number;
  /** Exact drops reject blocked spots instead of relocating to another part of the room. */
  strict?: boolean;
  keepArmed?: boolean;
}

export interface MoveIntent {
  instanceId: string;
  /** Wanted TOP-LEFT of the item's axis-aligned footprint, plan metres. */
  roomX: number;
  roomY: number;
  /** Shift held: keep the current facing when snapping to a wall. */
  shiftKey: boolean;
  nonce: number;
}

interface PlacementIntentState {
  intent: PlacementIntent | null;
  /** Auto-place at the centre of the visible canvas (popup "+" path). */
  placeAtCenter: (productId: string) => void;
  /** Place at an exact screen coordinate (drag-release path). */
  placeAt: (productId: string, clientX: number, clientY: number) => void;
  /** Place at a point on the plan, metres (3D Mode's floor ray). */
  placeAtPoint: (productId: string, roomX: number, roomY: number, options?: { strict?: boolean; keepArmed?: boolean }) => void;
  /** RoomCanvas calls this once it has handled the current intent. */
  consume: () => void;
  /**
   * The single product armed for tap-to-place. App passes this to the plan
   * and catalog; 3D reads it directly. Disarming a tool updates every view.
   */
  armedProductId: string | null;
  armedRotation: number;
  armedRotationExplicit: boolean;
  rotateArmed: (deltaDeg: number) => void;
  setArmed: (productId: string | null) => void;
  previewPlacement: PlacementPreviewResolver;
  registerPlacementPreviewResolver: (resolver: PlacementPreviewResolver) => () => void;
  moveIntent: MoveIntent | null;
  moveTo: (instanceId: string, roomX: number, roomY: number, shiftKey?: boolean) => void;
  consumeMove: () => void;
  /** Synchronous, read-only snap and validity result; never publishes an intent. */
  previewMove: (instanceId: string, roomX: number, roomY: number, shiftKey?: boolean) => DropResult | null;
  /** The mounted plan registers its live collision context; cleanup removes only this registration. */
  registerMovePreviewResolver: (resolver: MovePreviewResolver) => () => void;
}

let nonceSeq = 0;
// A callback, not persisted/editor state. Pointermove preview must not notify
// every subscribed UI component or add a new design/history mutation.
let movePreviewResolver: MovePreviewResolver | null = null;
let placementPreviewResolver: PlacementPreviewResolver | null = null;

export const usePlacementIntentStore = create<PlacementIntentState>((set) => ({
  intent: null,
  placeAtCenter: (productId) => set({ intent: { productId, target: 'center', nonce: ++nonceSeq } }),
  placeAt: (productId, clientX, clientY) => set({ intent: { productId, target: { clientX, clientY }, strict: true, nonce: ++nonceSeq } }),
  placeAtPoint: (productId, roomX, roomY, options) => set({ intent: { productId, target: { roomX, roomY }, ...options, nonce: ++nonceSeq } }),
  consume: () => set({ intent: null }),
  armedProductId: null,
  armedRotation: 0,
  armedRotationExplicit: false,
  rotateArmed: deltaDeg => set(s => !s.armedProductId || !Number.isFinite(deltaDeg) ? s : ({ armedRotation: ((s.armedRotation + deltaDeg) % 360 + 360) % 360, armedRotationExplicit: true })),
  setArmed: (productId) => set((s) => (s.armedProductId === productId ? s : { armedProductId: productId, armedRotation: 0, armedRotationExplicit: false })),
  previewPlacement: (productId, x, y) => Number.isFinite(x) && Number.isFinite(y) ? placementPreviewResolver?.(productId, x, y) ?? null : null,
  registerPlacementPreviewResolver: resolver => {
    placementPreviewResolver = resolver;
    return () => { if (placementPreviewResolver === resolver) placementPreviewResolver = null; };
  },
  moveIntent: null,
  moveTo: (instanceId, roomX, roomY, shiftKey = false) => set({ moveIntent: { instanceId, roomX, roomY, shiftKey, nonce: ++nonceSeq } }),
  consumeMove: () => set({ moveIntent: null }),
  previewMove: (instanceId, roomX, roomY, shiftKey = false) =>
    Number.isFinite(roomX) && Number.isFinite(roomY)
      ? movePreviewResolver?.(instanceId, roomX, roomY, shiftKey) ?? null : null,
  registerMovePreviewResolver: (resolver) => {
    movePreviewResolver = resolver;
    return () => { if (movePreviewResolver === resolver) movePreviewResolver = null; };
  },
}));

/** True for a target the 3D stage must resolve first (screen or view-centre based). */
export function isScreenTarget(t: PlacementTarget): t is 'center' | { clientX: number; clientY: number } {
  return t === 'center' || 'clientX' in t;
}
