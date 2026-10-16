import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { ALL_DISCIPLINES, ALL_VISIBILITY_PARTS, DISCIPLINES, normaliseDisciplineVisibility, normalisePartVisibility, visibilityPreset, type Discipline, type DisciplineVisibility, type PartVisibility, type VisibilityPart, type ViewPreset } from '../designer/disciplineVisibility';

type State = {
  visible: DisciplineVisibility;
  parts: PartVisibility;
  setVisible: (key: Discipline, value: boolean) => void;
  setPartVisible: (key: VisibilityPart, value: boolean) => void;
  only: (key: Discipline) => void;
  applyPreset: (id: ViewPreset) => void;
  showAll: () => void;
  showNone: () => void;
};
export const useDisciplineVisibilityStore = create<State>()(persist((set) => ({
  visible: { ...ALL_DISCIPLINES },
  parts: { ...ALL_VISIBILITY_PARTS },
  setVisible: (key, value) => set(state => ({
    visible: { ...state.visible, [key]: value },
    ...(key === 'structure' && value && ![state.parts.walls, state.parts.floors, state.parts.roofs, state.parts.stairs].some(Boolean)
      ? { parts: { ...state.parts, walls: true, floors: true, roofs: true, stairs: true } } : {}),
  })),
  setPartVisible: (key, value) => set(state => ({
    parts: { ...state.parts, [key]: value },
    ...(['walls', 'floors', 'roofs', 'stairs'].includes(key) && value ? { visible: { ...state.visible, structure: true } } : {}),
  })),
  only: key => set({ visible: Object.fromEntries(DISCIPLINES.map(d => [d, d === key])) as DisciplineVisibility, parts: { ...ALL_VISIBILITY_PARTS } }),
  applyPreset: id => set(visibilityPreset(id)),
  showAll: () => set(visibilityPreset('all')),
  showNone: () => set({ visible: Object.fromEntries(DISCIPLINES.map(d => [d, false])) as DisciplineVisibility, parts: { ...ALL_VISIBILITY_PARTS } }),
}), {
  name: 'olb-discipline-visibility-v1',
  partialize: state => ({ visible: state.visible, parts: state.parts }),
  merge: (persisted, current) => {
    const saved = persisted as { visible?: unknown; parts?: unknown } | undefined;
    return { ...current, visible: normaliseDisciplineVisibility(saved?.visible), parts: normalisePartVisibility(saved?.parts) };
  },
}));
