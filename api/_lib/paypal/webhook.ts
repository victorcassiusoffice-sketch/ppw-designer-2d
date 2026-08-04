/**
 * Vercel serverless function - PayPal webhook receiver.
 *
 * POST /api/paypal-webhook
 *
 * Required env vars:
 *   - PAYPAL_CLIENT_ID
 *   - PAYPAL_CLIENT_SECRET
 *   - PAYPAL_ENV ('sandbox' | 'live')
 *   - PAYPAL_WEBHOOK_ID
 *
 * Flow:
 *   1. Read raw body + capture PayPal signature headers.
 *   2. Call PayPal's signature-verification API
 *      (POST /v1/notifications/verify-webhook-signature) with our
 *      configured PAYPAL_WEBHOOK_ID. Reject if verification_status !=
 *      'SUCCESS'.
 *   3. Record the event in `webhook_events` (UNIQUE on source+event_id
 *      makes this idempotent under concurrent lambda).
 *   4. Branch on event_type:
 *       - CHECKOUT.ORDER.APPROVED        -> server-side capture fallback
 *                                           (buyer may never hit the
 *                                           return page — scenario d)
 *       - PAYMENT.CAPTURE.COMPLETED      -> mark order captured
 *       - PAYMENT.CAPTURE.DENIED         -> mark order failed
 *       - PAYMENT.CAPTURE.REFUNDED       -> mark order refunded
 *   5. Return 200 on success or already-processed; 4xx on bad sig;
 *      5xx otherwise.
 *
 * The exported `dispatchPaypalEvent` is the post-verification core -
 * tests target it directly without faking the Node Readable.
 */

import { withSentry, type MinReq, type MinRes } from '../sentry.js';
import { readPaypalEnv, paypalFetch } from '../paypalClient.js';
import { parsePaypalCustomId } from './customId.js';
import { processCaptureRequest } from './captureOrder.js';
import { recordWebhookEvent } from '../webhookDedupe.js';
import { getDb } from '../../_db/client.js';
import { sql } from 'drizzle-orm';

// IMPORTANT - PayPal's signature scheme requires the raw bytes. We
// disable Vercel's default body parser.
export const config = {
  api: { bodyParser: false },
};

interface NodeReadable {
  on(event: 'data', cb: (chunk: Buffer | string) => void): void;
  on(event: 'end', cb: () => void): void;
  on(event: 'error', cb: (err: Error) => void): void;
}

