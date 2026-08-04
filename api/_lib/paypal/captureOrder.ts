/**
 * Vercel serverless function - capture PayPal Standard order.
 *
 * POST /api/capturePaypalOrder
 *   body: { paypalOrderId: string, ppwOrderId: string }
 *   200:  { ok: true, status: 'captured' }
 *   400:  { error: '<safe-message>' }
 *   405:  wrong method
 *   500:  { error: '<safe-message>' }
 *
 * After the buyer approves the payment on PayPal they're redirected
 * back to our return_url (which lives on /order/success). The page
 * extracts the PayPal `token` (= paypalOrderId) and calls this
 * endpoint to capture the funds.
 *
 * On a successful capture we insert/update the `orders` row with
 * payment_status='captured'. The PayPal webhook is the authoritative
 * source of truth for state changes after this point - this endpoint
 * is the "happy-path" UI accelerator.
 */

import { withSentry, type MinReq, type MinRes } from '../sentry.js';
import { readPaypalEnv, paypalFetch } from '../paypalClient.js';
import { parsePaypalCustomId } from './customId.js';
import { getDb } from '../../_db/client.js';
import { orders } from '../../_db/schema.js';
import { sql } from 'drizzle-orm';
import {
  dispatchOrderConfirmedEmail,
  dispatchMerchantOrderConfirmedEmail,
  deriveGreetingName,
} from '../email/dispatch.js';
import { fetchMerchantNotifyRowsForOrder } from '../email/merchantOrderLookup.js';
import { recordPayoutsForOrder } from '../payouts/recordPayoutsForOrder.js';
import { recordOrderItemsForOrder, type PaypalCaptureItem } from '../payouts/recordOrderItemsForOrder.js';
import { recordReferralsForOrder } from '../payouts/recordReferralsForOrder.js';

const ALLOWED_ORIGINS = new Set([
  'http://127.0.0.1:5173',
  'http://localhost:5173',
  'https://designer.ppwellness.co',
]);

