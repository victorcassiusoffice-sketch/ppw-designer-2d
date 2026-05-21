/**
 * Tweak 02 (Phase C) — floor zone store.
 *
 * Per `06-Roadmap/sims-parity/master/CODE-RUNNER-DESIGN-TWEAK-1/02-flooring-system.md`:
 *
 *   "Customer paints flooring zones via click-drag across grid cells —
 *    fills underlay layer (Konva z-index = 0, products always z ≥ 10)."
 *
 *   "Floor zones persist (Neon `placed_floor_zones` table — new
 *    migration)."
 *
 * Local-first persistence to `ppw_floor_zones_v1` in localStorage,
 * mirroring the wallStore pattern. The Neon `placed_floor_zones` table
 * migration is a separate Vic-gated step — once that ships, the
 * propertyStore cloud-save path picks zones up automatically because
 * Property.rooms[].floorZones can be added alongside placedItems.
 *
 * Coordinates in millimetres for consistency with wallStore (every
 * spatial store now shares the same unit).
 */

import { create } from 'zustand';

export const FLOOR_ZONES_LS_KEY = 'ppw_floor_zones_v1';

export interface FloorZonePolygon {
  x_mm: number;
  y_mm: number;
}

export interface FloorZone {
  id: string;
  /** Closed polygon in mm (no repeated end vertex). */
  polygon: FloorZonePolygon[];
  /** Foreign-key to `ECO_FLOORING_CATALOG.id` (paint-palette module). */
  material_id: string;
  /** ISO-8601 timestamp; auto-set on create. */
  created_at: string;
}

export interface FloorZoneStore {
  zones: FloorZone[];
  addZone: (input: Omit<FloorZone, 'id' | 'created_at'> & { id?: string }) => string;
  removeZone: (id: string) => void;
  clearZones: () => void;
  /** Mirror of wallStore.replace — used by tests + ?fresh=1. */
  replace: (next: FloorZone[]) => void;
}

function readLs(): FloorZone[] {
  try {
    if (typeof localStorage === 'undefined') return [];
    const raw = localStorage.getItem(FLOOR_ZONES_LS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isFloorZone);
  } catch {
    return [];
  }
}

function writeLs(zones: FloorZone[]): void {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(FLOOR_ZONES_LS_KEY, JSON.stringify(zones));
  } catch {
    // localStorage quota — degrade silently.
  }
}

function isFloorZone(x: unknown): x is FloorZone {
  if (!x || typeof x !== 'object') return false;
  const z = x as Record<string, unknown>;
  if (typeof z.id !== 'string') return false;
  if (typeof z.material_id !== 'string') return false;
  if (typeof z.created_at !== 'string') return false;
  if (!Array.isArray(z.polygon)) return false;
  return z.polygon.every((v) => {
    if (!v || typeof v !== 'object') return false;
    const p = v as Record<string, unknown>;
    return typeof p.x_mm === 'number' && typeof p.y_mm === 'number';
  });
}

function newZoneId(): string {
  return `fz_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

const INITIAL_ZONES = readLs();

export const useFloorZoneStore = create<FloorZoneStore>((set) => ({
  zones: INITIAL_ZONES,
  addZone: (input) => {
    const zone: FloorZone = {
      id: input.id ?? newZoneId(),
      polygon: input.polygon,
      material_id: input.material_id,
      created_at: new Date().toISOString(),
    };
    set((s) => {
      const next = [...s.zones, zone];
      writeLs(next);
      return { zones: next };
    });
    return zone.id;
  },
  removeZone: (id) => {
    set((s) => {
      const next = s.zones.filter((z) => z.id !== id);
      writeLs(next);
      return { zones: next };
    });
  },
  clearZones: () => {
    writeLs([]);
    set({ zones: [] });
  },
  replace: (next) => {
    writeLs(next);
    set({ zones: next });
  },
}));

