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
import {
  DEFAULT_DOOR_WIDTH_M,
  DEFAULT_WINDOW_WIDTH_M,
  type OpeningKind,
} from '../designer/openings';

export type SnapPrecision = 'cm1' | 'cm10' | 'quarter' | 'full' | 'm1' | 'm10';
export type BuildTool =
  | 'hand'
  | 'eyedropper'
  | 'sledgehammer'
  | 'door'
  | 'measure'
  | 'floor'
  | 'wallpaint';

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
  /**
   * The material on the tool. PERSISTED (Floor tool 2026-08-30): the last
   * material you laid is a preference, exactly like the snap unit — coming
   * back to the plan and finding the tool reset to the first row is the
   * kind of thing that makes a floor feel "confusing".
   */
  materialId: string;
  /** 'tile' lays what you touch; 'room' fills the whole polygon. Transient. */
  scope: 'tile' | 'room';
  /** Transient — an Erase that survived a reload would silently eat floors. */
  erase: boolean;
}

export interface WallPaintDraft {
  /** WALL_PAINTS id on the brush. */
  paintId: string;
  /** 'wall' paints the wall you tap; 'room' paints every wall of that room. */
  scope: 'wall' | 'room';
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
  wallPaintDraft: WallPaintDraft;
  setWallPaintDraft: (patch: Partial<WallPaintDraft>) => void;
  /**
   * Tiles the Floor tool's live preview would lay on release (0 when there
   * is no preview). Published by RoomCanvas so the docked panel / phone HUD
   * can show "+n tiles" before the click, without subscribing to the canvas.
   */
  floorPreviewCount: number;
  /**
   * Energy readout (eco / solar 2026-09-04): the docked Energy panel (md+).
   * Per-session chrome, never persisted; opening a build tool closes it and
   * opening it puts the tool away, so it never shares the right edge with
   * the Floor / Wall paint panels.
   */
  energyPanelOpen: boolean;
  setEnergyPanelOpen: (open: boolean) => void;
  /**
   * Wall selection (Vic 2026-09-05: "when I pressed select tool i could not
   * select the walls to delete"). The free wall the Select tool has picked,
   * or null. Transient chrome — never persisted, cleared whenever the tool
   * changes, so a reload never opens with a phantom selection.
   */
  selectedWallId: string | null;
  selectWall: (id: string | null) => void;

