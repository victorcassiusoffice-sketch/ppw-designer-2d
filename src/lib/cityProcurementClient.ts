import { CityProcurementRecordSchema, CityProcurementWriteSchema, type CityProcurementPlan, type CityProcurementRecord } from '../designer/cityProcurement';
import { assertShowcaseWritable } from './showcaseSafety';

function address(slug: string, id: string) {
  if (!/^[a-z0-9][a-z0-9-]{0,99}$/.test(slug) || !/^[0-9a-f-]{36}$/i.test(id)) throw new Error('Invalid merchant or procurement plan identifier.');
  return `/api/merchants/${encodeURIComponent(slug)}/city-procurement/${encodeURIComponent(id)}`;
}
async function readRecord(response: Response, expectedId: string): Promise<CityProcurementRecord> {
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) throw new Error(body && typeof body === 'object' && 'error' in body && typeof body.error === 'string' ? body.error : `Procurement request failed (${response.status}).`);
  const parsed = CityProcurementRecordSchema.safeParse(body);
  if (!parsed.success || parsed.data.plan.id !== expectedId) throw new Error('The server returned an invalid procurement record.');
  return parsed.data;
}
export async function loadCityProcurement(merchantSlug: string, planId: string, token: string): Promise<CityProcurementRecord> {
  if (!token) throw new Error('Merchant sign-in required.');
  return readRecord(await fetch(address(merchantSlug, planId), { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' }), planId);
}
/** Explicit save of a draft only. Retain requestId for a manual retry after an uncertain response. */
export async function saveCityProcurement(merchantSlug: string, plan: CityProcurementPlan, expectedRevision: number, token: string, requestId: string = crypto.randomUUID()): Promise<CityProcurementRecord> {
  assertShowcaseWritable();
  if (!token) throw new Error('Merchant sign-in required.');
  const payload = CityProcurementWriteSchema.parse({ plan, expectedRevision, requestId });
  return readRecord(await fetch(address(merchantSlug, plan.id), { method: 'PUT', headers: { Authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: JSON.stringify(payload) }), plan.id);
}
