import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { handleSharedSpecs, type SharedSpecsDependencies, verifySharedSpecSession } from '../_lib/sharedSpecs';
import { createSharedSpecsStore, type SharedSpecsStore } from '../_db/sharedSpecsStore';
import { SharedSpecComponentSchema, type SharedSpecCreate, type SharedSpecOperation, type SharedSpecRecord, type SharedSpecWrite } from '../../src/designer/sharedSpecsContract';
import { verifyToken } from '@clerk/backend';

vi.mock('@clerk/backend', () => ({ verifyToken: vi.fn() }));
let database: PGlite;
let store: SharedSpecsStore;
const owner = 'user_owner'; const architect = 'user_architect'; const supplier = 'user_supplier'; const outsider = 'user_outsider';
const fixture = () => SharedSpecComponentSchema.parse({ id: 'wall:ground', sourceKey: 'walls:ground', sourceFingerprint: 'abc', category: 'wall', name: 'Ground walls', material: 'Block', quantity: 12.5, unit: 'm2' });
function response() {
  return { statusCode: 0, body: undefined as unknown, headers: {} as Record<string, string>, status(code: number) { this.statusCode = code; return this; }, json(body: unknown) { this.body = body; }, setHeader(key: string, value: string) { this.headers[key] = value; } };
}
function dependencies(selectedStore = store): SharedSpecsDependencies { return { verify: async (token) => token.startsWith('user_') ? { sub: token } : null, store: () => selectedStore, now: () => '2026-10-16T08:00:00.000Z' }; }
async function call(segments: string[], method = 'GET', actor = owner, body?: unknown, selectedStore = store, after?: string) {
  const res = response();
  await handleSharedSpecs(segments, { method, headers: { authorization: `Bearer ${actor}` }, query: after === undefined ? undefined : { after } }, res, async () => body, dependencies(selectedStore));
  return res;
}
async function create(components = [fixture()]) {
  const body: SharedSpecCreate = { requestId: crypto.randomUUID(), projectId: crypto.randomUUID(), name: 'Pilot build', sourceBuildId: 'local-build-1', components };
  const result = await call([], 'POST', owner, body);
  expect(result.statusCode).toBe(201);
  return { body, record: result.body as SharedSpecRecord };
}
async function write(record: SharedSpecRecord, operation: SharedSpecOperation, actor = owner, requestId = crypto.randomUUID()) {
  const body: SharedSpecWrite = { expectedRevision: record.revision, requestId, operation };
  const result = await call([record.project.id, 'changes'], 'POST', actor, body);
  return { result, body, record: result.body as SharedSpecRecord };
}
async function member(record: SharedSpecRecord, userId: string, role: 'architect' | 'supplier' | 'contractor' | 'client' | 'engineer', active = true) {
  const result = await write(record, { type: 'set-member', userId, role, active });
  expect(result.result.statusCode).toBe(200); return result.record;
}
beforeAll(async () => {
  database = new PGlite();
  await database.exec(readFileSync(new URL('../_db/migrations/0032_shared_project_specs.sql', import.meta.url), 'utf8'));
  store = createSharedSpecsStore(async (text, params) => (await database.query<Record<string, unknown>>(text, params)).rows);
}, 60_000);
afterAll(async () => { await database?.close(); vi.unstubAllEnvs(); });
beforeEach(() => { vi.stubEnv('VERCEL_ENV', 'production'); vi.stubEnv('DEMO_ONLY', 'false'); });

