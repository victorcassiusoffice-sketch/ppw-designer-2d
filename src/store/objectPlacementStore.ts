import { create } from 'zustand';

/** Object interaction preference only. Never changes building units or estimates. */
export type ObjectPlacementMode = 'grid' | 'half' | 'free';
interface ObjectPlacementState {
  mode: ObjectPlacementMode;
  setMode: (mode: ObjectPlacementMode) => void;
}
export const useObjectPlacementStore = create<ObjectPlacementState>(set => ({
  mode: 'grid', setMode: mode => set({ mode }),
}));
export function objectPlacementStepM(): number {
  const mode = useObjectPlacementStore.getState().mode;
  return mode === 'grid' ? 0.5 : mode === 'half' ? 0.25 : 0.001;
}
/** Free placement permits object overlap, never off-plot placement or solid-wall penetration. */
export function objectOverlapAllowed(): boolean { return useObjectPlacementStore.getState().mode === 'free'; }
