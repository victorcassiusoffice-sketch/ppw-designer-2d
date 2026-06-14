/**
 * Phase 6 (BACKEND-RUN-ORDER-2026-06-11) — Pattern-C commission ledger
 * read-model (the /admin/k1-commission books).
 *
 * Computes per-referral 5% commission lines from the existing
 * designer_referrals click-attribution rows and overlays reconciliation
 * state from commission_ledger (matched by ref_code). reconcile-mark
 * transitions a line pending → reconciled. No money moves — this is the
 * commission book Vic reconciles against the K1 order export.
 */

import { desc, eq } from 'drizzle-orm';
import { getDb, schema, type Db } from '../../db/client.js';
import { PPW_PAYOUT_COMMISSION_DEFAULT } from '../payouts/recordPayoutsForOrder.js';

export interface ReferralRow {
  refCode: string;
  merchantSlug: string;
  productName: string | null;
  productPriceMinor: number | null;
  productCurrency: string | null;
  createdAt: Date | string;
}

export interface CommissionLine {
  refCode: string;
  merchantSlug: string;
  productName: string | null;
  grossMinor: number;
  commissionMinor: number;
  currency: string | null;
  status: 'pending' | 'reconciled';
  reconciledAt: string | null;
  date: string;
}

export interface CommissionTotals {
  grossMinor: number;
  commissionMinor: number;
  lineCount: number;
  byStatus: Record<'pending' | 'reconciled', { count: number; commissionMinor: number }>;
}

export function commissionOf(grossMinor: number, rate = PPW_PAYOUT_COMMISSION_DEFAULT): number {
  return Math.round(Math.max(0, grossMinor) * rate);
}

/**
 * Pure line computation. Each referral becomes a 5% line; its status is
 * taken from the ledger overlay (default 'pending' when unreconciled).
 */
export function computeCommissionLines(
  referrals: ReferralRow[],
  ledgerByRefCode: Map<string, { status: 'pending' | 'reconciled'; reconciledAt: string | null }>,
): { lines: CommissionLine[]; totals: CommissionTotals } {
  const lines: CommissionLine[] = [];
  const totals: CommissionTotals = {
    grossMinor: 0,
    commissionMinor: 0,
    lineCount: 0,
    byStatus: { pending: { count: 0, commissionMinor: 0 }, reconciled: { count: 0, commissionMinor: 0 } },
  };
  for (const r of referrals) {
    const grossMinor = r.productPriceMinor ?? 0;
    const commissionMinor = commissionOf(grossMinor);
    const overlay = ledgerByRefCode.get(r.refCode);
    const status = overlay?.status ?? 'pending';
    lines.push({
      refCode: r.refCode,
      merchantSlug: r.merchantSlug,
      productName: r.productName,
      grossMinor,
      commissionMinor,
      currency: r.productCurrency,
      status,
      reconciledAt: overlay?.reconciledAt ?? null,
      date: new Date(r.createdAt).toISOString(),
    });
    totals.grossMinor += grossMinor;
    totals.commissionMinor += commissionMinor;
    totals.lineCount += 1;
    totals.byStatus[status].count += 1;
    totals.byStatus[status].commissionMinor += commissionMinor;
  }
  return { lines, totals };
}

const SCHEMA_MISSING_RE =
  /relation .*(designer_referrals|commission_ledger).* does not exist|column .* does not exist|42P01|42703|undefined_table/i;

export interface LedgerResult {
  ok: boolean;
  status: number;
  error?: string;
  lines?: CommissionLine[];
  totals?: CommissionTotals;
  schemaMissing?: boolean;
}

/** Read the commission ledger (referrals + reconciliation overlay). */
export async function fetchCommissionLedger(
  opts: { merchantSlug?: string | null; limit?: number } = {},
  db: Db = getDb(),
): Promise<LedgerResult> {
  const limit = Math.min(500, Math.max(1, Math.floor(opts.limit ?? 200)));
  try {
    const base = db
      .select({
        refCode: schema.designerReferrals.refCode,
        merchantSlug: schema.designerReferrals.merchantSlug,
        productName: schema.designerReferrals.productName,
        productPriceMinor: schema.designerReferrals.productPriceMinor,
        productCurrency: schema.designerReferrals.productCurrency,
        createdAt: schema.designerReferrals.createdAt,
      })
      .from(schema.designerReferrals);
    const referrals = await (opts.merchantSlug
      ? base.where(eq(schema.designerReferrals.merchantSlug, opts.merchantSlug))
      : base
    )
      .orderBy(desc(schema.designerReferrals.createdAt))
      .limit(limit);

    const ledgerRows = await db
      .select({
        refCode: schema.commissionLedger.refCode,
        status: schema.commissionLedger.status,
        reconciledAt: schema.commissionLedger.reconciledAt,
      })
      .from(schema.commissionLedger);
    const overlay = new Map<string, { status: 'pending' | 'reconciled'; reconciledAt: string | null }>();
    for (const l of ledgerRows) {
      overlay.set(l.refCode, {
        status: l.status as 'pending' | 'reconciled',
        reconciledAt: l.reconciledAt ? new Date(l.reconciledAt).toISOString() : null,
      });
    }

    const { lines, totals } = computeCommissionLines(referrals as ReferralRow[], overlay);
    return { ok: true, status: 200, lines, totals };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (SCHEMA_MISSING_RE.test(msg)) {
      return { ok: true, status: 200, lines: [], totals: computeCommissionLines([], new Map()).totals, schemaMissing: true };
    }
    throw err;
  }
}

export interface ReconcileResult {
  ok: boolean;
  status: number;
  error?: string;
  refCode?: string;
  reconciledAt?: string;
}

/**
 * Mark a referral's commission line reconciled (pending → reconciled).
 * Upserts a commission_ledger row keyed by ref_code, computing the gross/
 * commission from the source referral. No money moves.
 */
export async function reconcileCommission(
  refCode: string,
  note: string | null,
  db: Db = getDb(),
): Promise<ReconcileResult> {
  if (!refCode) return { ok: false, status: 400, error: 'refCode required' };
  try {
    const refRows = await db
      .select({
        merchantSlug: schema.designerReferrals.merchantSlug,
        productPriceMinor: schema.designerReferrals.productPriceMinor,
        productCurrency: schema.designerReferrals.productCurrency,
      })
      .from(schema.designerReferrals)
      .where(eq(schema.designerReferrals.refCode, refCode))
      .limit(1);
    const ref = refRows[0];
    if (!ref) return { ok: false, status: 404, error: 'referral_not_found' };

    const grossMinor = ref.productPriceMinor ?? 0;
    const commissionMinor = commissionOf(grossMinor);
    const now = new Date();

    const existing = await db
      .select({ id: schema.commissionLedger.id })
      .from(schema.commissionLedger)
      .where(eq(schema.commissionLedger.refCode, refCode))
      .limit(1);

    if (existing[0]) {
      await db
        .update(schema.commissionLedger)
        .set({ status: 'reconciled', reconciledAt: now, note: note ?? null })
        .where(eq(schema.commissionLedger.refCode, refCode));
    } else {
      await db.insert(schema.commissionLedger).values({
        refCode,
        merchantSlug: ref.merchantSlug,
        grossMinor,
        commissionMinor,
        currency: ref.productCurrency ?? null,
        status: 'reconciled',
        reconciledAt: now,
        note: note ?? null,
      });
    }
    return { ok: true, status: 200, refCode, reconciledAt: now.toISOString() };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (SCHEMA_MISSING_RE.test(msg)) return { ok: false, status: 503, error: 'schema_missing' };
    throw err;
  }
}
