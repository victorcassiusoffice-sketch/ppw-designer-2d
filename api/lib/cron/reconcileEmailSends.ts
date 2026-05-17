/**
 * V4 M9.A.recon.1 — daily email-send reconciliation cron handler.
 *
 * Finds any `orders` row with `payment_status='captured'` from the
 * last 24 hours that has NO matching `audit_log` row with
 * `action='email.sent', target_type='email'` correlated by the
 * order's ppw_order_id, and re-enqueues the order-confirmed email
 * via `dispatchOrderConfirmedEmail`.
 *
 * Catches the failure-mode where M9.A.2's best-effort email path
 * silently lost a send (Resend down at capture moment, KV outage
 * stripping the dedup row before the audit fired, lambda timeout
 * etc.). Idempotent: the M9.A.send dedup-key cache means a re-fire
 * with the same payload is a no-op (returns dedup_hit) if the email
 * actually did go out — so this cron is safe to run even if there
 * was no real gap.
 *
 * Schedule (target): 05:40 slot in the unified daily dispatcher.
 * Until W0.D.8 ships, this is callable manually at
 * `GET /api/cron/email-send-reconcile?key=<CRON_SECRET>`.
 *
 * Folds into cron-router; no new Vercel lambda.
 */

import { sql } from 'drizzle-orm';

import { getDb } from '../../db/client.js';

import { dispatchOrderConfirmedEmail } from '../email/dispatch.js';

export const RECONCILE_WINDOW_HOURS = 24;
export const RECONCILE_LIMIT = 200;

export interface ReconcileResult {
  scanned: number;
  reEnqueued: number;
  dedupHits: number;
  errors: number;
  sampleOrderIds: string[];
}

export interface CapturedOrderRow {
  ppwOrderId: string;
  customerEmail: string | null;
  totalMinor: number;
  currency: string;
  rawPayload: unknown;
}

/**
 * Find captured orders in the last RECONCILE_WINDOW_HOURS hours that
 * have NO audit_log row with action='email.sent' AND payload->>'template'
 * = 'order-confirmed' tied to the same ppw_order_id.
 *
 * Uses a LEFT JOIN ... IS NULL pattern. The audit_log correlation
 * key lives in the payload (M9.A.send writes ppwOrderId into the
 * payload), so the JOIN predicate reads `payload->>'ppwOrderId' =
 * orders.ppw_order_id`. The 200-row cap keeps each tick under the
 * 60s budget; reconcile runs daily so a single tick clearing 200
 * orders/day is plenty.
 */
export async function findOrdersMissingConfirmEmail(): Promise<CapturedOrderRow[]> {
  const db = getDb();
  const rows = await db.execute(sql`
    SELECT
      o.ppw_order_id   AS "ppwOrderId",
      o.customer_email AS "customerEmail",
      o.total_minor    AS "totalMinor",
      o.currency       AS "currency",
      o.raw_payload    AS "rawPayload"
    FROM orders o
    LEFT JOIN audit_log a
      ON a.action = 'email.sent'
     AND a.target_type = 'email'
     AND a.payload->>'template' = 'order-confirmed'
     AND a.payload->>'ppwOrderId' = o.ppw_order_id
    WHERE o.payment_status = 'captured'
      AND o.updated_at >= now() - interval '${sql.raw(String(RECONCILE_WINDOW_HOURS))} hours'
      AND a.id IS NULL
    ORDER BY o.updated_at ASC
    LIMIT ${RECONCILE_LIMIT}
  `);
  const list =
    (Array.isArray(rows) ? rows : ((rows as unknown as { rows?: unknown[] }).rows ?? [])) as unknown[];
  return list as CapturedOrderRow[];
}

/**
 * Pull the payer email out of the stored PayPal raw_payload as a
 * fallback when orders.customer_email is empty (current
 * recordCapturedOrder writes an empty string).
 */
export function extractPayerEmail(row: CapturedOrderRow): string | null {
  if (row.customerEmail && row.customerEmail.trim().length > 0) return row.customerEmail;
  const raw = row.rawPayload as { payer?: { email_address?: string } } | null | undefined;
  const email = raw?.payer?.email_address;
  return email && email.trim().length > 0 ? email : null;
}

export async function reconcileEmailSendsBatch(): Promise<ReconcileResult> {
  const stale = await findOrdersMissingConfirmEmail();
  if (stale.length === 0) {
    return { scanned: 0, reEnqueued: 0, dedupHits: 0, errors: 0, sampleOrderIds: [] };
  }

  let reEnqueued = 0;
  let dedupHits = 0;
  let errors = 0;
  const sample: string[] = [];

  for (const row of stale) {
    if (sample.length < 5) sample.push(row.ppwOrderId);
    const email = extractPayerEmail(row);
    if (!email) {
      // No way to email — skip; don't count as error (no contact info).
      continue;
    }
    const dispatch = await dispatchOrderConfirmedEmail({
      ppwOrderId: row.ppwOrderId,
      customerEmail: email,
      totalMinor: Number(row.totalMinor),
      currency: row.currency,
    });
    if (dispatch.fired && dispatch.send?.ok) {
      if (dispatch.send.code === 'dedup_hit') dedupHits += 1;
      else reEnqueued += 1;
    } else if (dispatch.fired === false && dispatch.skippedReason === 'caller_caught') {
      errors += 1;
    } else if (dispatch.send && !dispatch.send.ok) {
      errors += 1;
    }
  }

  return { scanned: stale.length, reEnqueued, dedupHits, errors, sampleOrderIds: sample };
}
