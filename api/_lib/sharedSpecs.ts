import { createHash } from 'node:crypto';
import { verifyToken } from '@clerk/backend';
import { z } from 'zod';
import {
  applySharedSpecOperation, ClerkUserIdSchema, SharedSpecCreateSchema, SharedSpecOperationError, SharedSpecProjectSchema,
  SharedSpecRecordSchema, SharedSpecWriteSchema, type SharedSpecRecord,
} from '../../src/designer/sharedSpecsContract.js';
import { neonSharedSpecsStore, type SharedSpecsStore, type SharedSpecSaveResult } from '../_db/sharedSpecsStore.js';
import { rejectShowcaseTransaction } from './showcaseSafety.js';

interface Request { method?: string; url?: string; headers?: Record<string, string | string[] | undefined>; query?: Record<string, string | string[] | undefined> }
interface Response { status(code: number): unknown; json(body: unknown): void; setHeader(name: string, value: string): void }
export interface SharedSpecsDependencies { verify(token: string): Promise<{ sub?: string } | null>; store(): SharedSpecsStore; now(): string }
export const MAX_SHARED_SPEC_BODY_BYTES = 800_000;
export const MAX_SHARED_SPEC_DOCUMENT_BYTES = 1_000_000;
function header(req: Request, key: string): string | undefined { const v = req.headers?.[key] ?? req.headers?.[key.toLowerCase()]; return typeof v === 'string' ? v : undefined; }

export function sharedSpecOrigins(env: NodeJS.ProcessEnv = process.env): string[] {
  const configured = (env.DESIGN_ALLOWED_ORIGINS ?? '').split(',').map((v) => v.trim().replace(/\/+$/, '').toLowerCase()).filter((v) => /^https?:\/\/[a-z0-9.-]+(:\d+)?$/.test(v));
  const result = new Set(configured.length ? configured : ['https://designer.ppwellness.co', 'https://onelivebuild.com']);
  for (const host of [env.VERCEL_URL, env.VERCEL_BRANCH_URL]) if (host && /^[a-z0-9.-]+$/i.test(host)) result.add(`https://${host}`);
  if (env.NODE_ENV !== 'production') { result.add('http://localhost:5173'); result.add('http://127.0.0.1:5173'); }
  return [...result];
}
export async function verifySharedSpecSession(token: string): Promise<{ sub?: string } | null> {
  if (!process.env.CLERK_SECRET_KEY?.trim()) throw new Error('AUTH_NOT_CONFIGURED');
  const payload = await verifyToken(token, { secretKey: process.env.CLERK_SECRET_KEY, authorizedParties: sharedSpecOrigins() });
  if (!payload || !ClerkUserIdSchema.safeParse(payload.sub).success) return null;
  return { sub: payload.sub };
}
const defaults: SharedSpecsDependencies = { verify: verifySharedSpecSession, store: neonSharedSpecsStore, now: () => new Date().toISOString() };
function publicRecord(record: SharedSpecRecord): SharedSpecRecord {
  return SharedSpecRecordSchema.parse({ ...record, updatedAt: new Date(record.updatedAt).toISOString() });
}
function sendSave(result: SharedSpecSaveResult, res: Response, created = false): void {
  if (result.code === 'saved' || result.code === 'replayed') { res.status(created && result.code === 'saved' ? 201 : 200); res.json(publicRecord(result.record)); return; }
  if (result.code === 'forbidden') { res.status(404); res.json({ error: 'Shared project not found.', code: 'SHARED_PROJECT_NOT_FOUND' }); return; }
  res.status(409); res.json({ error: result.code === 'request-reused' ? 'This request identifier was already used for different content.' : 'The project changed. Reload before saving your changes.', code: result.code === 'request-reused' ? 'SHARED_REQUEST_REUSED' : 'SHARED_REVISION_CONFLICT', ...('currentRevision' in result && result.currentRevision ? { currentRevision: result.currentRevision } : {}) });
}
function notFound(res: Response) { res.status(404); res.json({ error: 'Shared project not found.', code: 'SHARED_PROJECT_NOT_FOUND' }); }
function invalid(res: Response, message = 'Invalid shared specification. Check identifiers, fields, units and dates.') { res.status(400); res.json({ error: message, code: 'SHARED_INVALID_INPUT' }); }

