import { beforeEach, describe, expect, it, vi } from 'vitest';
const guarded = vi.hoisted(() => ({ assert: vi.fn() }));
vi.mock('../showcaseSafety', () => ({ assertShowcaseWritable: guarded.assert }));
import { loadCityProcurement, saveCityProcurement } from '../cityProcurementClient';
import { createCityProcurementPlan } from '../../designer/cityProcurement';

beforeEach(() => { vi.clearAllMocks(); guarded.assert.mockReset(); });
describe('City procurement client', () => {
  it('uses explicit bearer authentication and preserves a retry key', async () => {
    const plan = createCityProcurementPlan('city-1', 'City'); const requestId = crypto.randomUUID();
    const record = { plan, revision: 1, updatedAt: '2026-10-13T00:00:00.000Z', execution: 'manual-review-required' };
    const fetch = vi.fn(async () => new Response(JSON.stringify(record), { status: 201 })); vi.stubGlobal('fetch', fetch);
    expect(await saveCityProcurement('alpha', plan, 0, 'token', requestId)).toEqual(record);
    expect(fetch).toHaveBeenCalledWith(`/api/merchants/alpha/city-procurement/${plan.id}`, expect.objectContaining({ method: 'PUT', headers: { Authorization: 'Bearer token', 'content-type': 'application/json' }, body: JSON.stringify({ expectedRevision: 0, requestId, plan }) }));
  });
  it('blocks public demo saves before network traffic', async () => {
    const fetch = vi.fn(); vi.stubGlobal('fetch', fetch); guarded.assert.mockImplementation(() => { throw new Error('Demo only'); });
    await expect(saveCityProcurement('alpha', createCityProcurementPlan('city-1', 'City'), 0, 'token')).rejects.toThrow('Demo only');
    expect(fetch).not.toHaveBeenCalled();
  });
  it('does not label an HTML fallback or a server conflict as saved', async () => {
    const plan = createCityProcurementPlan('city-1', 'City'); vi.stubGlobal('fetch', vi.fn(async () => new Response('<html>Vite</html>')));
    await expect(loadCityProcurement('alpha', plan.id, 'token')).rejects.toThrow('invalid procurement record');
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ error: 'Reload the saved plan.' }), { status: 409 })));
    await expect(saveCityProcurement('alpha', plan, 1, 'token')).rejects.toThrow('Reload the saved plan');
  });
});
