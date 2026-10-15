import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { ALL_DISCIPLINES, DISCIPLINES, normaliseDisciplineVisibility, type Discipline, type DisciplineVisibility } from '../designer/disciplineVisibility';

type State = {
  visible: DisciplineVisibility;
  setVisible: (key: Discipline, value: boolean) => void;
  only: (key: Discipline) => void;
  showAll: () => void;
};
export const useDisciplineVisibilityStore = create<State>()(persist((set) => ({
  visible: { ...ALL_DISCIPLINES },
  setVisible: (key, value) => set(state => ({ visible: { ...state.visible, [key]: value } })),
  only: key => set({ visible: Object.fromEntries(DISCIPLINES.map(d => [d, d === key])) as DisciplineVisibility }),
  showAll: () => set({ visible: { ...ALL_DISCIPLINES } }),
}), {
  name: 'olb-discipline-visibility-v1',
  partialize: state => ({ visible: state.visible }),
  merge: (persisted, current) => ({ ...current, visible: normaliseDisciplineVisibility((persisted as { visible?: unknown } | undefined)?.visible) }),
}));
