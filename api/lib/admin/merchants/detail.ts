/**
 * GET /api/admin/merchants/[slug]
 *
 * Returns the full merchant record + KYC documents (joined from
 * `merchant_documents`) + Stripe Connect account state if the merchant
 * has one. Admin-only; same auth shape as `list.ts`.
 *
 * Vercel rewrites `/api/admin/merchants/[slug]` to this handler; the
 * slug comes through on `req.query.slug`. We also accept a numeric id
 * via `?id=` for direct linking from the queue.
 *
 * Response (200):
 *   {
 *     admin:       { email, role },
 *     merchant:    MerchantDetail,
 *     documents:   Array<MerchantDocument>,
 *     stripe?:     { id, chargesEnabled, payoutsEnabled, detailsSubmitted, requirements }
 *   }
 *
 * Stripe is loaded lazily via `await import('stripe')` so the bundle
 * stays slim for merchants without Connect accounts, and so the
 * handler still works when STRIPE_SECRET_KEY is unset in preview.
 */

import { drizzleMerchantStore } from '../../../db/merchantStore.js';
import { authoriseAdminWithLive } from '../../adminAuth.js';
import { getDb, schema } from '../../../db/client.js';
import { eq } from 'drizzle-orm';

interface MinimalReq {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  query?: Record<string, string | string[] | undefined>;
  url?: string;
}
interface MinimalRes {
  setHeader(name: string, value: string): void;
  status(code: number): MinimalRes;
  end(payload?: string): void;
  json(body: unknown): void;
}

function pickSlug(req: MinimalReq): string | null {
  const q = req.query ?? {};
  const raw = q['slug'] ?? q['id'];
  const v = Array.isArray(raw) ? raw[0] : raw;
  if (typeof v === 'string' && v.trim()) return v.trim();

  // Fallback: parse the last path segment when no query helper present.
  if (req.url) {
    const path = req.url.split('?')[0] ?? '';
    const seg = path.split('/').filter(Boolean).pop();
    if (seg && seg !== 'merchants') return decodeURIComponent(seg);
  }
  return null;
}

interface StripeAccountSummary {
  id: string;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  detailsSubmitted: boolean;
  requirementsCurrentlyDue: string[];
}

async function fetchStripeAccount(accountId: string): Promise<StripeAccountSummary | null> {
  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) return null;
  try {
    const mod = await import('stripe');
    const Stripe = (mod as { default?: typeof import('stripe').default }).default ?? (mod as unknown as typeof import('stripe').default);
    const stripe = new Stripe(secret, { apiVersion: '2024-12-18.acacia' as never });
    const acct = await stripe.accounts.retrieve(accountId);
    return {
      id: acct.id,
      chargesEnabled: !!acct.charges_enabled,
      payoutsEnabled: !!acct.payouts_enabled,
      detailsSubmitted: !!acct.details_submitted,
      requirementsCurrentlyDue: acct.requirements?.currently_due ?? [],
    };
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[admin/detail] stripe retrieve failed', err instanceof Error ? err.message : err);
    return null;
  }
}

export async function handler(req: MinimalReq, res: MinimalRes): Promise<void> {
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

  const slug = pickSlug(req);
  if (!slug) {
    res.status(400);
    res.json({ error: 'Missing slug or id.' });
    return;
  }

  // Slug can be either the merchant slug or a numeric id. Try numeric
  // first because numeric slugs are not allowed by the signup form.
  let merchant = null;
  if (/^\d+$/.test(slug)) {
    merchant = await store.findById(Number(slug));
  }
  if (!merchant) merchant = await store.findBySlug(slug);

  if (!merchant) {
    res.status(404);
    res.json({ error: 'Merchant not found.' });
    return;
  }

  // Documents (best-effort — empty array if the relation isn't loaded).
  let documents: Array<{ id: number; docType: string; blobUrl: string; uploadedAt: Date }> = [];
  try {
    const db = getDb();
    documents = await db
      .select({
        id: schema.merchantDocuments.id,
        docType: schema.merchantDocuments.docType,
        blobUrl: schema.merchantDocuments.blobUrl,
        uploadedAt: schema.merchantDocuments.uploadedAt,
      })
      .from(schema.merchantDocuments)
      .where(eq(schema.merchantDocuments.merchantId, merchant.id));
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[admin/detail] documents lookup failed', err instanceof Error ? err.message : err);
  }

  const stripe = merchant.stripeConnectAccountId
    ? await fetchStripeAccount(merchant.stripeConnectAccountId)
    : null;

  res.status(200);
  res.json({
    admin: { email: auth.admin.email, role: auth.admin.role },
    merchant: {
      id: merchant.id,
      slug: merchant.slug,
      businessName: merchant.businessName,
      brandName: merchant.brandName,
      contactName: merchant.contactName,
      contactEmail: merchant.contactEmail,
      contactPhone: merchant.contactPhone,
      country: merchant.country,
      website: merchant.website,
      productCategories: merchant.productCategories.split(',').map((s) => s.trim()).filter(Boolean),
      estimatedMonthlyVolume: merchant.estimatedMonthlyVolume,
      referralNotes: merchant.referralNotes,
      stripeConnectAccountId: merchant.stripeConnectAccountId,
      status: merchant.status,
      notes: merchant.notes,
      createdAt: merchant.createdAt,
      updatedAt: merchant.updatedAt,
      approvedAt: merchant.approvedAt,
      approvedBy: merchant.approvedBy,
      rejectedAt: merchant.rejectedAt,
      rejectedReason: merchant.rejectedReason,
    },
    documents,
    stripe,
  });
}

// Exported for testing — the handler is otherwise a black box.
export const __testing = {
  pickSlug,
  fetchStripeAccount,
};
