import { create } from 'zustand';
import type { GardenPlacement } from '../designer/garden';

/** Transient selection only: all landscape geometry remains in propertyStore. */
export const useGardenEditorStore = create<{
  selectedId: string | null;
  panelOpen: boolean;
  placement: GardenPlacement | null;
  select: (id: string | null) => void;
  open: () => void;
  close: () => void;
  place: (intent: GardenPlacement | null) => void;
}>((set) => ({
  selectedId: null,
  panelOpen: false,
  placement: null,
  select: (selectedId) => set({ selectedId }),
  open: () => set({ panelOpen: true, placement: null }),
  close: () => set({ panelOpen: false, placement: null, selectedId: null }),
  place: (placement) => set({ placement }),
}));