function corsHeaders(origin: string | undefined): Record<string, string> {
  const allow = origin && ALLOWED_ORIGINS.has(origin) ? origin : 'https://designer.ppwellness.co';
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

async function readJsonBody(req: MinReq): Promise<unknown> {
  const b = req.body;
  if (b === undefined || b === null) return {};
  if (typeof b === 'object' && !Buffer.isBuffer(b)) return b;
  if (typeof b === 'string') {
    try { return JSON.parse(b); } catch { return null; }
  }
  if (Buffer.isBuffer(b)) {
    try { return JSON.parse(b.toString('utf8')); } catch { return null; }
  }
  return null;
}

export interface ValidatedCaptureRequest {
  paypalOrderId: string;
  ppwOrderId: string;
}

export function validateCaptureRequest(
  payload: unknown,
): { ok: true; data: ValidatedCaptureRequest } | { ok: false; error: string } {
  if (!payload || typeof payload !== 'object') return { ok: false, error: 'Invalid request body.' };
  const p = payload as Partial<ValidatedCaptureRequest>;
  if (typeof p.paypalOrderId !== 'string' || p.paypalOrderId.length === 0) {
    return { ok: false, error: 'paypalOrderId required.' };
  }
  if (typeof p.ppwOrderId !== 'string' || p.ppwOrderId.length === 0) {
    return { ok: false, error: 'ppwOrderId required.' };
  }
  return {
    ok: true,
    data: { paypalOrderId: p.paypalOrderId, ppwOrderId: p.ppwOrderId },
  };
}

interface PaypalCaptureResponse {
  id?: string;
  status?: string;
  payer?: {
    email_address?: string;
    name?: { given_name?: string; surname?: string };
  };
  purchase_units?: Array<{
    // PayPal echoes the items[] array we sent at create-order time when it
    // returns the capture response — recordOrderItemsForOrder reads them.
    items?: PaypalCaptureItem[];
    custom_id?: string;
    payments?: {
      captures?: Array<{
        id?: string;
        status?: string;
        custom_id?: string;
        amount?: { currency_code?: string; value?: string };
      }>;
    };
  }>;
}

/**
 * Buyer email precedence (IMPL-1 defect 5): the email collected at OUR
 * checkout (packed into `custom_id` at create-order time) wins over the
 * PayPal account email, which may be a different address entirely.
 */
export function extractBuyerEmail(capture: PaypalCaptureResponse): string {
  const pu = capture.purchase_units?.[0];
  const customId = pu?.payments?.captures?.[0]?.custom_id ?? pu?.custom_id;
  const parsed = parsePaypalCustomId(customId);
  if (parsed.email) return parsed.email;
  return capture.payer?.email_address ?? '';
}

/** True when a PayPal error body says the order was ALREADY captured —
 *  the retry-safe outcome of the client re-invoking capture. */
export function isAlreadyCapturedError(body: unknown): boolean {
  if (!body || typeof body !== 'object') return false;
  const details = (body as { details?: Array<{ issue?: string }> }).details;
  if (!Array.isArray(details)) return false;
  return details.some((d) => d?.issue === 'ORDER_ALREADY_CAPTURED');
}

/**
 * DB writer split out so tests can inject a no-op when DATABASE_URL is
 * unset. Returns true if the row was upserted, false if the DB layer
 * isn't reachable (still a 200 response - capture is the source of
 * truth, the order row is a convenience mirror).
 */
export async function recordCapturedOrder(
  ppwOrderId: string,
  paypalOrderId: string,
  capture: PaypalCaptureResponse,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const db = getDb();
    const cap = capture.purchase_units?.[0]?.payments?.captures?.[0];
    const amountStr = cap?.amount?.value ?? '0';
    const currency = cap?.amount?.currency_code ?? 'USD';
    // Minor units for ALL currencies (Phase 0 wire-contract) — PayPal
    // returns a 2-decimal major string, so ×100 unconditionally.
    const totalMinor = Math.round(parseFloat(amountStr) * 100);
    const customerEmail = extractBuyerEmail(capture);
    await db.execute(sql`
      INSERT INTO orders (ppw_order_id, customer_email, currency, total_minor, payment_rail, payment_rail_order_id, payment_status, raw_payload)
      VALUES (${ppwOrderId}, ${customerEmail}, ${currency}, ${totalMinor}, ${'paypal'}, ${paypalOrderId}, ${'captured'}, ${JSON.stringify(capture)}::jsonb)
      ON CONFLICT (ppw_order_id) DO UPDATE
        SET payment_status = EXCLUDED.payment_status,
            payment_rail_order_id = EXCLUDED.payment_rail_order_id,
            customer_email = CASE
              WHEN orders.customer_email IS NULL OR orders.customer_email = ''
                THEN EXCLUDED.customer_email
              ELSE orders.customer_email
            END,
            raw_payload = EXCLUDED.raw_payload,
            updated_at = NOW()
    `);
    void orders; // schema reference for future typed inserts
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message.slice(0, 200) : 'DB write failed';
    return { ok: false, error: message };
  }
}

/**
 * Resolve the AUTHORITATIVE PPW order ref for a capture (review P2):
 * the orderRef packed into `custom_id` at create-order time wins over
 * the client-supplied ppwOrderId — a tampered client (or cross-tab ref
 * swap) can no longer record a capture under an arbitrary order ref.
 */
export function resolveAuthoritativeOrderRef(
  capture: PaypalCaptureResponse,
  clientRef: string,
): string {
  const pu = capture.purchase_units?.[0];
  const customId = pu?.payments?.captures?.[0]?.custom_id ?? pu?.custom_id;
  const parsed = parsePaypalCustomId(customId);
  if (parsed.orderRef && parsed.orderRef.length > 0) {
    if (parsed.orderRef !== clientRef) {
      // eslint-disable-next-line no-console
      console.warn(
        `[paypal-capture] ppwOrderId mismatch: client sent ${clientRef}, custom_id says ${parsed.orderRef} — using custom_id`,
      );
    }
    return parsed.orderRef;
  }
  return clientRef;
}

