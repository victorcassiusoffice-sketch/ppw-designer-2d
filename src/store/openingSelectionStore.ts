import { create } from 'zustand';

/** Transient selection only. Openings remain canonical children of their wall. */
export const useOpeningSelectionStore = create<{
  selectedId: string | null;
  select: (id: string | null) => void;
}>((set) => ({ selectedId: null, select: (selectedId) => set({ selectedId }) }));
