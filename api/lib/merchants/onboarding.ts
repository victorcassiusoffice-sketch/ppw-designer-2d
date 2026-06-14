/**
 * Phase 5 (BACKEND-RUN-ORDER-2026-06-11) — merchant self-serve onboarding.
 *
 * The "merchant live in ~1 hour" scale lever (C5). Backend only:
 *   - KYC-lite submit (business + contact + payout method captured).
 *   - Onboarding-state read.
 *   - Go-live checklist (machine-checkable readiness: ≥1 product, payout
 *     method set, KYC-lite done) + mark-go-live.
 *   - Stripe-Connect → KYC mapping (read-only; precondition webhook).
 *
 * Pure helpers (schema, checklist, status mapping) are unit-tested; DB
 * wrappers take an injectable `Db` (defaults to getDb()) so tests pass a
 * fake builder. Folded into merchants-router — NO new Vercel function.
 */

import { z } from 'zod';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { getDb, schema, type Db } from '../../db/client.js';
import type { MerchantStatus } from '../../db/schema.js';

// ─────────────────────────────────────────────────────────────────────
// PURE helpers
// ─────────────────────────────────────────────────────────────────────

export const KYC_STATUSES = ['none', 'lite_submitted', 'verified'] as const;
export type KycStatus = (typeof KYC_STATUSES)[number];

export const PAYOUT_METHODS = ['paypal', 'stripe', 'mcb_juice', 'bank_transfer'] as const;
export type PayoutMethod = (typeof PAYOUT_METHODS)[number];

export const liteKycSchema = z
  .object({
    payoutMethod: z.enum(PAYOUT_METHODS),
    // Optional contact corrections captured during the lite flow.
    businessName: z.string().trim().min(1).max(200).optional(),
    contactName: z.string().trim().min(1).max(200).optional(),
    contactPhone: z.string().trim().min(1).max(40).optional(),
  })
  .strict();

export type LiteKycPayload = z.infer<typeof liteKycSchema>;

/**
 * Map the Stripe-Connect-driven merchant_status (set by the
 * account.updated webhook — see api/lib/stripeConnectWebhook.ts) to a
 * KYC-lite status. Only ever UPGRADES (returns 'verified' once Connect
 * reports charges enabled / admin-approved); otherwise null = leave the
 * merchant-submitted lite status untouched.
 */
export function deriveKycFromMerchantStatus(status: MerchantStatus): KycStatus | null {
  if (status === 'approved' || status === 'pending_admin_approval') return 'verified';
  return null;
}

export interface OnboardingState {
  slug: string;
  status: MerchantStatus;
  onboardingStep: number;
  kycStatus: KycStatus;
  payoutMethod: string | null;
  goLiveAt: string | null;
  productCount: number;
}

export interface ChecklistItem {
  key: string;
  label: string;
  done: boolean;
}

export interface GoLiveChecklist {
  ready: boolean;
  items: ChecklistItem[];
  missing: string[];
}

/**
 * Compute go-live readiness. The "~1 hour" benchmark made machine-
 * checkable: a merchant is go-live-ready when it has at least one
 * product, a payout method set, and KYC-lite submitted (or verified).
 */
export function computeGoLiveChecklist(input: {
  productCount: number;
  payoutMethod: string | null;
  kycStatus: KycStatus;
}): GoLiveChecklist {
  const items: ChecklistItem[] = [
    { key: 'has_product', label: 'At least one product listed', done: input.productCount >= 1 },
    { key: 'payout_method', label: 'Payout method selected', done: !!input.payoutMethod },
    { key: 'kyc_lite', label: 'KYC-lite submitted', done: input.kycStatus !== 'none' },
  ];
  const missing = items.filter((i) => !i.done).map((i) => i.key);
  return { ready: missing.length === 0, items, missing };
}

// ─────────────────────────────────────────────────────────────────────
// DB wrappers
// ─────────────────────────────────────────────────────────────────────

const SCHEMA_MISSING_RE =
  /relation .*(merchants|products).* does not exist|column .* does not exist|42P01|42703|undefined_table/i;

async function countActiveProducts(merchantId: number, db: Db): Promise<number> {
  const rows = await db
    .select({ c: sql<number>`COUNT(*)::int` })
    .from(schema.products)
    .where(
      and(
        eq(schema.products.merchantId, merchantId),
        eq(schema.products.status, 'active'),
        isNull(schema.products.retiredAt),
      ),
    );
  return Number(rows[0]?.c ?? 0);
}

export interface OnboardingResult {
  ok: boolean;
  status: number;
  error?: string;
  state?: OnboardingState;
  checklist?: GoLiveChecklist;
}