type CaptureRecorder = (
  ppwOrderId: string,
  paypalOrderId: string,
  capture: PaypalCaptureResponse,
) => Promise<{ ok: boolean; error?: string }>;

/**
 * Post-capture finalisation chain: orders row upsert → order_items →
 * buyer email → merchant emails → payouts → referrals.
 *
 * IDEMPOTENT (review P1): recordOrderItemsForOrder now reports
 * `already_recorded` when rows exist for the order — in that case the
 * emails / payouts / referrals stages are SKIPPED (a previous
 * invocation completed past the items stage, and re-running the payout
 * recorder would double-pay merchants). This lets both the 422
 * ORDER_ALREADY_CAPTURED recovery path and the webhook capture
 * fallback re-invoke the chain safely.
 *
 * Residual gap (documented): if a previous invocation died BETWEEN the
 * order_items insert and the payout stage, a re-run skips payouts too.
 * Narrower than the original hole (die anywhere → nothing recorded);
 * closing it fully needs a per-stage ledger.
 *
 * All stages are non-fatal — capture is the authoritative outcome.
 */
export async function finalizeCapturedOrder(
  ppwOrderId: string,
  paypalOrderId: string,
  json: PaypalCaptureResponse,
  recorder: CaptureRecorder = recordCapturedOrder,
): Promise<void> {
  // Recorder failures are non-fatal - the webhook will reconcile.
  await recorder(ppwOrderId, paypalOrderId, json);

  // Wellness-Designer-App (f) part 2 — populate order_items from the
  // capture's purchase_units[].items[] so the payout + merchant-email
  // pipelines have data to operate on. Non-fatal; capture authoritative.
  let itemsAlreadyRecorded = false;
  try {
    const itemsSummary = await recordOrderItemsForOrder(ppwOrderId, json);
    itemsAlreadyRecorded = itemsSummary.skippedReason === 'already_recorded';
    if (!itemsSummary.ok) {
      // eslint-disable-next-line no-console
      console.error(
        '[wellness-designer-app (f) order-items-record] failed:',
        itemsSummary.error ?? itemsSummary.skippedReason,
      );
    } else if (itemsSummary.skippedSkus && itemsSummary.skippedSkus.length > 0) {
      // eslint-disable-next-line no-console
      console.warn(
        '[wellness-designer-app (f) order-items-record] SKUs not in catalog:',
        itemsSummary.skippedSkus.join(', '),
      );
    }
  } catch (itemsErr) {
    // eslint-disable-next-line no-console
    console.error(
      '[wellness-designer-app (f) order-items-record] unexpected:',
      itemsErr instanceof Error ? itemsErr.message : String(itemsErr),
    );
  }
  if (itemsAlreadyRecorded) {
    // A previous invocation already ran past the items stage — its
    // emails/payouts/referrals ran (or will not be doubled here).
    return;
  }

  // M9.A.2 — order-confirmed email. Best-effort; capture is the
  // authoritative outcome and the email is a courtesy. The dispatch
  // helper itself never re-throws, but we still defensively wrap
  // here in case the import path breaks.
  try {
    const cap = json.purchase_units?.[0]?.payments?.captures?.[0];
    const amountStr = cap?.amount?.value ?? '0';
    const currency = cap?.amount?.currency_code ?? 'USD';
    // Minor units for ALL currencies (Phase 0 wire-contract).
    const totalMinor = Math.round(parseFloat(amountStr) * 100);
    // Prefer the email collected at OUR checkout (custom_id) over the
    // PayPal account email.
    const extracted = extractBuyerEmail(json);
    const customerEmail = extracted.length > 0 ? extracted : null;
    const givenName = json.payer?.name?.given_name?.trim();
    const dispatch = await dispatchOrderConfirmedEmail({
      ppwOrderId,
      customerEmail,
      totalMinor,
      currency,
      customerName: givenName && givenName.length > 0 ? givenName : undefined,
    });
    if (dispatch.skippedReason === 'caller_caught') {
      // eslint-disable-next-line no-console
      console.error('[M9.A.2 order-confirmed-email] caught:', dispatch.error);
    }

    // Wellness-Designer-App (g) — merchant-side dispatch. Per unique
    // merchant in the order, fire a separate Resend email. Lookup
    // failures are non-fatal — capture is the authoritative outcome.
    try {
      const merchantRows = await fetchMerchantNotifyRowsForOrder(ppwOrderId);
      const customerGreetingName =
        givenName && givenName.length > 0
          ? givenName
          : customerEmail
            ? deriveGreetingName(customerEmail)
            : 'a customer';
      for (const row of merchantRows) {
        const merchantDispatch = await dispatchMerchantOrderConfirmedEmail({
          row,
          orderRef: ppwOrderId,
          customerGreetingName,
          currency,
        });
        if (merchantDispatch.skippedReason === 'caller_caught') {
          // eslint-disable-next-line no-console
          console.error(
            '[wellness-designer-app (g) merchant-order-confirmed-email] caught:',
            merchantDispatch.error,
          );
        }
      }
    } catch (merchantErr) {
      // eslint-disable-next-line no-console
      console.error(
        '[wellness-designer-app (g) merchant-order-confirmed-email] lookup failed:',
        merchantErr instanceof Error ? merchantErr.message : String(merchantErr),
      );
    }

    // Wellness-Designer-App (f) — payout_queue 5% / 95% split. No-op
    // when order_items is empty (current sandbox state); auto-fires
    // once order_items population lands. Failures are non-fatal.
    try {
      const summary = await recordPayoutsForOrder(ppwOrderId);
      if (!summary.ok) {
        // eslint-disable-next-line no-console
        console.error(
          '[wellness-designer-app (f) payout-record] failed:',
          summary.error ?? summary.skippedReason,
        );
      }
    } catch (payoutErr) {
      // eslint-disable-next-line no-console
      console.error(
        '[wellness-designer-app (f) payout-record] unexpected:',
        payoutErr instanceof Error ? payoutErr.message : String(payoutErr),
      );
    }

    // Wellness-Designer-App (f) closure — designer_referrals rows for
    // inbound Pattern-B cart purchases (one row per order line).
    // Idempotent via deterministic refCode + DB unique constraint.
    // Non-fatal — capture is the authoritative outcome.
    try {
      const refSummary = await recordReferralsForOrder(ppwOrderId);
      if (!refSummary.ok) {
        // eslint-disable-next-line no-console
        console.error(
          '[wellness-designer-app (f) referral-record] failed:',
          refSummary.error ?? refSummary.skippedReason,
        );
      }
    } catch (refErr) {
      // eslint-disable-next-line no-console
      console.error(
        '[wellness-designer-app (f) referral-record] unexpected:',
        refErr instanceof Error ? refErr.message : String(refErr),
      );
    }
  } catch (emailErr) {
    // eslint-disable-next-line no-console
    console.error(
      '[M9.A.2 order-confirmed-email] unexpected:',
      emailErr instanceof Error ? emailErr.message : String(emailErr),
    );
  }
}

