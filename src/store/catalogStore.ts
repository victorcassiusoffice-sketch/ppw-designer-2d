/**
 * catalogStore — "the merchant catalog arrived" as something a view can
 * subscribe to (2026-09-17).
 *
 * `/api/products` rows are adapted into a module-level cache that
 * `getProductById` reads; until they land, a saved design's `m-<id>` items
 * resolve to nothing and both the plan and the 3D stage skip them. The
 * fetch lives in component-local state, so nothing re-rendered when the
 * rows arrived — the items only reappeared on the next plan change. The
 * adapter bumps `version` after filling the cache; RoomCanvas and
 * RoomView3D read it, so the moment the catalog is known every placed
 * merchant product is drawn (and wears its 3D body).
 */
import { create } from 'zustand';

interface CatalogState {
  version: number;
  bump: () => void;
}

export const useCatalogStore = create<CatalogState>((set) => ({
  version: 0,
  bump: () => set((s) => ({ version: s.version + 1 })),
}));