describe('isolated Postgres shared specs API', () => {
  it('creates a server-owned project and immutable revision, then lists only its member', async () => {
    const { record } = await create();
    expect(record).toMatchObject({ revision: 1, role: 'owner', project: { specRevision: 1, members: [{ userId: owner, role: 'owner', active: true }] } });
    const listed = await call([]); expect(listed.statusCode).toBe(200);
    expect((listed.body as { projects: { id: string }[] }).projects.some((p) => p.id === record.project.id)).toBe(true);
    expect(await store.list(outsider)).toEqual([]);
    const revision = await call([record.project.id, 'revisions', '1']); expect(revision.body).toMatchObject({ revision: 1, project: { id: record.project.id } });
    expect(revision.headers['Cache-Control']).toBe('private, no-store');
  });
  it('does not expose project, history, polling or retry data to another project/user', async () => {
    const { record } = await create();
    for (const route of [[record.project.id], [record.project.id, 'changes'], [record.project.id, 'revisions', '1']]) {
      const result = await call(route, 'GET', outsider); expect(result.statusCode).toBe(404); expect(JSON.stringify(result.body)).not.toContain('Ground walls');
    }
    expect(await store.retry(outsider, record.project.id, crypto.randomUUID(), 'x')).toBeNull();
  });
  it('enforces owner-only membership administration and keeps the owner permanent', async () => {
    let { record } = await create(); record = await member(record, architect, 'architect');
    const attempt = await write(record, { type: 'set-member', userId: supplier, role: 'supplier', active: true }, architect);
    expect(attempt.result.statusCode).toBe(403);
    const removeOwner = await write(record, { type: 'set-member', userId: owner, role: 'client', active: false });
    expect(removeOwner.result.statusCode).toBe(403);
    expect((await store.get(owner, record.project.id))?.revision).toBe(record.revision);
  });
  it('allows suppliers to update assigned commercial fields but never quantity, analysis or other assignments', async () => {
    let { record } = await create([fixture(), { ...fixture(), id: 'wall:upper', sourceKey: 'walls:upper' }]);
    record = await member(record, supplier, 'supplier');
    record = (await write(record, { type: 'patch-component', componentId: 'wall:ground', patch: { assigneeUserId: supplier } })).record;
    for (const operation of [
      { type: 'patch-component', componentId: 'wall:ground', patch: { quantity: 8 } },
      { type: 'patch-component', componentId: 'wall:upper', patch: { notes: 'Mine' } },
      { type: 'patch-component', componentId: 'wall:ground', patch: { analysis: { relativeHumidityPct: 80 } } },
      { type: 'sync-components', components: [] },
    ] as SharedSpecOperation[]) expect((await write(record, operation, supplier)).result.statusCode).toBe(403);
    const update = await write(record, { type: 'patch-component', componentId: 'wall:ground', patch: { material: 'Declared supplier block', deliveryDate: '2026-11-10', cost: { amount: 20, currency: 'MUR', basis: 'per-unit' } } }, supplier);
    expect(update.result.statusCode).toBe(200); expect(update.record.project.components[0]).toMatchObject({ quantity: 12.5, material: 'Declared supplier block' });
  });
  it('rejects revoked membership on all endpoints and rechecks membership atomically after the API read', async () => {
    let { record } = await create(); record = await member(record, supplier, 'supplier');
    record = (await write(record, { type: 'patch-component', componentId: 'wall:ground', patch: { assigneeUserId: supplier } })).record;
    const before = record;
    const racing: SharedSpecsStore = { ...store, compareAndSave: async (input) => { await member(before, supplier, 'supplier', false); return store.compareAndSave(input); } };
    const result = await call([record.project.id, 'changes'], 'POST', supplier, { expectedRevision: record.revision, requestId: crypto.randomUUID(), operation: { type: 'patch-component', componentId: 'wall:ground', patch: { notes: 'After revoke' } } }, racing);
    expect(result.statusCode).toBe(404);
    for (const route of [[record.project.id], [record.project.id, 'changes'], [record.project.id, 'revisions', '1']]) expect((await call(route, 'GET', supplier)).statusCode).toBe(404);
    expect((await store.get(owner, record.project.id))?.project.components[0].notes).toBe('');
  });
  it('atomically chooses one of two concurrent writers and retains exactly one next revision', async () => {
    const { record } = await create();
    const results = await Promise.all(['First', 'Second'].map((notes) => write(record, { type: 'patch-component', componentId: 'wall:ground', patch: { notes } })));
    expect(results.map((r) => r.result.statusCode).sort()).toEqual([200, 409]);
    expect((await store.get(owner, record.project.id))?.revision).toBe(2);
    const changes = await store.changes(owner, record.project.id, 0); expect(changes?.changes.map((c) => c.revision)).toEqual([1, 2]);
  });
  it('replays an old lost-response request after later edits without overwriting or losing history', async () => {
    const { record } = await create();
    const first = await write(record, { type: 'patch-component', componentId: 'wall:ground', patch: { notes: 'First' } });
    const second = await write(first.record, { type: 'patch-component', componentId: 'wall:ground', patch: { notes: 'Second' } });
    const retry = await call([record.project.id, 'changes'], 'POST', owner, first.body);
    expect(retry.statusCode).toBe(200); expect(retry.body).toMatchObject({ revision: 2, replayed: true, latestRevision: 3 });
    expect((await store.get(owner, record.project.id))?.project.components[0].notes).toBe('Second');
    const reused = await call([record.project.id, 'changes'], 'POST', owner, { ...first.body, expectedRevision: second.record.revision, operation: { type: 'patch-component', componentId: 'wall:ground', patch: { notes: 'Altered retry' } } });
    expect(reused.statusCode).toBe(409); expect(reused.body).toMatchObject({ code: 'SHARED_REQUEST_REUSED' });
    expect((await call([], 'POST', owner, { ...((await create()).body) })).statusCode).toBe(200);
  });
  it('prevents all revision UPDATE/DELETE attempts and keeps historical content unchanged', async () => {
    const { record } = await create();
    await write(record, { type: 'patch-component', componentId: 'wall:ground', patch: { notes: 'New note' } });
    for (const sql of ['UPDATE olb_shared_spec_revisions SET operation=\'forged\' WHERE project_id=$1', 'DELETE FROM olb_shared_spec_revisions WHERE project_id=$1']) await expect(database.query(sql, [record.project.id])).rejects.toThrow(/immutable/);
    expect((await store.revision(owner, record.project.id, 1))?.project.components[0].notes).toBe('');
  });
  it('applies field authorization again inside the SQL write boundary', async () => {
    let { record } = await create(); record = await member(record, supplier, 'supplier');
    record = (await write(record, { type: 'patch-component', componentId: 'wall:ground', patch: { assigneeUserId: supplier } })).record;
    const project = structuredClone(record.project); project.components[0].quantity = 999; project.specRevision++;
    expect(await store.compareAndSave({ actor: supplier, project, expectedRevision: record.revision, requestId: crypto.randomUUID(), hash: 'a'.repeat(64), operation: 'patch-component', componentId: 'wall:ground' })).toMatchObject({ code: 'forbidden' });
    expect((await store.get(owner, record.project.id))?.project.components[0].quantity).toBe(12.5);
  });
  it('preserves manual metadata during measured sync and marks removed sources without deleting assigned specs', async () => {
    let { record } = await create();
    record = (await write(record, { type: 'patch-component', componentId: 'wall:ground', patch: { material: 'Hemp', notes: 'Supplier agreed', carbon: { factor: 8, unit: 'kgCO2e/unit', boundary: 'A1-A3' }, analysis: { relativeHumidityPct: 80 } } })).record;
    record = (await write(record, { type: 'sync-components', components: [{ ...fixture(), quantity: 20 }] })).record;
    expect(record.project.components[0]).toMatchObject({ quantity: 20, material: 'Hemp', notes: 'Supplier agreed', analysis: { relativeHumidityPct: 80 } });
    record = (await write(record, { type: 'sync-components', components: [] })).record;
    expect(record.project.components).toHaveLength(1); expect(record.project.components[0].sourceRemoved).toBe(true);
    record = (await write(record, { type: 'sync-components', components: [{ ...fixture(), quantity: 3, unit: 'm3' }] })).record;
    expect(record.project.components[0].carbon).toBeUndefined(); expect(record.project.components[0].sourceRemoved).toBe(false);
  });
  it('returns bounded revision metadata and requires a valid cursor', async () => {
    const { record } = await create();
    const changes = await call([record.project.id, 'changes'], 'GET', owner, undefined, store, '0');
    expect(changes.body).toMatchObject({ latestRevision: 1, nextAfter: 1, hasMore: false, changes: [{ revision: 1, operation: 'create' }] });
    expect(JSON.stringify(changes.body)).not.toContain('Ground walls');
    for (const after of ['-1', '1.5', '2147483648', 'bad']) expect((await call([record.project.id, 'changes'], 'GET', owner, undefined, store, after)).statusCode).toBe(400);
  });
  it('does not stale accepted pilot reviews when a measured sync has no changes', async () => {
    const { record } = await create();
    const result = await write(record, { type: 'sync-components', components: [fixture()] });
    expect(result.result.statusCode).toBe(200); expect(result.record.revision).toBe(2);
    expect(result.record.project.specRevision).toBe(record.project.specRevision);
  });
  it('invalidates prior material analysis and carbon on supplier substitution, with explicit engineer replacement allowed', async () => {
    let { record } = await create(); record = await member(record, supplier, 'supplier'); record = await member(record, 'user_engineer', 'engineer');
    record = (await write(record, { type: 'patch-component', componentId: 'wall:ground', patch: { assigneeUserId: supplier, analysis: { airTempC: 28, mouldThresholdPct: 80, thresholdEvidenceUrl: 'https://example.com/old-test' }, carbon: { factor: 4, unit: 'kgCO2e/unit', boundary: 'A1-A3', evidenceUrl: 'https://example.com/old-epd' } } })).record;
    const replaced = await write(record, { type: 'patch-component', componentId: 'wall:ground', patch: { material: 'Supplier replacement block' } }, supplier);
    expect(replaced.result.statusCode).toBe(200); record = replaced.record;
    expect(record.project.components[0].analysis).toBeUndefined(); expect(record.project.components[0].carbon).toBeUndefined();
    const reviewed = await write(record, { type: 'patch-component', componentId: 'wall:ground', patch: { material: 'Reviewed hemp panel', analysis: { airTempC: 27, mouldThresholdPct: 70, thresholdEvidenceUrl: 'https://example.com/new-test' }, carbon: { factor: 2, unit: 'kgCO2e/unit', boundary: 'A1-A3', evidenceUrl: 'https://example.com/new-epd' } } }, 'user_engineer');
    expect(reviewed.result.statusCode).toBe(200); expect(reviewed.record.project.components[0]).toMatchObject({ analysis: { airTempC: 27 }, carbon: { factor: 2 } });
  });
  it('requires separate responsible roles and current acknowledgements for pilot release, without self-certification', async () => {
    let { record } = await create();
    record = await member(record, architect, 'architect'); record = await member(record, 'user_engineer', 'engineer');
    record = await member(record, supplier, 'supplier'); record = await member(record, 'user_contractor', 'contractor'); record = await member(record, 'user_client', 'client');
    const missingMaterials = await write(record, { type: 'review-stage', stageId: 'materials', decision: 'accepted', note: '' }, architect);
    expect(missingMaterials.result.statusCode).toBe(400);
    const missingLogistics = await write(record, { type: 'review-stage', stageId: 'logistics', decision: 'accepted', note: '' }, 'user_contractor');
    expect(missingLogistics.result.statusCode).toBe(400);
    record = (await write(record, { type: 'patch-component', componentId: 'wall:ground', patch: { assigneeUserId: supplier, sources: ['https://example.com/material'], responsibleParty: 'Declared contractor', deliveryDate: '2026-11-10' } })).record;
    const basis = record.project.specRevision;
    const review = (stageId: 'brief' | 'geometry' | 'materials' | 'engineering' | 'supplier' | 'logistics' | 'client' | 'release'): SharedSpecOperation => ({ type: 'review-stage', stageId, decision: 'accepted', note: 'Coordination acknowledgement only.' });
    expect((await write(record, review('engineering'))).result.statusCode).toBe(403);
    expect((await write(record, review('release'))).result.statusCode).toBe(400);
    const forged = structuredClone(record.project); forged.pilotReviews = [{ stageId: 'release', decision: 'accepted', note: 'Skip all teams', actorUserId: owner, reviewedAt: '2026-10-16T08:00:00.000Z', basisRevision: record.project.specRevision }];
    expect(await store.compareAndSave({ actor: owner, project: forged, expectedRevision: record.revision, requestId: crypto.randomUUID(), hash: 'a'.repeat(64), operation: 'review-stage' })).toMatchObject({ code: 'forbidden' });
    for (const [stage, actor] of [['brief', owner], ['geometry', architect], ['materials', architect], ['engineering', 'user_engineer'], ['supplier', supplier], ['logistics', 'user_contractor'], ['client', 'user_client']] as const) {
      const result = await write(record, review(stage), actor); expect(result.result.statusCode).toBe(200); record = result.record;
    }
    expect(record.project.specRevision).toBe(basis);
    const released = await write(record, review('release')); expect(released.result.statusCode).toBe(200); record = released.record;
    expect(record.project.pilotReviews).toHaveLength(8);
    record = (await write(record, { type: 'patch-component', componentId: 'wall:ground', patch: { quantity: 13 } })).record;
    expect(record.project.specRevision).toBe(basis + 1); expect((await write(record, review('release'))).result.statusCode).toBe(400);
  });
  it('rejects unknown, nonfinite, wrong-unit, invalid-date and identity-spoofing input', async () => {
    const { record } = await create();
    for (const patch of [{ quantity: -1 }, { quantity: Infinity }, { quantity: null }, { unit: 'feet' }, { deliveryDate: '2026-02-30' }, { cost: { amount: 12, currency: 'MUR', mystery: 1 } }, { analysis: { surface: { id: 'piezo', name: 'Piezo', kind: 'piezo', areaM2: -5 } } }, { unknown: 'ignored?' }]) {
      expect((await call([record.project.id, 'changes'], 'POST', owner, { expectedRevision: record.revision, requestId: crypto.randomUUID(), operation: { type: 'patch-component', componentId: 'wall:ground', patch } })).statusCode).toBe(400);
    }
    const created = (await create()).body;
    expect((await call([], 'POST', owner, { ...created, userId: outsider })).statusCode).toBe(400);
    expect((await store.get(owner, record.project.id))?.revision).toBe(1);
  });
});

