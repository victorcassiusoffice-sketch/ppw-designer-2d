import { neon } from '@neondatabase/serverless';
import type { SharedSpecChanges, SharedSpecProject, SharedSpecProjectSummary, SharedSpecRecord } from '../../src/designer/sharedSpecsContract.js';

export interface SharedSpecSaveInput {
  actor: string; project: SharedSpecProject; expectedRevision: number; requestId: string; hash: string;
  operation: string; componentId?: string;
}
export type SharedSpecSaveResult = { code: 'saved' | 'replayed'; record: SharedSpecRecord } | { code: 'conflict' | 'forbidden' | 'request-reused'; currentRevision?: number };
export interface SharedSpecsStore {
  list(actor: string): Promise<SharedSpecProjectSummary[]>;
  get(actor: string, id: string): Promise<SharedSpecRecord | null>;
  changes(actor: string, id: string, after: number): Promise<SharedSpecChanges | null>;
  revision(actor: string, id: string, revision: number): Promise<SharedSpecRecord | null>;
  retry(actor: string, id: string, requestId: string, hash: string): Promise<SharedSpecSaveResult | null>;
  compareAndSave(input: SharedSpecSaveInput): Promise<SharedSpecSaveResult>;
}

/** Uses the existing Neon database. The reviewed 0032 migration is deliberately not auto-run. */
export function neonSharedSpecsStore(): SharedSpecsStore {
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.POSTGRES_DATABASE_URL || process.env.POSTGRES_PRISMA_URL;
  if (!url?.trim()) throw new Error('Shared spec storage unavailable');
  const connection = neon(url);
  return createSharedSpecsStore((text, params) => connection(text, params));
}

/** Test seam runs this exact SQL against isolated embedded Postgres, never the live URL. */
export function createSharedSpecsStore(query: (text: string, params: unknown[]) => Promise<Record<string, unknown>[]>): SharedSpecsStore {
  const membership = `EXISTS (SELECT 1 FROM jsonb_array_elements(p.document->'members') m WHERE m->>'userId' = $1 AND m->>'active' = 'true')`;
  const role = `(SELECT m->>'role' FROM jsonb_array_elements(p.document->'members') m WHERE m->>'userId' = $1 AND m->>'active' = 'true' LIMIT 1)`;
  const record = `jsonb_build_object('project', p.document, 'revision', p.revision, 'updatedAt', p.updated_at, 'role', ${role})`;
  return {
    async list(actor) {
      const rows = await query(`SELECT p.id, p.document->>'name' AS name, p.document->>'sourceBuildId' AS "sourceBuildId", p.revision, p.updated_at AS "updatedAt", ${role} AS role FROM olb_shared_projects p WHERE ${membership} ORDER BY p.updated_at DESC LIMIT 100`, [actor]);
      return rows as unknown as SharedSpecProjectSummary[];
    },
    async get(actor, id) {
      const rows = await query(`SELECT ${record} AS record FROM olb_shared_projects p WHERE p.id = $2::uuid AND ${membership}`, [actor, id]);
      return (rows[0]?.record ?? null) as SharedSpecRecord | null;
    },
    async changes(actor, id, after) {
      const rows = await query(`SELECT p.revision AS latest, COALESCE((SELECT jsonb_agg(x.item ORDER BY x.revision) FROM (SELECT h.revision, jsonb_build_object('revision',h.revision,'actorUserId',h.actor_user_id,'changedAt',h.created_at,'operation',h.operation,'componentId',h.component_id) AS item FROM olb_shared_spec_revisions h WHERE h.project_id=p.id AND h.revision > $3 ORDER BY h.revision LIMIT 50) x), '[]'::jsonb) AS changes FROM olb_shared_projects p WHERE p.id=$2::uuid AND ${membership}`, [actor, id, after]);
      if (!rows[0]) return null;
      const changes = rows[0].changes as SharedSpecChanges['changes'];
      const latestRevision = Number(rows[0].latest);
      const nextAfter = changes[changes.length - 1]?.revision ?? after;
      return { changes, latestRevision, nextAfter, hasMore: nextAfter < latestRevision };
    },
    async revision(actor, id, revision) {
      const rows = await query(`SELECT jsonb_build_object('project', h.document, 'revision', h.revision, 'updatedAt', h.created_at, 'role', ${role}) AS record FROM olb_shared_projects p JOIN olb_shared_spec_revisions h ON h.project_id=p.id AND h.revision=$3 WHERE p.id=$2::uuid AND ${membership}`, [actor, id, revision]);
      return (rows[0]?.record ?? null) as SharedSpecRecord | null;
    },
    async retry(actor, id, requestId, hash) {
      // Authorization is evaluated against current membership, never a historic snapshot.
      const rows = await query(`SELECT h.actor_user_id AS actor, h.request_hash AS hash, jsonb_build_object('project',h.document,'revision',h.revision,'updatedAt',h.created_at,'role',${role},'replayed',true,'latestRevision',p.revision) AS record FROM olb_shared_projects p JOIN olb_shared_spec_revisions h ON h.project_id=p.id AND h.request_id=$3::uuid WHERE p.id=$2::uuid AND ${membership}`, [actor, id, requestId]);
      if (!rows[0]) return null;
      if (rows[0].actor !== actor || rows[0].hash !== hash) return { code: 'request-reused' };
      return { code: 'replayed', record: rows[0].record as SharedSpecRecord };
    },
    async compareAndSave(input) {
      // One database function locks the project, rechecks live membership, compares its
      // revision, persists the full immutable revision and updates the current head.
      const rows = await query('SELECT olb_shared_spec_save($1, $2::uuid, $3::integer, $4::uuid, $5, $6::jsonb, $7, $8) AS result', [input.actor, input.project.id, input.expectedRevision, input.requestId, input.hash, JSON.stringify(input.project), input.operation, input.componentId ?? null]);
      return rows[0].result as SharedSpecSaveResult;
    },
  };
}
