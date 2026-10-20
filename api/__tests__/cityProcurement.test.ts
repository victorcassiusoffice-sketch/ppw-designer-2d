import { beforeEach, describe, expect, it, vi } from 'vitest';
import { handleCityProcurement } from '../_lib/cityProcurement';
import { signMerchantSession } from '../_lib/merchantSession';
import { createCityProcurementPlan, createCityProcurementPackage, type CityProcurementWrite } from '../../src/designer/cityProcurement';
import type { CityProcurementStore, StoredCityProcurement } from '../_db/cityProcurementStore';

function response() {
  const res = { statusCode: 0, body: null as unknown, headers: {} as Record<string, string>, status(code: number) { res.statusCode = code; return res; }, json(body: unknown) { res.body = body; }, setHeader(name: string, value: string) { res.headers[name] = value; } }; return res;
}
function memory() {
  const rows = new Map<string, StoredCityProcurement>();
  const store: CityProcurementStore = {
    merchant: vi.fn(async slug => slug === 'alpha' ? { id: 1, status: 'approved', contactEmail: 'alpha@example.com' } : slug === 'beta' ? { id: 2, status: 'approved', contactEmail: 'beta@example.com' } : null),
    get: vi.fn(async (owner, id) => rows.get(`${owner}:${id}`) ?? null),
    compareAndSave: vi.fn(async input => {
      const key = `${input.merchantId}:${input.plan.id}`; const old = rows.get(key);
      if ((old?.revision ?? 0) !== input.expectedRevision) return null;
      const row = { document: input.plan, revision: input.expectedRevision + 1, lastRequestId: input.requestId, lastRequestHash: input.hash, updatedAt: new Date('2026-10-13T08:00:00Z') };
      rows.set(key, row); return row;
    }),
  }; return { store, rows };
}
function request(method = 'PUT', slug = 'alpha') {
  return { method, headers: { authorization: `Bearer ${signMerchantSession({ slug, email: `${slug}@example.com`, exp: Date.now() + 600_000 }, 'test-secret')}` } };
}
function payload(): CityProcurementWrite { return { expectedRevision: 0, requestId: crypto.randomUUID(), plan: createCityProcurementPlan('city-1', 'City') }; }
beforeEach(() => { vi.stubEnv('MERCHANT_SESSION_SECRET', 'test-secret'); vi.stubEnv('VERCEL_ENV', 'production'); vi.stubEnv('DEMO_ONLY', 'false'); });

