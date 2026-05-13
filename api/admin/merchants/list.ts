/**
 * GET /api/admin/merchants
 *
 * Lists merchants awaiting Vic's approval click. Admin-only, behind
 * Clerk Bearer token + email allowlist / DB role check.
 *
 * Response: { merchants: Array<MerchantSummary> }
 *
 * Phase 2 will add: filters by status, search, pagination, audit log.
 */

import { drizzleMerchantStore } from '../../db/merchantStore.js';
import { authoriseAdminWithLive } from '../../lib/adminAuth.js';
import { listPendingMerchants } from '../../lib/adminMerchantActions.js';

interface MinimalReq {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
}
interface MinimalRes {
  setHeader(name: string, value: string): void;
  status(code: number): MinimalRes;
  end(payload?: string): void;
  json(body: unknown): void;
}

export default async function handler(req: MinimalReq, res: MinimalRes): Promise<void> {
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET, OPTIONS');
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

  const merchants = await listPendingMerchants(store);
  res.status(200);
  res.json({
    admin: { email: auth.admin.email, role: auth.admin.role },
    merchants: merchants.map((m) => ({
      id: m.id,
      slug: m.slug,
      businessName: m.businessName,
      brandName: m.brandName,
      contactName: m.contactName,
      contactEmail: m.contactEmail,
      contactPhone: m.contactPhone,
      country: m.country,
      website: m.website,
      productCategories: m.productCategories.split(','),
      estimatedMonthlyVolume: m.estimatedMonthlyVolume,
      referralNotes: m.referralNotes,
      status: m.status,
      createdAt: m.createdAt,
      notes: m.notes,
      stripeConnectAccountId: m.stripeConnectAccountId,
    })),
  });
}
