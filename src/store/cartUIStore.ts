/**
 * cartUIStore — Zustand store for cart drawer open/close state.
 *
 * Drives Polish B (V4 Driver tick 35):
 *   - MiniCartPill (top-right canvas overlay) toggles `isDrawerOpen`
 *   - CartDrawer (right-edge slide-in) renders when `isDrawerOpen`
 *   - ESC + click-outside both call `close()`
 *
 * Kept separate from cartStore (which derives cart contents from the
 * active Property) so opening/closing the drawer never re-derives the
 * cart or triggers a Konva-side re-render.
 */
import { create } from 'zustand';

interface CartUIState {
  isDrawerOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
}

export const useCartUIStore = create<CartUIState>((set) => ({
  isDrawerOpen: false,
  open: () => set({ isDrawerOpen: true }),
  close: () => set({ isDrawerOpen: false }),
  toggle: () => set((s) => ({ isDrawerOpen: !s.isDrawerOpen })),
}));
