/**
 * POST /api/admin/merchants/reject
 *   body: { merchantId: number, reason: string }
 *
 * Phase 1 stub — rejects a merchant and emails them the reason.
 */

import { drizzleMerchantStore } from '../../../_db/merchantStore.js';
import { authoriseAdminWithLive } from '../../adminAuth.js';
import { rejectMerchant } from '../../adminMerchantActions.js';

interface MinimalReq {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  body?: unknown;
}
interface MinimalRes {
  setHeader(name: string, value: string): void;
  status(code: number): MinimalRes;
  end(payload?: string): void;
  json(body: unknown): void;
}

async function readJson(req: MinimalReq): Promise<unknown> {
  const b = req.body;
  if (b === undefined || b === null) return {};
  if (typeof b === 'object' && !Buffer.isBuffer(b)) return b;
  if (typeof b === 'string') {
    try {
      return JSON.parse(b);
    } catch {
      return null;
    }
  }
  if (Buffer.isBuffer(b)) {
    try {
      return JSON.parse(b.toString('utf8'));
    } catch {
      return null;
    }
  }
  return null;
}

export async function handler(req: MinimalReq, res: MinimalRes): Promise<void> {
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST, OPTIONS');
    res.status(405).end();
    return;
  }

  let store;
  try {
    store = drizzleMerchantStore();
  } catch {
    res.status(500);
    res.json({ error: 'Database unavailable.' });
    return;
  }

  const auth = await authoriseAdminWithLive(req.headers, store);
  if (!auth.ok) {
    res.status(auth.status);
    res.json({ error: auth.error });
    return;
  }

  const body = (await readJson(req)) as { merchantId?: number; reason?: string } | null;
  if (!body || typeof body.merchantId !== 'number' || !Number.isFinite(body.merchantId)) {
    res.status(400);
    res.json({ error: 'merchantId must be a number.' });
    return;
  }
  if (typeof body.reason !== 'string') {
    res.status(400);
    res.json({ error: 'reason is required.' });
    return;
  }

  const outcome = await rejectMerchant(
    body.merchantId,
    body.reason,
    { email: auth.admin.email, role: auth.admin.role },
    { store },
  );

  if (!outcome.ok) {
    res.status(outcome.status);
    res.json({ error: outcome.error });
    return;
  }

  res.status(200);
  res.json({
    ok: true,
    merchant: {
      id: outcome.merchant.id,
      status: outcome.merchant.status,
      rejectedAt: outcome.merchant.rejectedAt,
      rejectedReason: outcome.merchant.rejectedReason,
    },
    email: { ok: outcome.emailResult.ok, dryRun: !!outcome.emailResult.loggedOnly },
  });
}