async function loadMerchant(slug: string, db: Db) {
  const rows = await db
    .select({
      id: schema.merchants.id,
      slug: schema.merchants.slug,
      status: schema.merchants.status,
      onboardingStep: schema.merchants.onboardingStep,
      kycStatus: schema.merchants.kycStatus,
      payoutMethod: schema.merchants.payoutMethod,
      goLiveAt: schema.merchants.goLiveAt,
    })
    .from(schema.merchants)
    .where(eq(schema.merchants.slug, slug))
    .limit(1);
  return rows[0] ?? null;
}

function toState(
  m: NonNullable<Awaited<ReturnType<typeof loadMerchant>>>,
  productCount: number,
): OnboardingState {
  return {
    slug: m.slug,
    status: m.status,
    onboardingStep: m.onboardingStep ?? 0,
    kycStatus: (m.kycStatus ?? 'none') as KycStatus,
    payoutMethod: m.payoutMethod ?? null,
    goLiveAt: m.goLiveAt ? new Date(m.goLiveAt).toISOString() : null,
    productCount,
  };
}

/** Read onboarding state + go-live checklist for a merchant. */
export async function getOnboardingState(slug: string, db: Db = getDb()): Promise<OnboardingResult> {
  if (!slug) return { ok: false, status: 400, error: 'slug required' };
  try {
    const m = await loadMerchant(slug, db);
    if (!m) return { ok: false, status: 404, error: 'merchant_not_found' };
    const productCount = await countActiveProducts(Number(m.id), db);
    const state = toState(m, productCount);
    // Read-only KYC reflection: once the Stripe-Connect account.updated
    // webhook (or admin approval) flips merchant_status to verified, surface
    // kyc_status='verified' without a write (the webhook owns merchant_status).
    const derived = deriveKycFromMerchantStatus(state.status);
    if (derived === 'verified' && state.kycStatus !== 'verified') {
      state.kycStatus = 'verified';
    }
    const checklist = computeGoLiveChecklist({
      productCount,
      payoutMethod: state.payoutMethod,
      kycStatus: state.kycStatus,
    });
    return { ok: true, status: 200, state, checklist };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (SCHEMA_MISSING_RE.test(msg)) return { ok: false, status: 503, error: 'schema_missing' };
    throw err;
  }
}

/** Submit KYC-lite: capture payout method (+ optional contact), advance state. */
export async function submitLiteKyc(
  slug: string,
  rawBody: unknown,
  db: Db = getDb(),
): Promise<OnboardingResult> {
  if (!slug) return { ok: false, status: 400, error: 'slug required' };
  const parsed = liteKycSchema.safeParse(rawBody);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => `${i.path.join('.') || 'body'}: ${i.message}`).join('; ');
    return { ok: false, status: 400, error: msg };
  }
  const fields = parsed.data;
  try {
    const m = await loadMerchant(slug, db);
    if (!m) return { ok: false, status: 404, error: 'merchant_not_found' };
    const nextStep = Math.max(Number(m.onboardingStep ?? 0), 2);
    const set: Record<string, unknown> = {
      payoutMethod: fields.payoutMethod,
      kycStatus: 'lite_submitted',
      onboardingStep: nextStep,
      updatedAt: new Date(),
    };
    if (fields.businessName) set.businessName = fields.businessName;
    if (fields.contactName) set.contactName = fields.contactName;
    if (fields.contactPhone) set.contactPhone = fields.contactPhone;
    await db.update(schema.merchants).set(set).where(eq(schema.merchants.id, Number(m.id)));
    return getOnboardingState(slug, db);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (SCHEMA_MISSING_RE.test(msg)) return { ok: false, status: 503, error: 'schema_missing' };
    throw err;
  }
}

/** Mark a merchant go-live (sets go_live_at) — only when the checklist is ready. */
export async function markGoLive(slug: string, db: Db = getDb()): Promise<OnboardingResult> {
  if (!slug) return { ok: false, status: 400, error: 'slug required' };
  try {
    const current = await getOnboardingState(slug, db);
    if (!current.ok || !current.state || !current.checklist) return current;
    if (!current.checklist.ready) {
      return { ok: false, status: 409, error: 'not_ready', checklist: current.checklist, state: current.state };
    }
    if (!current.state.goLiveAt) {
      const m = await loadMerchant(slug, db);
      if (m) {
        await db
          .update(schema.merchants)
          .set({ goLiveAt: new Date(), onboardingStep: Math.max(current.state.onboardingStep, 3), updatedAt: new Date() })
          .where(eq(schema.merchants.id, Number(m.id)));
      }
      return getOnboardingState(slug, db);
    }
    return current; // already live — idempotent
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (SCHEMA_MISSING_RE.test(msg)) return { ok: false, status: 503, error: 'schema_missing' };
    throw err;
  }
}