  setInfoOpen: (open: boolean) => void;
  /** Swap precision ↔ lastPrecision (Ctrl+F). */
  togglePrecision: () => void;
  setPrecision: (p: SnapPrecision) => void;
  setTool: (t: BuildTool) => void;
  setDoorDraft: (patch: Partial<DoorDraft>) => void;
  setFloorDraft: (patch: Partial<FloorDraft>) => void;
  setFloorPreviewCount: (n: number) => void;
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
      wallPaintDraft: {
        paintId: 'permoglaze-matt-emulsion',
        scope: 'wall',
        erase: false,
      },
      energyPanelOpen: false,
      setEnergyPanelOpen: (open) =>
        set((s) => (open ? { energyPanelOpen: true, tool: 'hand' } : s.energyPanelOpen ? { energyPanelOpen: false } : s)),
      selectedWallId: null,
      selectWall: (id) => set((s) => (s.selectedWallId === id ? s : { selectedWallId: id })),
      floorPreviewCount: 0,

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
      // Arming the door tool starts the arm from the KIND's default width
      // (doors brief 2026-08-31, defect 8): "custom width" is scoped to one
      // arm of the tool, so a width typed last session cannot silently make
      // every new window 0.9 m.
      setTool: (tool) =>
        set((s) =>
          tool === 'door' && s.tool !== 'door'
            ? {
                tool,
                // A build tool takes the right edge; the Energy panel yields.
                energyPanelOpen: false,
                // ...and a picked wall belongs to the Select tool only.
                selectedWallId: null,
                doorDraft: {
                  ...s.doorDraft,
                  widthM:
                    s.doorDraft.kind === 'window'
                      ? DEFAULT_WINDOW_WIDTH_M
                      : DEFAULT_DOOR_WIDTH_M,
                },
              }
            : {
              tool,
              energyPanelOpen: tool === 'hand' ? s.energyPanelOpen : false,
              // A different tool means the picked wall is no longer picked.
              selectedWallId: tool === 'hand' ? s.selectedWallId : null,
            },
        ),
      // Kind switch carries the KIND's default width with it (defect 8: the
      // Window chip used to keep the 0.838 door width) — unless the user has
      // typed a custom width this arm. "Custom" = any width that is not one
      // of the two defaults; an explicit `widthM` in the same patch always
      // wins. Lives HERE so the md+ sub-bar chips and the phone HUD chips
      // (which both call setDoorDraft) can never disagree.
      setDoorDraft: (patch) =>
        set((s) => {
          const next = { ...s.doorDraft, ...patch };
          if (
            patch.kind !== undefined
            && patch.kind !== s.doorDraft.kind
            && patch.widthM === undefined
            && (s.doorDraft.widthM === DEFAULT_DOOR_WIDTH_M
              || s.doorDraft.widthM === DEFAULT_WINDOW_WIDTH_M)
          ) {
            next.widthM =
              patch.kind === 'window' ? DEFAULT_WINDOW_WIDTH_M : DEFAULT_DOOR_WIDTH_M;
          }
          return { doorDraft: next };
        }),
      setFloorDraft: (patch) => set((s) => ({ floorDraft: { ...s.floorDraft, ...patch } })),
      setWallPaintDraft: (patch) => set((s) => ({ wallPaintDraft: { ...s.wallPaintDraft, ...patch } })),
      setFloorPreviewCount: (n) =>
        set((s) => (s.floorPreviewCount === n ? s : { floorPreviewCount: n })),
      toggleDoorFacing: () =>
        set((s) => ({ doorDraft: { ...s.doorDraft, flipFacing: !s.doorDraft.flipFacing } })),
      toggleDoorHand: () =>
        set((s) => ({ doorDraft: { ...s.doorDraft, flipHand: !s.doorDraft.flipHand } })),
      resetTransient: () => set({ infoOpen: false, tool: 'hand', selectedWallId: null }),
    }),
    {
      name: DESIGNER_UI_KEY,
      storage: createJSONStorage(() => localStorage),
      version: 1,
      // Units + the Floor tool's material. `tool`, `infoOpen`, `doorDraft`
      // and the floor SCOPE / ERASE flags are per-session chrome and must
      // NOT survive a reload.
      partialize: (state) => ({
        precision: state.precision,
        lastPrecision: state.lastPrecision,
        floorDraft: { materialId: state.floorDraft.materialId },
        wallPaintDraft: { paintId: state.wallPaintDraft.paintId },
      }),
      // The persisted `floorDraft` is a PARTIAL object. zustand's default
      // merge is shallow, so without this the rehydrated draft would be
      // `{ materialId }` alone — scope and erase undefined, and the first
      // stroke after a reload would throw on `.scope`.
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<DesignerUIState> & {
          floorDraft?: Partial<FloorDraft>;
        };
        return {
          ...current,
          ...p,
          floorDraft: { ...current.floorDraft, ...(p.floorDraft ?? {}) },
          wallPaintDraft: { ...current.wallPaintDraft, ...(p.wallPaintDraft ?? {}) },
        };
      },
    },
  ),
);

/** Non-React accessor for the current snap step in metres. */
export function currentSnapStepM(): number {
  return PRECISION_STEP_M[useDesignerUIStore.getState().precision];
}

/**
 * Step the snap unit one notch FINER (+1) or COARSER (-1) along
 * SNAP_UNIT_ORDER (Sims world 2026-08-29: "+1" mid-draw). One ladder shared
 * by the keyboard hook, the draw-HUD stepper and the mobile strip, so the
 * three can never disagree. Lives here (not in a Konva component) so the
 * keyboard hook stays importable in node tests.
 */
export function stepSnapUnit(direction: 1 | -1): void {
  const ui = useDesignerUIStore.getState();
  const idx = SNAP_UNIT_ORDER.indexOf(ui.precision);
  // SNAP_UNIT_ORDER runs fine → coarse (1 cm first), so finer = lower index.
  const next = SNAP_UNIT_ORDER[idx - direction];
  if (next) ui.setPrecision(next);
}

/** Current snap step in whole millimetres, for the mm-space wall tools. */
export function currentSnapStepMm(): number {
  return Math.round(currentSnapStepM() * 1000);
}
