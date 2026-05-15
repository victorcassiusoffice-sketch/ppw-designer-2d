/**
 * POST /api/admin/merchants/approve
 *   body: { merchantId: number }
 *
 * Phase 1 stub — approves a merchant currently in pending_admin_approval
 * (or earlier KYC states) and fires the welcome email.
 */

import { drizzleMerchantStore } from '../../../db/merchantStore.js';
import { authoriseAdminWithLive } from '../../adminAuth.js';
import { approveMerchant } from '../../adminMerchantActions.js';

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

  const body = (await readJson(req)) as { merchantId?: number } | null;
  if (!body || typeof body.merchantId !== 'number' || !Number.isFinite(body.merchantId)) {
    res.status(400);
    res.json({ error: 'merchantId must be a number.' });
    return;
  }

  const outcome = await approveMerchant(
    body.merchantId,
    { email: auth.admin.email, role: auth.admin.role },
    {
      store,
      merchantPortalUrl: process.env.MERCHANT_PORTAL_URL,
    },
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
      approvedAt: outcome.merchant.approvedAt,
    },
    email: { ok: outcome.emailResult.ok, dryRun: !!outcome.emailResult.loggedOnly },
  });
}
