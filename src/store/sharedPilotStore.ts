import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  SharedSpecRecordSchema,
  SharedSpecOperationSchema,
  applySharedSpecOperation,
  SHARED_SPEC_ROLES,
  type SharedSpecRole,
  type SharedSpecRecord,
  type SharedSpecOperation,
  type SharedSpecChange,
} from '../designer/sharedSpecsContract';
import { specFingerprint } from '../designer/sharedBuildAdapter';

export interface PilotRecord {
  record: SharedSpecRecord;
  history: SharedSpecChange[];
}
export const LOCAL_PILOT_ACTOR = 'user_localowner';
export const pilotActor = (role: SharedSpecRole) => `user_local${role}`;
export function newPilot(buildId: string, name: string): PilotRecord {
  return {
    record: {
      project: {
        id: crypto.randomUUID(),
        name: name.slice(0, 180) || 'Sustainable pilot',
        sourceBuildId: buildId,
        components: [],
        members: SHARED_SPEC_ROLES.map((role) => ({
          userId: pilotActor(role),
          role,
          active: true,
        })),
        specRevision: 0,
        pilotReviews: [],
      },
      role: 'owner',
      revision: 1,
      updatedAt: new Date().toISOString(),
    },
    history: [],
  };
}
/** Local rehearsal only. Server memberships, not this reducer, authorize shared work. */
export function applyPilotOperation(
  current: PilotRecord,
  value: SharedSpecOperation,
  expectedRevision: number,
  role: SharedSpecRole = 'owner',
): PilotRecord {
  const operation = SharedSpecOperationSchema.parse(value);
  if (current.record.revision !== expectedRevision)
    throw new Error('This pilot changed. Reload the current component before saving.');
  const project = applySharedSpecOperation(
    current.record.project,
    operation,
    pilotActor(role),
    new Date().toISOString(),
  );
  const changed =
    specFingerprint(project.components) !== specFingerprint(current.record.project.components);
  if (!changed && operation.type === 'sync-components') return current;
  const revision = current.record.revision + 1,
    updatedAt = new Date().toISOString();
  const record = SharedSpecRecordSchema.parse({ project, revision, updatedAt, role: 'owner' });
  return {
    record,
    history: [
      {
        revision,
        changedAt: updatedAt,
        actorUserId: pilotActor(role),
        operation: operation.type,
        ...(operation.type === 'patch-component' ? { componentId: operation.componentId } : {}),
      },
      ...current.history,
    ].slice(0, 150),
  };
}
interface State {
  pilots: Record<string, PilotRecord>;
  ensure: (buildId: string, name: string) => void;
  apply: (
    buildId: string,
    operation: SharedSpecOperation,
    expectedRevision: number,
    role?: SharedSpecRole,
  ) => void;
}
export const useSharedPilotStore = create<State>()(
  persist(
    (set, get) => ({
      pilots: {},
      ensure: (id, name) => {
        if (!get().pilots[id]) set((s) => ({ pilots: { ...s.pilots, [id]: newPilot(id, name) } }));
      },
      apply: (id, operation, revision, role) => {
        const current = get().pilots[id];
        if (!current) throw new Error('Open the pilot first.');
        set((s) => ({
          pilots: { ...s.pilots, [id]: applyPilotOperation(current, operation, revision, role) },
        }));
      },
    }),
    {
      name: 'olb-shared-pilot-v1',
      partialize: (s) => ({ pilots: s.pilots }),
      merge: (saved, current) => {
        const pilots: Record<string, PilotRecord> = {};
        const input = (saved as { pilots?: Record<string, unknown> } | undefined)?.pilots;
        if (input && typeof input === 'object')
          for (const [id, value] of Object.entries(input).slice(0, 30)) {
            const raw = value as PilotRecord,
              parsed = SharedSpecRecordSchema.safeParse(raw?.record);
            if (parsed.success && parsed.data.project.sourceBuildId === id)
              pilots[id] = {
                record: parsed.data,
                history: Array.isArray(raw.history)
                  ? raw.history
                      .filter(
                        (h) =>
                          h &&
                          Number.isInteger(h.revision) &&
                          h.revision > 0 &&
                          typeof h.actorUserId === 'string' &&
                          typeof h.operation === 'string' &&
                          typeof h.changedAt === 'string' &&
                          Number.isFinite(Date.parse(h.changedAt)) &&
                          (h.componentId === undefined || typeof h.componentId === 'string'),
                      )
                      .slice(0, 150)
                  : [],
              };
          }
        return { ...current, pilots };
      },
    },
  ),
);