describe('shared specs request boundary', () => {
  it('blocks every preview/demo write before reading the body or opening storage', async () => {
    for (const preview of [true, false]) {
      vi.stubEnv('VERCEL_ENV', preview ? 'preview' : 'production'); vi.stubEnv('DEMO_ONLY', preview ? 'false' : 'true');
      const res = response(); const read = vi.fn(); const deps = { verify: vi.fn(), store: vi.fn(), now: vi.fn() };
      await handleSharedSpecs([], { method: 'POST', headers: {} }, res, read, deps);
      expect(res.statusCode).toBe(403); expect(res.body).toMatchObject({ code: 'SHOWCASE_READ_ONLY' }); expect(read).not.toHaveBeenCalled(); expect(deps.store).not.toHaveBeenCalled(); expect(deps.verify).not.toHaveBeenCalled();
    }
  });
  it('requires a verified Clerk user before opening storage, never a page access code or body user id', async () => {
    for (const authorization of [undefined, 'presentation-code', 'Bearer fake']) {
      const deps = { ...dependencies(), store: vi.fn() }; const res = response();
      await handleSharedSpecs([], { headers: { authorization } }, res, vi.fn(), deps);
      expect(res.statusCode).toBe(401); expect(deps.store).not.toHaveBeenCalled();
    }
  });
  it('verifies the Clerk session signature and configured authorized party origins', async () => {
    vi.stubEnv('CLERK_SECRET_KEY', 'test-private-key'); vi.stubEnv('DESIGN_ALLOWED_ORIGINS', 'https://designer.example');
    vi.mocked(verifyToken).mockResolvedValueOnce({ sub: owner } as never);
    expect(await verifySharedSpecSession('session')).toEqual({ sub: owner });
    expect(verifyToken).toHaveBeenCalledWith('session', expect.objectContaining({ secretKey: 'test-private-key', authorizedParties: expect.arrayContaining(['https://designer.example']) }));
    vi.stubEnv('DESIGN_ALLOWED_ORIGINS', '');
  });
  it('rejects foreign origins, unsupported methods and oversized bodies without writes', async () => {
    const deps = { ...dependencies(), store: vi.fn(() => store) }; const res = response();
    await handleSharedSpecs([], { method: 'GET', headers: { origin: 'https://evil.example', authorization: `Bearer ${owner}` } }, res, vi.fn(), deps);
    expect(res.statusCode).toBe(403); expect(deps.store).not.toHaveBeenCalled();
    expect((await call([], 'DELETE')).statusCode).toBe(405);
    const large = response(); const read = vi.fn();
    await handleSharedSpecs([], { method: 'POST', headers: { authorization: `Bearer ${owner}`, 'content-length': '800001' } }, large, read, deps);
    expect(large.statusCode).toBe(413); expect(read).not.toHaveBeenCalled();
    expect((await call([], 'POST', owner, { data: 'z'.repeat(800001) })).statusCode).toBe(413);
  });
  it('reports missing/unavailable storage without exposing provider credentials', async () => {
    const res = response(); const deps = { ...dependencies(), store: () => { throw new Error('postgres://secret-password@private-host'); } };
    await handleSharedSpecs([], { headers: { authorization: `Bearer ${owner}` } }, res, vi.fn(), deps);
    expect(res.statusCode).toBe(503); expect(res.body).toMatchObject({ code: 'SHARED_STORAGE_UNAVAILABLE' }); expect(JSON.stringify(res.body)).not.toContain('secret-password');
  });
});