/** A separate authenticated boundary. Never calls the legacy unauthenticated /api/designs path. */
export async function handleSharedSpecs(segments: string[], req: Request, res: Response, readBody: () => Promise<unknown>, dependencies: SharedSpecsDependencies = defaults): Promise<void> {
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('Vary', 'Authorization');
  const method = req.method ?? 'GET';
  const id = segments[0];
  const collection = segments.length === 0;
  const project = segments.length === 1;
  const changes = segments.length === 2 && segments[1] === 'changes';
  const revision = segments.length === 3 && segments[1] === 'revisions' && /^\d{1,10}$/.test(segments[2]);
  if ((!collection && !z.string().uuid().safeParse(id).success) || (!collection && !project && !changes && !revision)) { invalid(res); return; }
  if (!((method === 'GET' && (collection || project || changes || revision)) || (method === 'POST' && (collection || changes)))) { res.setHeader('Allow', collection || changes ? 'GET, POST, OPTIONS' : 'GET, OPTIONS'); res.status(405); res.json({ error: 'Method not allowed.' }); return; }
  // Preview and demo environments share the production DB. Block before auth/body/DB work.
  if (method === 'POST' && rejectShowcaseTransaction(res)) return;
  const origin = header(req, 'origin');
  if (origin && !sharedSpecOrigins().includes(origin)) { res.status(403); res.json({ error: 'This origin is not allowed.', code: 'SHARED_ORIGIN_DENIED' }); return; }
  const authorization = header(req, 'authorization') ?? header(req, 'Authorization');
  const token = /^Bearer\s+([^\s]+)$/i.exec(authorization ?? '')?.[1];
  if (!token || token.length > 16_384) { res.status(401); res.json({ error: 'Sign in to your project account.', code: 'SHARED_AUTH_REQUIRED' }); return; }
  let actor: string;
  try {
    const claims = await dependencies.verify(token);
    if (!ClerkUserIdSchema.safeParse(claims?.sub).success) throw new Error('INVALID_SESSION');
    actor = claims!.sub!;
  } catch (error) {
    if (error instanceof Error && error.message === 'AUTH_NOT_CONFIGURED') { res.status(503); res.json({ error: 'Shared project authentication is not configured.', code: 'SHARED_AUTH_UNAVAILABLE' }); return; }
    res.status(401); res.json({ error: 'Sign in again to access this project.', code: 'SHARED_AUTH_REQUIRED' }); return;
  }
  try {
    const declaredLength = header(req, 'content-length');
    if (declaredLength && (!/^\d+$/.test(declaredLength) || Number(declaredLength) > MAX_SHARED_SPEC_BODY_BYTES)) { res.status(413); res.json({ error: 'Shared project request is too large.' }); return; }
    const store = dependencies.store();
    if (method === 'GET') {
      if (collection) { const projects = await store.list(actor); res.status(200); res.json({ projects: projects.map((p) => ({ ...p, updatedAt: new Date(p.updatedAt).toISOString() })) }); return; }
      if (changes) {
        const raw = req.query?.after ?? new URL(req.url ?? '/', 'https://local.invalid').searchParams.get('after') ?? '0';
        if (typeof raw !== 'string' || !/^\d{1,10}$/.test(raw) || Number(raw) > 2147483647) { invalid(res, 'Invalid change cursor.'); return; }
        const result = await store.changes(actor, id, Number(raw));
        if (!result) { notFound(res); return; }
        res.status(200); res.json({ ...result, changes: result.changes.map((c) => ({ ...c, changedAt: new Date(c.changedAt).toISOString() })) }); return;
      }
      const revisionNumber = revision ? Number(segments[2]) : 0;
      if (revision && (revisionNumber < 1 || revisionNumber > 2147483647)) { invalid(res); return; }
      const result = revision ? await store.revision(actor, id, revisionNumber) : await store.get(actor, id);
      if (!result) { notFound(res); return; }
      res.status(200); res.json(publicRecord(result)); return;
    }
    const raw = await readBody();
    if (Buffer.byteLength(JSON.stringify(raw) ?? '', 'utf8') > MAX_SHARED_SPEC_BODY_BYTES) { res.status(413); res.json({ error: 'Shared project request is too large.' }); return; }
    if (collection) {
      const parsed = SharedSpecCreateSchema.safeParse(raw);
      if (!parsed.success) { invalid(res); return; }
      const { requestId, projectId, name, sourceBuildId, components } = parsed.data;
      if (components.some((c) => c.assigneeUserId && c.assigneeUserId !== actor)) { invalid(res, 'Invite project members before assigning their components.'); return; }
      const hash = createHash('sha256').update(JSON.stringify(parsed.data)).digest('hex');
      const document = SharedSpecProjectSchema.parse({ id: projectId, name, sourceBuildId, components, members: [{ userId: actor, role: 'owner', active: true }], specRevision: 1, pilotReviews: [] });
      sendSave(await store.compareAndSave({ actor, project: document, expectedRevision: 0, requestId, hash, operation: 'create' }), res, true);
      return;
    }
    const parsed = SharedSpecWriteSchema.safeParse(raw);
    if (!parsed.success) { invalid(res); return; }
    const { requestId, expectedRevision, operation } = parsed.data;
    const current = await store.get(actor, id);
    if (!current) { notFound(res); return; }
    const hash = createHash('sha256').update(JSON.stringify(parsed.data)).digest('hex');
    const retry = await store.retry(actor, id, requestId, hash);
    if (retry) { sendSave(retry, res); return; }
    if (current.revision !== expectedRevision) { sendSave({ code: 'conflict', currentRevision: current.revision }, res); return; }
    const document = applySharedSpecOperation(SharedSpecProjectSchema.parse(current.project), operation, actor, dependencies.now());
    if (Buffer.byteLength(JSON.stringify(document), 'utf8') > MAX_SHARED_SPEC_DOCUMENT_BYTES) { res.status(413); res.json({ error: 'Shared project exceeds its storage limit. Split the project into reviewed work packages.' }); return; }
    sendSave(await store.compareAndSave({ actor, project: document, expectedRevision, requestId, hash, operation: operation.type, componentId: operation.type === 'patch-component' ? operation.componentId : undefined }), res);
  } catch (error) {
    if (error instanceof SharedSpecOperationError) { res.status(error.code === 'forbidden' ? 403 : error.code === 'not-found' ? 404 : 400); res.json({ error: error.message, code: `SHARED_${error.code.toUpperCase().replace('-', '_')}` }); return; }
    if (error instanceof z.ZodError) { invalid(res); return; }
    // Never expose SQL, provider errors, identities, connection URLs or credentials.
    res.status(503); res.json({ error: 'Shared project storage is unavailable. Keep your local draft; cloud storage must be provisioned before collaboration is enabled.', code: 'SHARED_STORAGE_UNAVAILABLE' });
  }
}
