/**
 * Payout-disbursement worker — SCAFFOLD (2026-07-06 overnight pass).
 *
 * Closes the audit gap "payout_queue rows sit queued forever" with a
 * safe, reversible skeleton. THREE independent safety layers stop any
 * money movement:
 *
 *   1. DRY-RUN BY DEFAULT — unless PAYOUT_DISBURSE_ENABLED === 'true',
 *      the worker only REPORTS the rows that are due. Zero writes.
 *   2. NO RAIL ADAPTERS — even in live mode, every payment rail
 *      resolves to `rail_not_implemented` and the row is left untouched
 *      (status stays 'queued'). Moving real money requires writing a
 *      rail adapter on purpose — a Vic-gated build (MCB/MIPS/Stripe
 *      approvals are still pending externally anyway).
 *   3. NOT SCHEDULED — the /api/cron/disburse-payouts route exists but
 *      is NOT in vercel.json crons. It only runs when invoked manually
 *      with CRON_SECRET.
 *
 * When the rails go live: implement `disburseViaRail` per rail, flip
 * the env flag, add the cron schedule — each step is its own reviewable
 * diff.
 */

import { and, lte, eq, sql } from 'drizzle-orm';
import { getDb } from '../../_db/client.js';
import { payoutQueue, type PayoutQueueRow } from '../../_db/schema.js';

export interface DuePayout {
  id: number;
  merchantId: number;
  amountMinor: number;
  currency: string;
  rail: PayoutQueueRow['rail'];
  scheduledFor: string;
}

export interface DisburseBatchResult {
  /** 'dry-run' unless PAYOUT_DISBURSE_ENABLED === 'true'. */
  mode: 'dry-run' | 'live';
  /** Rows due (status=queued, scheduled_for <= now). */
  due: number;
  /** Per-row detail, capped at 50 for response size. */
  duePayouts: DuePayout[];
  /** Rows actually disbursed. Always 0 until a rail adapter exists. */
  disbursed: number;
  /** Rows skipped with reason (live mode only). */
  skipped: { id: number; reason: string }[];
}

export function isDisburseEnabled(): boolean {
  return process.env.PAYOUT_DISBURSE_ENABLED === 'true';
}

/**
 * Rail adapter dispatch. INTENTIONALLY unimplemented for every rail —
 * see the safety-layer note in the module docstring.
 */
async function disburseViaRail(row: DuePayout): Promise<{ ok: false; reason: string }> {
  return { ok: false, reason: `rail_not_implemented:${row.rail}` };
}

export async function findDuePayouts(limit = 200): Promise<DuePayout[]> {
  const db = getDb();
  const rows = await db
    .select({
      id: payoutQueue.id,
      merchantId: payoutQueue.merchantId,
      amountMinor: payoutQueue.amountMinor,
      currency: payoutQueue.currency,
      rail: payoutQueue.rail,
      scheduledFor: payoutQueue.scheduledFor,
    })
    .from(payoutQueue)
    .where(and(eq(payoutQueue.status, 'queued'), lte(payoutQueue.scheduledFor, sql`now()`)))
    .limit(limit);
  return rows.map((r) => ({
    ...r,
    scheduledFor:
      r.scheduledFor instanceof Date ? r.scheduledFor.toISOString() : String(r.scheduledFor),
  }));
}

export async function disbursePayoutsBatch(): Promise<DisburseBatchResult> {
  const due = await findDuePayouts();
  const mode: DisburseBatchResult['mode'] = isDisburseEnabled() ? 'live' : 'dry-run';
  const result: DisburseBatchResult = {
    mode,
    due: due.length,
    duePayouts: due.slice(0, 50),
    disbursed: 0,
    skipped: [],
  };

  if (mode === 'dry-run') return result;

  // Live mode: attempt each rail; with no adapters implemented every row
  // is skipped untouched (status stays 'queued' — nothing is bricked).
  for (const row of due) {
    const outcome = await disburseViaRail(row);
    result.skipped.push({ id: row.id, reason: outcome.reason });
  }
  return result;
}