describe('merchant-owned City procurement drafts', () => {
  it('blocks showcase writes before reading a body or connecting to storage', async () => {
    for (const env of ['preview', 'production']) {
      vi.stubEnv('VERCEL_ENV', env); vi.stubEnv('DEMO_ONLY', env === 'production' ? 'true' : 'false');
      const factory = vi.fn(); const read = vi.fn(); const res = response();
      await handleCityProcurement('alpha', crypto.randomUUID(), request(), res, read, factory);
      expect(res.statusCode).toBe(403); expect(factory).not.toHaveBeenCalled(); expect(read).not.toHaveBeenCalled();
    }
  });
  it('requires a signed merchant bearer matching the route before opening storage', async () => {
    for (const req of [{ method: 'GET', headers: {} }, request('GET', 'beta'), { method: 'GET', headers: { authorization: 'Bearer fake' } }]) {
      const factory = vi.fn(); const res = response();
      await handleCityProcurement('alpha', crypto.randomUUID(), req, res, vi.fn(), factory);
      expect([401, 403]).toContain(res.statusCode); expect(factory).not.toHaveBeenCalled();
    }
  });
  it('creates a revisioned draft without provider calls and safely retries the same request', async () => {
    const { store } = memory(); const body = payload(); const first = response();
    await handleCityProcurement('alpha', body.plan.id, request(), first, async () => body, () => store);
    expect(first.statusCode).toBe(201); expect(first.body).toMatchObject({ revision: 1, execution: 'manual-review-required' });
    const retry = response(); await handleCityProcurement('alpha', body.plan.id, request(), retry, async () => body, () => store);
    expect(retry.body).toEqual(first.body); expect(store.compareAndSave).toHaveBeenCalledTimes(1);
    expect(first.headers['Cache-Control']).toBe('private, no-store');
  });
  it('rejects stale edits and request-id reuse for changed content', async () => {
    const { store } = memory(); const body = payload();
    await handleCityProcurement('alpha', body.plan.id, request(), response(), async () => body, () => store);
    for (const next of [{ ...body, requestId: crypto.randomUUID() }, { ...body, plan: { ...body.plan, name: 'Different' } }]) {
      const res = response(); await handleCityProcurement('alpha', body.plan.id, request(), res, async () => next, () => store); expect(res.statusCode).toBe(409);
    }
    const update = response(); await handleCityProcurement('alpha', body.plan.id, request(), update, async () => ({ ...body, requestId: crypto.randomUUID(), expectedRevision: 1, plan: { ...body.plan, name: 'Revision two' } }), () => store);
    expect(update.body).toMatchObject({ revision: 2, plan: { name: 'Revision two' } });
  });
  it('never returns another merchant’s document even for the same public id', async () => {
    const { store } = memory(); const body = payload();
    await handleCityProcurement('alpha', body.plan.id, request(), response(), async () => body, () => store);
    const res = response(); await handleCityProcurement('beta', body.plan.id, request('GET', 'beta'), res, vi.fn(), () => store);
    expect(res.statusCode).toBe(404); expect(JSON.stringify(res.body)).not.toContain('city-1');
    expect(store.get).toHaveBeenLastCalledWith(2, body.plan.id);
  });
  it('rechecks current merchant status and contact ownership', async () => {
    for (const merchant of [{ id: 1, status: 'suspended', contactEmail: 'alpha@example.com' }, { id: 1, status: 'approved', contactEmail: 'new@example.com' }]) {
      const { store } = memory(); store.merchant = vi.fn(async () => merchant); const res = response();
      await handleCityProcurement('alpha', crypto.randomUUID(), request('GET'), res, vi.fn(), () => store);
      expect(res.statusCode).toBe(403); expect(store.get).not.toHaveBeenCalled();
    }
  });
  it('rejects invalid dates, unexpected prices and URL/body id mismatch without writing', async () => {
    const { store } = memory(); const body = payload();
    const res = response(); await handleCityProcurement('alpha', crypto.randomUUID(), request(), res, async () => body, () => store);
    expect(res.statusCode).toBe(400); expect(store.compareAndSave).not.toHaveBeenCalled();
    for (const pkg of [
      { ...createCityProcurementPackage('Supplier', 'Water'), orderOn: '2026-02-30' },
      { ...createCityProcurementPackage('Supplier', 'Water'), priceMinor: 100 },
    ]) {
      const invalid = response(); await handleCityProcurement('alpha', body.plan.id, request(), invalid, async () => ({ ...body, plan: { ...body.plan, packages: [pkg] } }), () => store);
      expect(invalid.statusCode).toBe(400);
    }
    expect(store.compareAndSave).not.toHaveBeenCalled();
  });
  it('does not overwrite a concurrent winner or reassign its project', async () => {
    const { store } = memory(); const body = payload(); store.compareAndSave = vi.fn(async () => null);
    const lost = response(); await handleCityProcurement('alpha', body.plan.id, request(), lost, async () => body, () => store);
    expect(lost.statusCode).toBe(409);
    const other = memory(); await handleCityProcurement('alpha', body.plan.id, request(), response(), async () => body, () => other.store);
    const reassigned = response(); await handleCityProcurement('alpha', body.plan.id, request(), reassigned, async () => ({ ...body, expectedRevision: 1, requestId: crypto.randomUUID(), plan: { ...body.plan, projectId: 'other-project' } }), () => other.store);
    expect(reassigned.statusCode).toBe(409); expect(other.store.compareAndSave).toHaveBeenCalledTimes(1);
  });
  it('hides database failures and enforces body and method bounds', async () => {
    const body = payload(); const res = response();
    await handleCityProcurement('alpha', body.plan.id, request(), res, vi.fn(), () => { throw new Error('postgres://secret@host'); });
    expect(res.statusCode).toBe(503); expect(JSON.stringify(res.body)).not.toContain('secret');
    const { store } = memory(); const large = response(); const read = vi.fn();
    await handleCityProcurement('alpha', body.plan.id, { ...request(), headers: { ...request().headers, 'content-length': '999999' } }, large, read, () => store);
    expect(large.statusCode).toBe(413); expect(read).not.toHaveBeenCalled();
    const invalid = response(); await handleCityProcurement('alpha', body.plan.id, request('DELETE'), invalid, read, () => store);
    expect(invalid.statusCode).toBe(405);
  });
});
