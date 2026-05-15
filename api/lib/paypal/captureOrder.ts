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
import { getDb } from '../../db/client.js';
import { orders } from '../../db/schema.js';
import { sql } from 'drizzle-orm';

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
  purchase_units?: Array<{
    payments?: {
      captures?: Array<{
        id?: string;
        status?: string;
        amount?: { currency_code?: string; value?: string };
      }>;
    };
  }>;
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
    const totalMinor = Math.round(parseFloat(amountStr) * (currency === 'MUR' ? 1 : 100));
    await db.execute(sql`
      INSERT INTO orders (ppw_order_id, customer_email, currency, total_minor, payment_rail, payment_rail_order_id, payment_status, raw_payload)
      VALUES (${ppwOrderId}, ${''}, ${currency}, ${totalMinor}, ${'paypal'}, ${paypalOrderId}, ${'captured'}, ${JSON.stringify(capture)}::jsonb)
      ON CONFLICT (ppw_order_id) DO UPDATE
        SET payment_status = EXCLUDED.payment_status,
            payment_rail_order_id = EXCLUDED.payment_rail_order_id,
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
 * Public-for-tests core: take parsed body, optional fetch + recorder,
 * return the response shape.
 */
export async function processCaptureRequest(
  payload: unknown,
  fetchFn: typeof fetch = fetch,
  recorder: (
    ppwOrderId: string,
    paypalOrderId: string,
    capture: PaypalCaptureResponse,
  ) => Promise<{ ok: boolean; error?: string }> = recordCapturedOrder,
): Promise<
  | { status: 200; ok: true; paymentStatus: 'captured' }
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
      return { status: 500, error: `PayPal capture failed: ${res.status}` };
    }
    const json = (await res.json()) as PaypalCaptureResponse;
    if (json.status !== 'COMPLETED') {
      return { status: 500, error: `PayPal capture status: ${json.status ?? 'unknown'}` };
    }
    // Recorder failures are non-fatal - the webhook will reconcile.
    await recorder(v.data.ppwOrderId, v.data.paypalOrderId, json);
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
    res.json({ ok: true, paymentStatus: 'captured' });
    return;
  }
  res.status(result.status);
  res.json({ error: result.error });
}

const handler = withSentry(rawHandler);
export default handler;
