/**
 * Phase 5 (BACKEND-RUN-ORDER-2026-06-11) — payout ledger READ model.
 *
 * Makes payouts legible without touching the payout path. Reads
 * `payout_queue` (merchant share, per the 0.05 commission split recorded
 * by recordPayoutsForOrder) + `order_items` (gross) and derives the PPW
 * 5% commission so a merchant — and admin — can see gross / commission /
 * net + per-status breakdown. READ ONLY: never writes payout_queue, never
 * migrates its shape.
 *
 * Folded into merchants-router (merchant-scoped) + admin-router (admin
 * view) — NO new Vercel function.
 */

import { eq, desc } from 'drizzle-orm';
import { getDb, schema, type Db } from '../../db/client.js';
import { PPW_PAYOUT_COMMISSION_DEFAULT } from './recordPayoutsForOrder.js';

export interface LedgerPayoutLine {
  amountMinor: number;
  currency: string;
  status: string;
}

export interface LedgerTotals {
  currency: string;
  grossMinor: number;
  netMinor: number;
  commissionMinor: number;
  commissionRatePct: number;
  payoutCount: number;
  byStatus: Record<string, { count: number; amountMinor: number }>;
}

/**
 * Pure ledger summary. `netMinor` = sum of payout-queue merchant shares;
 * `grossMinor` = sum of order-item line totals; `commissionMinor` =
 * gross − net (PPW's 5% slice), clamped ≥ 0. Currency = the first payout
 * currency, else the first item currency, else MUR (single-currency
 * assumption — merchants are MUR-native at launch).
 */
export function summarizeLedger(
  payouts: Array<{ amountMinor: number; currency: string; status: string }>,
  items: Array<{ lineTotalMinor: number; currency: string }>,
): LedgerTotals {
  const currency = payouts[0]?.currency ?? items[0]?.currency ?? 'MUR';
  let netMinor = 0;
  const byStatus: Record<string, { count: number; amountMinor: number }> = {};
  for (const p of payouts) {
    if (p.currency !== currency) continue;
    netMinor += p.amountMinor;
    const b = byStatus[p.status] ?? { count: 0, amountMinor: 0 };
    b.count += 1;
    b.amountMinor += p.amountMinor;
    byStatus[p.status] = b;
  }
  let grossMinor = 0;
  for (const it of items) {
    if (it.currency !== currency) continue;
    grossMinor += it.lineTotalMinor;
  }
  const commissionMinor = Math.max(0, grossMinor - netMinor);
  return {
    currency,
    grossMinor,
    netMinor,
    commissionMinor,
    commissionRatePct: Math.round(PPW_PAYOUT_COMMISSION_DEFAULT * 100),
    payoutCount: payouts.filter((p) => p.currency === currency).length,
    byStatus,
  };
}

const SCHEMA_MISSING_RE =
  /relation .*(payout_queue|order_items|merchants).* does not exist|column .* does not exist|42P01|42703|undefined_table/i;

/**
 * Platform-wide ledger summary for the admin payouts view (gross /
 * commission / net + per-status breakdown). Additive to the existing
 * paginated list; resilient to un-migrated tables (returns null).
 */
export async function fetchAdminLedgerSummary(db: Db = getDb()): Promise<LedgerTotals | null> {
  try {
    const payoutRows = await db
      .select({
        amountMinor: schema.payoutQueue.amountMinor,
        currency: schema.payoutQueue.currency,
        status: schema.payoutQueue.status,
      })
      .from(schema.payoutQueue);
    const itemRows = await db
      .select({
        lineTotalMinor: schema.orderItems.lineTotalMinor,
        currency: schema.orderItems.currency,
      })
      .from(schema.orderItems);
    return summarizeLedger(
      payoutRows.map((p) => ({ amountMinor: p.amountMinor, currency: p.currency, status: String(p.status) })),
      itemRows,
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (SCHEMA_MISSING_RE.test(msg)) return null;
    throw err;
  }
}

export interface MerchantLedgerResult {
  ok: boolean;
  status: number;
  error?: string;
  payouts?: LedgerPayoutLine[];
  totals?: LedgerTotals;
  schemaMissing?: boolean;
}

/** Read a single merchant's payout ledger (queue rows + derived totals). */
export async function fetchMerchantPayoutLedger(
  merchantId: number,
  db: Db = getDb(),
): Promise<MerchantLedgerResult> {
  if (!Number.isFinite(merchantId) || merchantId <= 0) {
    return { ok: false, status: 400, error: 'positive integer merchantId required' };
  }
  try {
    const payoutRows = await db
      .select({
        amountMinor: schema.payoutQueue.amountMinor,
        currency: schema.payoutQueue.currency,
        status: schema.payoutQueue.status,
      })
      .from(schema.payoutQueue)
      .where(eq(schema.payoutQueue.merchantId, merchantId))
      .orderBy(desc(schema.payoutQueue.scheduledFor));
    const itemRows = await db
      .select({
        lineTotalMinor: schema.orderItems.lineTotalMinor,
        currency: schema.orderItems.currency,
      })
      .from(schema.orderItems)
      .where(eq(schema.orderItems.merchantId, merchantId));

    const payouts: LedgerPayoutLine[] = payoutRows.map((p) => ({
      amountMinor: p.amountMinor,
      currency: p.currency,
      status: String(p.status),
    }));
    const totals = summarizeLedger(payouts, itemRows);
    return { ok: true, status: 200, payouts, totals };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (SCHEMA_MISSING_RE.test(msg)) {
      return { ok: true, status: 200, payouts: [], totals: summarizeLedger([], []), schemaMissing: true };
    }
    throw err;
  }
}