export async function readRawBody(req: NodeReadable): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (c) => chunks.push(typeof c === 'string' ? Buffer.from(c) : c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

export interface PaypalWebhookHeaders {
  authAlgo: string;
  certUrl: string;
  transmissionId: string;
  transmissionSig: string;
  transmissionTime: string;
}

export function extractHeaders(
  hdr: Record<string, string | string[] | undefined>,
): PaypalWebhookHeaders | null {
  const get = (k: string): string | null => {
    const v = hdr[k] ?? hdr[k.toLowerCase()];
    if (Array.isArray(v)) return v[0] ?? null;
    if (typeof v === 'string') return v;
    return null;
  };
  const authAlgo = get('paypal-auth-algo');
  const certUrl = get('paypal-cert-url');
  const transmissionId = get('paypal-transmission-id');
  const transmissionSig = get('paypal-transmission-sig');
  const transmissionTime = get('paypal-transmission-time');
  if (!authAlgo || !certUrl || !transmissionId || !transmissionSig || !transmissionTime) return null;
  return { authAlgo, certUrl, transmissionId, transmissionSig, transmissionTime };
}

/**
 * Call PayPal's verify-webhook-signature endpoint. Returns true iff
 * verification_status === 'SUCCESS'.
 */
export async function verifyWebhookSignature(
  headers: PaypalWebhookHeaders,
  rawBody: string,
  webhookId: string,
  fetchFn: typeof fetch = fetch,
): Promise<boolean> {
  // The webhook_event field must be the PARSED event - PayPal verifies
  // against the canonical JSON, not the raw string.
  let parsedEvent: unknown;
  try {
    parsedEvent = JSON.parse(rawBody);
  } catch {
    return false;
  }
  const verifyBody = {
    auth_algo: headers.authAlgo,
    cert_url: headers.certUrl,
    transmission_id: headers.transmissionId,
    transmission_sig: headers.transmissionSig,
    transmission_time: headers.transmissionTime,
    webhook_id: webhookId,
    webhook_event: parsedEvent,
  };
  const cfg = readPaypalEnv();
  const res = await paypalFetch(
    '/v1/notifications/verify-webhook-signature',
    { method: 'POST', body: JSON.stringify(verifyBody) },
    cfg,
    fetchFn,
  );
  if (!res.ok) return false;
  const json = (await res.json()) as { verification_status?: string };
  return json.verification_status === 'SUCCESS';
}

export interface PaypalEvent {
  id?: string;
  event_type?: string;
  resource?: {
    id?: string;
    status?: string;
    custom_id?: string;
    invoice_id?: string;
    amount?: { currency_code?: string; value?: string };
    supplementary_data?: { related_ids?: { order_id?: string } };
    purchase_units?: Array<{ reference_id?: string; custom_id?: string }>;
  };
  [k: string]: unknown;
}

/**
 * Server-side capture fallback (review P1, scenario d): a buyer who
 * approves at PayPal but never lands back on our return page used to
 * be silently lost — intent=CAPTURE orders are NOT auto-captured, so
 * no PAYMENT.CAPTURE.COMPLETED ever fires and the approval expires in
 * ~3 days with no order row, no email, no alert.
 *
 * On a verified, deduped CHECKOUT.ORDER.APPROVED we now capture
 * server-side through the SAME processCaptureRequest pipeline the
 * browser return leg uses. Racing the return leg is safe: whichever
 * side captures second gets ORDER_ALREADY_CAPTURED → idempotent
 * recovery (order_items `already_recorded` guard prevents double
 * payouts/emails).
 */
export type ApprovedCaptureFn = (
  payload: { paypalOrderId: string; ppwOrderId: string },
) => Promise<unknown>;

const defaultApprovedCapture: ApprovedCaptureFn = (payload) =>
  processCaptureRequest(payload);

export async function captureApprovedOrder(
  event: PaypalEvent,
  captureFn: ApprovedCaptureFn = defaultApprovedCapture,
): Promise<{ attempted: boolean }> {
  const r = event.resource ?? {};
  // For CHECKOUT.ORDER.APPROVED the resource IS the order object.
  const paypalOrderId = r.id ?? null;
  const pu = r.purchase_units?.[0];
  const ppwOrderId =
    pu?.reference_id ||
    parsePaypalCustomId(pu?.custom_id).orderRef ||
    parsePaypalCustomId(r.custom_id).orderRef ||
    r.invoice_id ||
    null;
  if (!paypalOrderId || !ppwOrderId) return { attempted: false };
  try {
    await captureFn({ paypalOrderId, ppwOrderId });
    return { attempted: true };
  } catch (err) {
    // Best-effort — the browser return leg remains the primary path.
    // eslint-disable-next-line no-console
    console.error(
      '[paypal-webhook] approved-order capture fallback failed:',
      err instanceof Error ? err.message : String(err),
    );
    return { attempted: true };
  }
}

/**
 * Update the orders row based on a verified, deduped event. Split out
 * for tests. We don't crash on DB errors - they're logged and reported
 * via the return value, the webhook still returns 200 because PayPal
 * will retry if we 5xx and we don't want infinite retries on a
 * transient DB hiccup.
 */
export async function applyEventToOrder(event: PaypalEvent): Promise<{ updated: boolean; error?: string }> {
  const type = event.event_type;
  if (!type) return { updated: false };
  const r = event.resource ?? {};
  // PayPal puts our custom_id (packed `orderRef|email` — see customId.ts)
  // on capture resources, and `purchase_units[0].reference_id` on orders.
  const fromCustomId = parsePaypalCustomId(r.custom_id);
  const ppwOrderId =
    fromCustomId.orderRef ||
    r.invoice_id ||
    r.purchase_units?.[0]?.reference_id ||
    null;
  const customerEmail = fromCustomId.email ?? '';
  const paypalRailId = r.supplementary_data?.related_ids?.order_id || r.id || null;

  let nextStatus: 'captured' | 'failed' | 'refunded' | null = null;
  switch (type) {
    case 'PAYMENT.CAPTURE.COMPLETED':
      nextStatus = 'captured';
      break;
    case 'PAYMENT.CAPTURE.DENIED':
      nextStatus = 'failed';
      break;
    case 'PAYMENT.CAPTURE.REFUNDED':
      nextStatus = 'refunded';
      break;
    case 'CHECKOUT.ORDER.APPROVED':
      // Approval-only event - capture happens via the user-redirect.
      return { updated: false };
    default:
      return { updated: false };
  }
  if (!ppwOrderId || !nextStatus) return { updated: false };
  try {
    const db = getDb();
    await db.execute(sql`
      INSERT INTO orders (ppw_order_id, customer_email, currency, total_minor, payment_rail, payment_rail_order_id, payment_status, raw_payload)
      VALUES (${ppwOrderId}, ${customerEmail}, ${r.amount?.currency_code ?? 'USD'}, ${Math.round(parseFloat(r.amount?.value ?? '0') * 100)}, ${'paypal'}, ${paypalRailId}, ${nextStatus}, ${JSON.stringify(event)}::jsonb)
      ON CONFLICT (ppw_order_id) DO UPDATE
        SET payment_status = EXCLUDED.payment_status,
            payment_rail_order_id = COALESCE(EXCLUDED.payment_rail_order_id, orders.payment_rail_order_id),
            customer_email = CASE
              WHEN orders.customer_email IS NULL OR orders.customer_email = ''
                THEN EXCLUDED.customer_email
              ELSE orders.customer_email
            END,
            raw_payload = EXCLUDED.raw_payload,
            updated_at = NOW()
    `);
    return { updated: true };
  } catch (err) {
    return { updated: false, error: err instanceof Error ? err.message.slice(0, 200) : 'DB write failed' };
  }
}

/**
 * Post-verification dispatch core. Idempotent via `webhook_events`
 * table. Tests target this directly.
 */
export async function dispatchPaypalEvent(
  event: PaypalEvent,
  approvedCaptureFn: ApprovedCaptureFn = defaultApprovedCapture,
): Promise<{ ok: true; alreadyProcessed: boolean; updated: boolean }> {
  const id = event.id;
  const type = event.event_type;
  if (!id || !type) {
    throw new Error('PayPal event missing id or event_type');
  }
  let dedupe;
  try {
    dedupe = await recordWebhookEvent('paypal', id, type, event);
  } catch {
    // If the DB is down, we still want to ack so PayPal stops retrying
    // an undeliverable webhook. The capture endpoint is the
    // happy-path source of truth.
    return { ok: true, alreadyProcessed: false, updated: false };
  }
  if (dedupe.alreadyProcessed) {
    return { ok: true, alreadyProcessed: true, updated: false };
  }
  if (type === 'CHECKOUT.ORDER.APPROVED') {
    // Server-side capture fallback — see captureApprovedOrder docs.
    await captureApprovedOrder(event, approvedCaptureFn);
    return { ok: true, alreadyProcessed: false, updated: false };
  }
  const r = await applyEventToOrder(event);
  return { ok: true, alreadyProcessed: false, updated: r.updated };
}

async function rawHandler(req: MinReq, res: MinRes): Promise<void> {
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST, OPTIONS');
    res.status(405).end();
    return;
  }
  const webhookId = (process.env.PAYPAL_WEBHOOK_ID ?? '').trim();
  if (!webhookId) {
    res.status(500);
    res.json({ error: 'PayPal webhook not configured.' });
    return;
  }
  const headers = extractHeaders(req.headers);
  if (!headers) {
    res.status(400);
    res.json({ error: 'Missing PayPal signature headers.' });
    return;
  }
  let rawBody: Buffer;
  try {
    rawBody = await readRawBody(req as unknown as NodeReadable);
  } catch {
    res.status(400);
    res.json({ error: 'Failed to read body.' });
    return;
  }
  const rawString = rawBody.toString('utf8');
  let verified = false;
  try {
    verified = await verifyWebhookSignature(headers, rawString, webhookId);
  } catch {
    verified = false;
  }
  if (!verified) {
    res.status(400);
    res.json({ error: 'Invalid signature.' });
    return;
  }
  let event: PaypalEvent;
  try {
    event = JSON.parse(rawString) as PaypalEvent;
  } catch {
    res.status(400);
    res.json({ error: 'Invalid JSON body.' });
    return;
  }
  await dispatchPaypalEvent(event);
  res.status(200);
  res.json({ ok: true });
}

export const handler = withSentry(rawHandler);