/**
 * Public-for-tests core: take parsed body, optional fetch + recorder,
 * return the response shape.
 */
export async function processCaptureRequest(
  payload: unknown,
  fetchFn: typeof fetch = fetch,
  recorder: CaptureRecorder = recordCapturedOrder,
): Promise<
  | { status: 200; ok: true; paymentStatus: 'captured'; alreadyCaptured?: boolean }
  | { status: 400 | 500; error: string }
> {
  const v = validateCaptureRequest(payload);
  if (!v.ok) return { status: 400, error: v.error };
  let cfg;
  try {
    cfg = readPaypalEnv();
  } catch {
    return { status: 500, error: 'PayPal not configured' };
  }
  try {
    const res = await paypalFetch(
      `/v2/checkout/orders/${encodeURIComponent(v.data.paypalOrderId)}/capture`,
      { method: 'POST', body: '{}' },
      cfg,
      fetchFn,
    );
    if (!res.ok) {
      // Idempotent retry path (IMPL-1 defect 1): a second capture call on
      // an already-captured order gets a 422 ORDER_ALREADY_CAPTURED from
      // PayPal. Review P1 fix: do NOT assume "the first capture recorded
      // everything" — the first invocation may have died between the
      // PayPal capture succeeding and the recorder chain finishing
      // (Vercel timeout). GET the order and re-run the recorder chain
      // idempotently (the order_items `already_recorded` guard prevents
      // double emails/payouts when the first run DID complete).
      if (res.status === 422) {
        let errBody: unknown = null;
        try {
          errBody = await res.json();
        } catch {
          errBody = null;
        }
        if (isAlreadyCapturedError(errBody)) {
          try {
            const getRes = await paypalFetch(
              `/v2/checkout/orders/${encodeURIComponent(v.data.paypalOrderId)}`,
              { method: 'GET' },
              cfg,
              fetchFn,
            );
            if (getRes.ok) {
              const orderJson = (await getRes.json()) as PaypalCaptureResponse;
              if (orderJson.status === 'COMPLETED') {
                const orderRef = resolveAuthoritativeOrderRef(orderJson, v.data.ppwOrderId);
                await finalizeCapturedOrder(orderRef, v.data.paypalOrderId, orderJson, recorder);
              }
            }
          } catch (recoveryErr) {
            // Recovery is best-effort — the capture itself IS complete.
            // eslint-disable-next-line no-console
            console.error(
              '[paypal-capture] already-captured recovery failed:',
              recoveryErr instanceof Error ? recoveryErr.message : String(recoveryErr),
            );
          }
          return { status: 200, ok: true, paymentStatus: 'captured', alreadyCaptured: true };
        }
      }
      return { status: 500, error: `PayPal capture failed: ${res.status}` };
    }
    const json = (await res.json()) as PaypalCaptureResponse;
    if (json.status !== 'COMPLETED') {
      return { status: 500, error: `PayPal capture status: ${json.status ?? 'unknown'}` };
    }
    // Review P2: the orderRef packed in custom_id at create-order time
    // is authoritative over the client-supplied ppwOrderId.
    const orderRef = resolveAuthoritativeOrderRef(json, v.data.ppwOrderId);
    await finalizeCapturedOrder(orderRef, v.data.paypalOrderId, json, recorder);
    return { status: 200, ok: true, paymentStatus: 'captured' };
  } catch (err) {
    const message = err instanceof Error ? err.message.slice(0, 200) : 'Capture failed.';
    return { status: 500, error: message };
  }
}

async function rawHandler(req: MinReq, res: MinRes): Promise<void> {
  const origin = typeof req.headers.origin === 'string' ? req.headers.origin : undefined;
  const cors = corsHeaders(origin);
  for (const [k, v] of Object.entries(cors)) res.setHeader(k, v);

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST, OPTIONS');
    res.status(405).end();
    return;
  }

  const body = await readJsonBody(req);
  if (body === null) {
    res.status(400);
    res.json({ error: 'Body must be valid JSON.' });
    return;
  }

  const result = await processCaptureRequest(body);
  if (result.status === 200) {
    res.status(200);
    res.json({
      ok: true,
      paymentStatus: 'captured',
      ...(result.alreadyCaptured ? { alreadyCaptured: true } : {}),
    });
    return;
  }
  res.status(result.status);
  res.json({ error: result.error });
}

export const handler = withSentry(rawHandler);

