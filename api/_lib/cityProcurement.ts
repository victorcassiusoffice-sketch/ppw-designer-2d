import { createHash } from 'node:crypto';
import { z } from 'zod';
import { CityProcurementPlanSchema, CityProcurementWriteSchema, CITY_PROCUREMENT_EXECUTION } from '../../src/designer/cityProcurement.js';
import { drizzleCityProcurementStore, type CityProcurementStore, type StoredCityProcurement } from '../_db/cityProcurementStore.js';
import { authoriseMerchantSession } from './merchantSession.js';
import { rejectShowcaseTransaction } from './showcaseSafety.js';

interface Request { method?: string; headers?: Record<string, string | string[] | undefined> }
interface Response { status(code: number): unknown; json(body: unknown): void; setHeader(name: string, value: string): void }
const MAX_BODY_BYTES = 400_000;
function publicRecord(row: StoredCityProcurement) {
  return { plan: CityProcurementPlanSchema.parse(row.document), revision: row.revision, updatedAt: row.updatedAt.toISOString(), execution: CITY_PROCUREMENT_EXECUTION };
}
/** Saving dates never creates an order, invoice, email or scheduled worker. */
export async function handleCityProcurement(
  slug: string, id: string, req: Request, res: Response, readBody: () => Promise<unknown>,
  storeFactory: () => CityProcurementStore = drizzleCityProcurementStore,
): Promise<void> {
  res.setHeader('Cache-Control', 'private, no-store');
  if (!['GET', 'PUT'].includes(req.method ?? '')) { res.setHeader('Allow', 'GET, PUT, OPTIONS'); res.status(405); res.json({ error: 'Method not allowed.' }); return; }
  // Before auth/body/database: a preview cannot write even with a real merchant token.
  if (req.method === 'PUT' && rejectShowcaseTransaction(res)) return;
  if (!/^[a-z0-9][a-z0-9-]{0,99}$/.test(slug) || !z.string().uuid().safeParse(id).success) { res.status(400); res.json({ error: 'Invalid merchant or procurement plan identifier.' }); return; }
  try {
    const auth = authoriseMerchantSession(req.headers, slug);
    if (!auth.ok) { res.status(auth.status); res.json({ error: auth.error }); return; }
    const declaredLength = req.headers?.['content-length'];
    if (typeof declaredLength === 'string' && Number(declaredLength) > MAX_BODY_BYTES) { res.status(413); res.json({ error: 'Procurement plan is too large.' }); return; }
    const store = storeFactory();
    const merchant = await store.merchant(slug);
    // Revalidate the signed identity against live merchant ownership and status.
    if (!merchant || merchant.status !== 'approved' || merchant.contactEmail.trim().toLowerCase() !== auth.email.trim().toLowerCase()) { res.status(403); res.json({ error: 'An approved merchant account is required.' }); return; }
    if (req.method === 'GET') {
      const row = await store.get(merchant.id, id);
      if (!row) { res.status(404); res.json({ error: 'Procurement plan not found.' }); return; }
      res.status(200); res.json(publicRecord(row)); return;
    }
    const raw = await readBody();
    if (Buffer.byteLength(JSON.stringify(raw) ?? '', 'utf8') > MAX_BODY_BYTES) { res.status(413); res.json({ error: 'Procurement plan is too large.' }); return; }
    const parsed = CityProcurementWriteSchema.safeParse(raw);
    if (!parsed.success || parsed.data.plan.id !== id) { res.status(400); res.json({ error: 'Invalid procurement plan. Check dates, recipients, quantities and identifiers.' }); return; }
    const { plan, requestId, expectedRevision } = parsed.data;
    const hash = createHash('sha256').update(JSON.stringify({ plan, expectedRevision })).digest('hex');
    const existing = await store.get(merchant.id, id);
    if (existing && CityProcurementPlanSchema.parse(existing.document).projectId !== plan.projectId) {
      res.status(409); res.json({ error: 'A saved procurement plan cannot be reassigned to another project. Create a new plan.' }); return;
    }
    if (existing?.lastRequestId === requestId) {
      if (existing.lastRequestHash !== hash) { res.status(409); res.json({ error: 'This request identifier was already used for different content.' }); return; }
      res.status(200); res.json(publicRecord(existing)); return;
    }
    if ((existing?.revision ?? 0) !== expectedRevision) { res.status(409); res.json({ error: 'This plan changed. Reload the saved plan before saving again.', currentRevision: existing?.revision ?? 0 }); return; }
    const saved = await store.compareAndSave({ merchantId: merchant.id, plan, expectedRevision, requestId, hash, actor: auth.email });
    if (saved) { res.status(expectedRevision === 0 ? 201 : 200); res.json(publicRecord(saved)); return; }
    // A concurrent identical retry can have won the atomic compare-and-save.
    const winner = await store.get(merchant.id, id);
    if (winner?.lastRequestId === requestId && winner.lastRequestHash === hash) { res.status(200); res.json(publicRecord(winner)); return; }
    res.status(409); res.json({ error: 'This plan changed. Reload the saved plan before saving again.' });
  } catch {
    // No connection strings, SQL, recipient addresses or provider details in error responses.
    res.status(503); res.json({ error: 'Secure procurement storage is unavailable. Keep the local draft and try again later.' });
  }
}
