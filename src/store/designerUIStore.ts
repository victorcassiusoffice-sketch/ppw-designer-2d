/**
 * designerUIStore — small, additive UI-state store for the Sims
 * feature-finish work (PARITY-MATRIX). Holds transient designer chrome
 * state that is NOT design content (so it never enters the undo history
 * snapshot) and is shared across the canvas overlay, the floating cluster,
 * the top bar and the keyboard handler.
 *
 * Additive only — the Konva stable-lock render-core (26c144c) is untouched;
 * this store just toggles flags the overlays read.
 *
 * Fields:
 *   • infoOpen   — mobile "details" sheet. The slide-up DetailsPanel is no
 *                  longer auto-opened on selection (that was the flagship
 *                  "rotation opens a new screen" bug); it now opens only
 *                  when the user taps ⓘ in the on-canvas floating cluster.
 *   • precision  — snap resolution: 'full' (0.5 m) or 'quarter' (0.25 m).
 *                  Toggled by Ctrl+F (desktop) / the top-bar precision
 *                  button (mobile). Spec: D15 / M13.
 *   • tool       — active build tool. 'hand' (default select/move),
 *                  'eyedropper' (copy a placed item's type onto the ghost),
 *                  'sledgehammer' (click placed item = delete). Spec:
 *                  D11/M11, D12, D14.
 */
import { create } from 'zustand';
import { DEFAULT_DOOR_WIDTH_M, type OpeningKind } from '../designer/openings';

export type SnapPrecision = 'full' | 'quarter';
export type BuildTool = 'hand' | 'eyedropper' | 'sledgehammer' | 'door';

/**
 * Settings the door tool carries between placements (2026-08-28).
 *
 * Transient chrome, not design content — the placed Opening records its own
 * kind/width/flips on the Room, so this is only "what the NEXT door will be".
 * Keeping it out of the history snapshot means flipping the ghost before you
 * click is not an undoable action, which is what users expect.
 */
export interface DoorDraft {
  kind: OpeningKind;
  widthM: number;
  flipFacing: boolean;
  flipHand: boolean;
}

/** Snap step in metres for each precision mode. */
export const PRECISION_STEP_M: Record<SnapPrecision, number> = {
  full: 0.5,
  quarter: 0.25,
};

interface DesignerUIState {
  infoOpen: boolean;
  precision: SnapPrecision;
  tool: BuildTool;
  doorDraft: DoorDraft;

  setInfoOpen: (open: boolean) => void;
  togglePrecision: () => void;
  setPrecision: (p: SnapPrecision) => void;
  setTool: (t: BuildTool) => void;
  setDoorDraft: (patch: Partial<DoorDraft>) => void;
  /** Flip which side of the wall the next door swings toward. */
  toggleDoorFacing: () => void;
  /** Flip which end of the opening the next door hinges on. */
  toggleDoorHand: () => void;
  /** Reset transient tool/info state (e.g. on deselect or Esc). */
  resetTransient: () => void;
}

export const useDesignerUIStore = create<DesignerUIState>((set) => ({
  infoOpen: false,
  precision: 'full',
  tool: 'hand',
  doorDraft: {
    kind: 'door',
    widthM: DEFAULT_DOOR_WIDTH_M,
    flipFacing: false,
    flipHand: false,
  },

  setInfoOpen: (open) => set({ infoOpen: open }),
  togglePrecision: () =>
    set((s) => ({ precision: s.precision === 'full' ? 'quarter' : 'full' })),
  setPrecision: (precision) => set({ precision }),
  setTool: (tool) => set({ tool }),
  setDoorDraft: (patch) => set((s) => ({ doorDraft: { ...s.doorDraft, ...patch } })),
  toggleDoorFacing: () =>
    set((s) => ({ doorDraft: { ...s.doorDraft, flipFacing: !s.doorDraft.flipFacing } })),
  toggleDoorHand: () =>
    set((s) => ({ doorDraft: { ...s.doorDraft, flipHand: !s.doorDraft.flipHand } })),
  resetTransient: () => set({ infoOpen: false, tool: 'hand' }),
}));

/** Non-React accessor for the current snap step in metres. */
export function currentSnapStepM(): number {
  return PRECISION_STEP_M[useDesignerUIStore.getState().precision];
}
