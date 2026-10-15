import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import {
  ProjectRegisterSchema,
  type ProjectRegister,
  type DepartmentTask,
} from '../designer/projectHub';

interface ProjectHubState {
  registers: Record<string, ProjectRegister>;
  save: (register: ProjectRegister, expectedRevision: number) => boolean;
  upsert: (projectId: string, task: DepartmentTask, expectedRevision: number) => boolean;
}
export const emptyRegister = (projectId: string): ProjectRegister => ({
  version: 1,
  projectId,
  revision: 0,
  tasks: [],
});
/** Local coordination register. No account, cloud permission or delivery state is implied. */
export const useProjectHubStore = create<ProjectHubState>()(
  persist(
    (set, get) => ({
      registers: {},
      save(input, expectedRevision) {
        const register = ProjectRegisterSchema.parse(input);
        const existing = get().registers[register.projectId];
        if (
          (existing?.revision ?? 0) !== expectedRevision ||
          register.revision !== expectedRevision + 1
        )
          return false;
        set((state) => ({ registers: { ...state.registers, [register.projectId]: register } }));
        return true;
      },
      upsert(projectId, task, expectedRevision) {
        const register = get().registers[projectId] ?? emptyRegister(projectId);
        const tasks = register.tasks.some((t) => t.id === task.id)
          ? register.tasks.map((t) => (t.id === task.id ? task : t))
          : [...register.tasks, task];
        return get().save({ ...register, revision: expectedRevision + 1, tasks }, expectedRevision);
      },
    }),
    {
      name: 'olb_project_registers_v1',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ registers: state.registers }),
      merge: (raw, current) => {
        const registers: Record<string, ProjectRegister> = {};
        const candidate = (raw as { registers?: unknown } | null)?.registers;
        if (candidate && typeof candidate === 'object')
          for (const [id, value] of Object.entries(candidate)) {
            const parsed = ProjectRegisterSchema.safeParse(value);
            if (parsed.success && parsed.data.projectId === id) registers[id] = parsed.data;
          }
        return { ...current, registers };
      },
    },
  ),
);
