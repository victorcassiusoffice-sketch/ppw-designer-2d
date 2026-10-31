import { create } from 'zustand';

/** Which sail and fixing point the plan and the workspace are editing. Session only, never saved. */
export const useShadeEditorStore = create<{
  sailId: string | null;
  anchorId: string | null;
  select: (sailId: string | null, anchorId?: string | null) => void;
}>()(set => ({
  sailId: null,
  anchorId: null,
  select: (sailId, anchorId = null) => set({ sailId, anchorId: sailId ? anchorId : null }),
}));
