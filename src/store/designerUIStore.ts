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
 *   • precision  — snap resolution, one of the six SNAP_UNIT_ORDER units
 *                  (1 cm → 10 m). Selected by the top-bar unit picker, by
 *                  the digits 1–6, or swapped A/B with Ctrl+F. Default is
 *                  'full' (0.5 m) so V-GAME-3 holds for anyone who never
 *                  touches the picker. Spec: D1/D2 (units brief 2026-08-28),
 *                  originally D15 / M13.
 *   • lastPrecision — the OTHER half of the Ctrl+F pair: the unit you were
 *                  on before the current one, so Ctrl+F flips between coarse
 *                  and whichever fine unit you last picked rather than
 *                  cycling six ways. Persisted alongside `precision`; without
 *                  that, a reload on 'cm1' would swap to the module default.
 *   • tool       — active build tool. 'hand' (default select/move),
 *                  'eyedropper' (copy a placed item's type onto the ghost),
 *                  'sledgehammer' (click placed item = delete). Spec:
 *                  D11/M11, D12, D14.
 *
 * Persistence (D1): this store owns its OWN key, `ppw_designer_ui_v1`, and
 * persists ONLY the two unit fields. The unit is a viewing preference, not
 * design content — putting it in `propertyStore` would make every unit click
 * an undo frame, force a `partialize` edit on the frozen `version: 2` key,
 * and bake a preference into every saved plan and quote payload.
 */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { DEFAULT_DOOR_WIDTH_M, type OpeningKind } from '../designer/openings';

export type SnapPrecision = 'cm1' | 'cm10' | 'quarter' | 'full' | 'm1' | 'm10';
export type BuildTool =
  | 'hand'
  | 'eyedropper'
  | 'sledgehammer'
  | 'door'
  | 'measure'
  | 'floor';

/** localStorage key for the persisted unit preference. */
export const DESIGNER_UI_KEY = 'ppw_designer_ui_v1';

/**
 * Settings the door tool carries between placements (2026-08-28).
 *
 * Transient chrome, not design content — the placed Opening records its own
 * kind/width/flips on the Room, so this is only "what the NEXT door will be".
 * Keeping it out of the history snapshot means flipping the ghost before you
 * click is not an undoable action, which is what users expect.
 */
/**
 * What the NEXT floor stroke will paint (floor-painting brief, D10).
 *
 * Transient chrome, exactly like DoorDraft: the painted tiles live on the
 * Room, so this is only "which material is on the brush". Keeping it out
 * of the history snapshot means switching material is not an undoable
 * action, which is what anyone who has used a paint tool expects.
 */
export interface FloorDraft {
  materialId: string;
  /** 'tile' paints what you touch; 'room' fills the whole polygon. */
  scope: 'tile' | 'room';
  erase: boolean;
}

export interface DoorDraft {
  kind: OpeningKind;
  widthM: number;
  flipFacing: boolean;
  flipHand: boolean;
}

/**
 * Snap step in metres for each precision mode.
 *
 * Every step is an INTEGER number of millimetres (10/100/250/500/1000/10000).
 * That is load-bearing, not cosmetic: `wallStore.detectClosedRoomVertices`
 * matches wall endpoints by exact `${x_mm},${y_mm}` string equality, so a
 * step that produced fractional mm would silently stop closing rooms.
 * `designerUIStore.test.ts` pins the invariant.
 */
export const PRECISION_STEP_M: Record<SnapPrecision, number> = {
  cm1: 0.01,
  cm10: 0.1,
  quarter: 0.25,
  full: 0.5,
  m1: 1,
  m10: 10,
};

/** Coarse-to-fine display order for the picker and the digit shortcuts. */
export const SNAP_UNIT_ORDER: SnapPrecision[] = [
  'cm1',
  'cm10',
  'quarter',
  'full',
  'm1',
  'm10',
];

/**
 * Human labels. EXPLICIT and never derived from the step number — deriving
 * them would render 0.25 as "25 cm" on one screen and "0.25 m" on another.
 */
export const SNAP_UNIT_LABEL: Record<SnapPrecision, string> = {
  cm1: '1 cm',
  cm10: '10 cm',
  quarter: '0.25 m',
  full: '0.5 m',
  m1: '1 m',
  m10: '10 m',
};

interface DesignerUIState {
  infoOpen: boolean;
  precision: SnapPrecision;
  /** The other half of the Ctrl+F A/B pair. */
  lastPrecision: SnapPrecision;
  tool: BuildTool;
  doorDraft: DoorDraft;
  floorDraft: FloorDraft;

  setInfoOpen: (open: boolean) => void;
  /** Swap precision ↔ lastPrecision (Ctrl+F). */
  togglePrecision: () => void;
  setPrecision: (p: SnapPrecision) => void;
  setTool: (t: BuildTool) => void;
  setDoorDraft: (patch: Partial<DoorDraft>) => void;
  setFloorDraft: (patch: Partial<FloorDraft>) => void;
  /** Flip which side of the wall the next door swings toward. */
  toggleDoorFacing: () => void;
  /** Flip which end of the opening the next door hinges on. */
  toggleDoorHand: () => void;
  /** Reset transient tool/info state (e.g. on deselect or Esc). */
  resetTransient: () => void;
}

export const useDesignerUIStore = create<DesignerUIState>()(
  persist(
    (set) => ({
      infoOpen: false,
      precision: 'full',
      lastPrecision: 'quarter',
      tool: 'hand',
      doorDraft: {
        kind: 'door',
        widthM: DEFAULT_DOOR_WIDTH_M,
        flipFacing: false,
        flipHand: false,
      },
      floorDraft: {
        materialId: 'gym-interlock',
        scope: 'tile',
        erase: false,
      },

      setInfoOpen: (open) => set({ infoOpen: open }),
      // A/B swap, not a 6-way cycle: from the default state this is still
      // full → quarter → full, so the two existing shortcut tests hold.
      togglePrecision: () =>
        set((s) => ({ precision: s.lastPrecision, lastPrecision: s.precision })),
      setPrecision: (precision) =>
        set((s) =>
          s.precision === precision
            ? s
            : { precision, lastPrecision: s.precision },
        ),
      setTool: (tool) => set({ tool }),
      setDoorDraft: (patch) => set((s) => ({ doorDraft: { ...s.doorDraft, ...patch } })),
      setFloorDraft: (patch) => set((s) => ({ floorDraft: { ...s.floorDraft, ...patch } })),
      toggleDoorFacing: () =>
        set((s) => ({ doorDraft: { ...s.doorDraft, flipFacing: !s.doorDraft.flipFacing } })),
      toggleDoorHand: () =>
        set((s) => ({ doorDraft: { ...s.doorDraft, flipHand: !s.doorDraft.flipHand } })),
      resetTransient: () => set({ infoOpen: false, tool: 'hand' }),
    }),
    {
      name: DESIGNER_UI_KEY,
      storage: createJSONStorage(() => localStorage),
      version: 1,
      // Units only. `tool`, `infoOpen` and `doorDraft` are per-session chrome
      // and must NOT survive a reload.
      partialize: (state) => ({
        precision: state.precision,
        lastPrecision: state.lastPrecision,
      }),
    },
  ),
);

/** Non-React accessor for the current snap step in metres. */
export function currentSnapStepM(): number {
  return PRECISION_STEP_M[useDesignerUIStore.getState().precision];
}

/** Current snap step in whole millimetres, for the mm-space wall tools. */
export function currentSnapStepMm(): number {
  return Math.round(currentSnapStepM() * 1000);
}
