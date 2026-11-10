import { create } from 'zustand';
import type { JobStatus, TradeRole, WorkPin } from '../../designer/link/tradeWork';
import type { Photo } from '../../designer/link/vendor/tradefolder/lib/jobPack/types';

/** A pin picker temporarily leaves the dashboard. Keep only the unfinished form
 * in this tab until Save, Cancel, or a project change; this is not the ledger. */
export type JobForm = {
  id: string;
  projectId: string;
  role: TradeRole;
  parentId?: string;
  existing: boolean;
  title: string;
  note: string;
  status: JobStatus;
  by: string;
  startDate: string;
  dueDate: string;
  pin: WorkPin | null;
  photo: Photo | null;
};
type Flow = {
  role: TradeRole | 'owner';
  projectId: string;
  mode: 'off' | 'pick' | 'map';
  form: JobForm | null;
  pin: WorkPin | null;
  setRole: (role: Flow['role']) => void;
  scope: (id: string) => void;
  setForm: (form: JobForm) => void;
  clearForm: () => void;
  beginPick: (projectId: string, form: JobForm) => void;
  beginMap: (projectId: string) => void;
  finishPick: (pin: WorkPin) => void;
  returnToDashboard: () => void;
};
const openStation = () =>
  window.dispatchEvent(
    new CustomEvent('olb:open-project', { detail: { section: 'buildDashboard' } }),
  );
export const useTradeFlow = create<Flow>((set, get) => ({
  role: 'owner',
  projectId: '',
  mode: 'off',
  form: null,
  pin: null,
  setRole: (role) => set({ role, mode: 'off', form: null, pin: null }),
  scope: (projectId) => {
    if (projectId !== get().projectId)
      set({ projectId, mode: 'off', form: null, pin: null, role: 'owner' });
  },
  setForm: (form) => set({ form, projectId: form.projectId, pin: form.pin }),
  clearForm: () => set({ form: null, pin: null, mode: 'off' }),
  beginPick: (projectId, form) => set({ projectId, form, pin: form.pin, mode: 'pick' }),
  beginMap: (projectId) => set({ projectId, mode: 'map', form: null, pin: null }),
  finishPick: (pin) => {
    const { form, mode } = get();
    if (mode !== 'pick' || !form) return;
    set({ mode: 'off', pin, form: { ...form, pin } });
    openStation();
  },
  returnToDashboard: () => {
    set({ mode: 'off' });
    openStation();
  },
}));
