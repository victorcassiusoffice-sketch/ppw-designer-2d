import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { normaliseRenderQuality, type RenderQualityChoice } from '../designer/renderQuality';

export const RENDER_QUALITY_STORAGE_KEY = 'olb-render-quality-v1';
export const useRenderQualityStore = create<{
  choice: RenderQualityChoice;
  setChoice: (choice: RenderQualityChoice) => void;
}>()(persist(set => ({
  choice: 'auto',
  setChoice: choice => set({ choice: normaliseRenderQuality(choice) }),
}), {
  name: RENDER_QUALITY_STORAGE_KEY,
  partialize: state => ({ choice: state.choice }),
  merge: (persisted, current) => ({ ...current,
    choice: normaliseRenderQuality((persisted as { choice?: unknown } | undefined)?.choice) }),
}));
