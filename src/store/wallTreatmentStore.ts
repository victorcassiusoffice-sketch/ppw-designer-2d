/**
 * Tweak 03 (Phase C) — wall treatment store (paint + panel).
 *
 * Per `06-Roadmap/sims-parity/master/CODE-RUNNER-DESIGN-TWEAK-1/03-walls-paint-panels.md`:
 *
 *   "Schema: `wall_treatments(wall_id, treatment_kind ENUM('paint','panel'),
 *    merchant_product_id, qty)`."
 *
 * Local-first persistence to `ppw_wall_treatments_v1`. The Neon
 * `wall_treatments` table migration ships in a follow-up tick — the
 * cloud sync layer will lift this map up to the design save endpoint
 * automatically.
 *
 * Keyed by `wall_id` so each segment carries at most one paint AND one
 * panel (the brief implies they stack: a wall can be painted AND have
 * a panel surface). `qty` is implicit for paint (computed via the
 * calculator) and 1 for a panel (a single sheet covers a wall span).
 */

import { create } from 'zustand';

export const WALL_TREATMENTS_LS_KEY = 'ppw_wall_treatments_v1';

export type WallTreatmentKind = 'paint' | 'panel';

export interface WallTreatment {
  wall_id: string;
  kind: WallTreatmentKind;
  /** For 'paint': `EcoPaintColour.id`. For 'panel': merchant product id. */
  product_id: string;
}

export interface WallTreatmentStore {
  /** wallId → kind → treatment. Flat record so lookups stay O(1). */
  treatments: Record<string, Partial<Record<WallTreatmentKind, WallTreatment>>>;
  setTreatment: (treatment: WallTreatment) => void;
  removeTreatment: (wall_id: string, kind: WallTreatmentKind) => void;
  clearTreatments: () => void;
  replace: (next: WallTreatmentStore['treatments']) => void;
}

function readLs(): WallTreatmentStore['treatments'] {
  try {
    if (typeof localStorage === 'undefined') return {};
    const raw = localStorage.getItem(WALL_TREATMENTS_LS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    return parsed as WallTreatmentStore['treatments'];
  } catch {
    return {};
  }
}

function writeLs(treatments: WallTreatmentStore['treatments']): void {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(WALL_TREATMENTS_LS_KEY, JSON.stringify(treatments));
  } catch {
    // ignore
  }
}

const INITIAL_TREATMENTS = readLs();

export const useWallTreatmentStore = create<WallTreatmentStore>((set) => ({
  treatments: INITIAL_TREATMENTS,
  setTreatment: (treatment) => {
    set((s) => {
      const next = {
        ...s.treatments,
        [treatment.wall_id]: {
          ...(s.treatments[treatment.wall_id] ?? {}),
          [treatment.kind]: treatment,
        },
      };
      writeLs(next);
      return { treatments: next };
    });
  },
  removeTreatment: (wall_id, kind) => {
    set((s) => {
      const current = s.treatments[wall_id];
      if (!current || !current[kind]) return s;
      const wallNext = { ...current };
      delete wallNext[kind];
      const next = { ...s.treatments };
      if (Object.keys(wallNext).length === 0) {
        delete next[wall_id];
      } else {
        next[wall_id] = wallNext;
      }
      writeLs(next);
      return { treatments: next };
    });
  },
  clearTreatments: () => {
    writeLs({});
    set({ treatments: {} });
  },
  replace: (next) => {
    writeLs(next);
    set({ treatments: next });
  },
}));
