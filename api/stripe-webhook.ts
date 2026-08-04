/**
 * Vercel serverless function — Stripe webhook receiver.
 *
 * POST /api/stripe-webhook
 *
 * Required env vars:
 *   - STRIPE_SECRET_KEY
 *   - STRIPE_WEBHOOK_SECRET
 *   - RESEND_API_KEY (optional — dry-run if missing)
 *
 * Flow:
 *   1. Read raw body (we DISABLE Vercel body parsing — Stripe needs the
 *      exact bytes to verify the signature).
 *   2. Verify with `stripe.webhooks.constructEvent`.
 *   3. Dedupe via in-memory Set of event ids — Phase 2 swaps this for
 *      a Vercel KV (Upstash Redis) so multiple lambda instances dedupe
 *      coherently.
 *   4. Branch on event type. Email sends are awaited (we WANT them to
 *      finish before returning 200 — Phase 2 can swap to background
 *      function queue if latency matters).
 *   5. Return 200 fast on success, 4xx on bad signature, 5xx otherwise.
 *
 * Idempotency note: an in-memory Set works on a SINGLE warm lambda
 * instance. Vercel may spin up multiple — duplicates will slip through.
 * The customer won't be charged twice (Stripe handles that), but they
 * could receive duplicate emails. Phase 2 = KV-backed Set keyed on
 * Stripe event id.
 */

import Stripe from 'stripe';
import { withSentry, captureException, flushSentry } from "./_lib/sentry.js";
import {
  sendOrderConfirmation,
  sendOrderAlertToVic,
  sendPaymentFailedAlertToVic,
} from './_lib/email.js';
import type { OrderSummary, CustomerInfo, Currency } from './_lib/orderTypes.js';
import { recordWebhookEvent, deleteWebhookEvent } from './_lib/webhookDedupe.js';
import {
  recordStripeCheckoutOrder,
  type StripeSessionLike,
  type StripeOrderRecordSummary,
} from './_lib/stripe/recordStripeOrder.js';

// IMPORTANT — disables Vercel's default JSON body parser so we get the
// raw bytes Stripe signed.
export const config = {
  api: { bodyParser: false },
};

const STRIPE_API_VERSION = '2025-02-24.acacia' as const;

/** In-memory dedupe set. Cleared on cold start — Phase 2 = KV. */
const PROCESSED_EVENTS = new Set<string>();
const MAX_PROCESSED = 1000;

function rememberEvent(id: string): void {
  PROCESSED_EVENTS.add(id);
  if (PROCESSED_EVENTS.size > MAX_PROCESSED) {
    // Trim oldest 100 — cheap-and-cheerful.
    const it = PROCESSED_EVENTS.values();
    for (let i = 0; i < 100; i++) {
      const v = it.next();
      if (v.done) break;
      PROCESSED_EVENTS.delete(v.value);
    }
  }
}

/** Test-only: reset the dedupe Set. */
export function _resetWebhookStateForTests(): void {
  PROCESSED_EVENTS.clear();
}

/**
 * Thrown by dispatchEvent when the ORDER PERSISTENCE step of a paid
 * checkout fails (review P1). The handler responds by un-recording the
 * dedupe row and returning 500 so Stripe's ~3-day retry loop can heal
 * the order — instead of the old behaviour (swallow + 200) which
 * permanently lost the orders/order_items/payout rows on a transient
 * Neon blip.
 */
export class OrderPersistError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OrderPersistError';
  }
}

interface NodeReadable {
  on(event: 'data', cb: (chunk: Buffer | string) => void): void;
  on(event: 'end', cb: () => void): void;
  on(event: 'error', cb: (err: Error) => void): void;
}

/** Read the raw request body as a Buffer — required for signature verify. */
export async function readRawBody(req: NodeReadable): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk) => {
      chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

interface CheckoutSessionLineItem {
  description?: string | null;
  quantity?: number | null;
  amount_total?: number | null;
  amount_subtotal?: number | null;
  currency?: string | null;
}

/**
 * Build a lean OrderSummary from a `checkout.session.completed` event.
 * Designed to be tolerant of missing fields — we only fail if we can't
 * find an email + an order id.
 */
export function buildOrderSummaryFromSession(
  session: Stripe.Checkout.Session,
  expandedLineItems?: CheckoutSessionLineItem[],
): OrderSummary | null {
  const md = session.metadata ?? {};
  const orderId = (md.orderId as string) || session.id;
  const email =
    session.customer_details?.email ||
    session.customer_email ||
    '';
  const currency = (session.currency ?? 'usd').toUpperCase() as Currency;
  // Phase 0 wire-contract: amounts are minor units for ALL currencies
  // (MUR is a 2-decimal currency in Stripe) — ÷100 unconditionally.
  const total = (session.amount_total ?? 0) / 100;

  let property: OrderSummary['property'];
  if (md.property && typeof md.property === 'string' && md.property.length > 0) {
    try {
      property = JSON.parse(md.property);
    } catch {
      property = undefined;
    }
  }

  // We can't fully reconstruct customer fields from Stripe — pull what
  // we can, fall back to address JSON we stashed in metadata.
  let parsedAddress: Partial<CustomerInfo> = {};
  if (md.customer_address && typeof md.customer_address === 'string') {
    try {
      parsedAddress = JSON.parse(md.customer_address);
    } catch {
      parsedAddress = {};
    }
  }
  const customer: CustomerInfo = {
    name: session.customer_details?.name ?? '',
    email,
    phone: session.customer_details?.phone ?? (md.customer_phone as string) ?? '',
    addressLine1: parsedAddress.addressLine1 ?? (parsedAddress as { line1?: string }).line1 ?? '',
    addressLine2: parsedAddress.addressLine2 ?? (parsedAddress as { line2?: string }).line2 ?? '',
    city: parsedAddress.city ?? '',
    postcode: parsedAddress.postcode ?? '',
    country: parsedAddress.country ?? session.customer_details?.address?.country ?? '',
    notes: (md.notes as string) || '',
  };

  const lines = (expandedLineItems ?? []).map((li) => ({
    name: li.description ?? 'Item',
    quantity: li.quantity ?? 1,
    unitAmount: li.amount_total && li.quantity ? Math.round(li.amount_total / li.quantity) : 0,
    currency: ((li.currency ?? session.currency ?? 'usd').toUpperCase()) as Currency,
  }));

  if (!email) return null;
  return { id: orderId, total, currency, customer, lines, property };
}

interface MinimalReq extends NodeReadable {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
}
interface MinimalRes {
  setHeader(name: string, value: string): void;
  status(code: number): MinimalRes;
  end(payload?: string): void;
  json(body: unknown): void;
}

/** Vercel function entry point. */
async function handler(req: MinimalReq, res: MinimalRes): Promise<void> {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).end();
    return;
  }

  const secret = process.env.STRIPE_SECRET_KEY;
  const whSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret || !whSecret) {
    res.status(500);
    res.json({ error: 'Webhook receiver not configured.' });
    return;
  }

  const signature = req.headers['stripe-signature'];
  if (!signature || Array.isArray(signature)) {
    res.status(400);
    res.json({ error: 'Missing signature.' });
    return;
  }

  let raw: Buffer;
  try {
    raw = await readRawBody(req);
  } catch {
    res.status(400);
    res.json({ error: 'Failed to read request body.' });
    return;
  }

  const stripe = new Stripe(secret, { apiVersion: STRIPE_API_VERSION });
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(raw, signature, whSecret);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Bad signature.';
    res.status(400);
    res.json({ error: msg });
    return;
  }

  // P2-6: durable, multi-instance-safe idempotency via the `webhook_events`
  // unique (source, event_id) constraint (same path as the PayPal webhook) —
  // replaces the old single-lambda in-memory Set. If the DB is unreachable we
  // fall back to the in-memory Set so a transient outage degrades to the old
  // behaviour rather than processing nothing.
  let alreadyProcessed = false;
  let dedupeInDb = false;
  try {
    const dedupe = await recordWebhookEvent('stripe', event.id, event.type, event);
    alreadyProcessed = dedupe.alreadyProcessed;
    dedupeInDb = true;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[stripe-webhook] DB dedupe unavailable — in-memory fallback', err);
    if (PROCESSED_EVENTS.has(event.id)) alreadyProcessed = true;
    else rememberEvent(event.id);
  }
  if (alreadyProcessed) {
    // Already processed — Stripe retries every 5s for up to ~3 days.
    res.status(200);
    res.json({ ok: true, deduped: true });
    return;
  }

  // Non-money failures (emails): the event is already recorded as
  // processed above, so a throw would 500 → Stripe retries → the retry
  // gets deduped → the emails are silently lost with no signal. Capture
  // to Sentry + return 200 instead. MONEY failures (OrderPersistError,
  // review P1): un-record the dedupe row + 500 so Stripe redelivers and
  // the order persistence is retried until Neon recovers.
  try {
    await dispatchEvent(event, stripe);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[stripe-webhook] dispatchEvent failed after dedupe record', err);
    captureException(err, { eventId: event.id, eventType: event.type });
    await flushSentry(2000);
    if (err instanceof OrderPersistError) {
      // Roll back the dedupe record (DB row or in-memory) so the Stripe
      // redelivery is NOT deduped, then 5xx to trigger it.
      if (dedupeInDb) {
        try {
          await deleteWebhookEvent('stripe', event.id);
        } catch {
          // DB still down — the in-memory fallback below still lets a
          // redelivery through on this instance; a different instance
          // has no memory of the event at all.
        }
      }
      PROCESSED_EVENTS.delete(event.id);
      res.status(500);
      res.json({ error: 'order persistence failed — retry' });
      return;
    }
    res.status(200);
    res.json({ ok: true, dispatch: 'failed' });
    return;
  }

  res.status(200);
  res.json({ ok: true });
}

/**
 * Branch on event type. Exported for tests so they don't need to fake
 * the raw-body path.
 */
export async function dispatchEvent(
  event: Stripe.Event,
  stripe: Pick<Stripe, 'checkout'>,
  orderRecorder: (session: StripeSessionLike) => Promise<StripeOrderRecordSummary> = recordStripeCheckoutOrder,
): Promise<void> {
  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;

      // IMPL-1 defect 6 — persist the order (orders + order_items +
      // payouts + referrals) BEFORE emails. Review P1 upgrade: order
      // persistence failure is FATAL to the webhook response — throw
      // OrderPersistError (before any email goes out) so the handler
      // un-records the dedupe row and 5xxes for a Stripe redelivery.
      // recordStripeCheckoutOrder returns ok:false ONLY when the orders
      // upsert itself failed (transient DB error) — downstream
      // items/payouts failures stay non-fatal inside the recorder.
      try {
        const rec = await orderRecorder(session as unknown as StripeSessionLike);
        if (!rec.ok) {
          // eslint-disable-next-line no-console
          console.error('[stripe-webhook] order record failed:', rec.error);
          throw new OrderPersistError(rec.error ?? 'order upsert failed');
        }
      } catch (recErr) {
        if (recErr instanceof OrderPersistError) throw recErr;
        // eslint-disable-next-line no-console
        console.error(
          '[stripe-webhook] order record unexpected:',
          recErr instanceof Error ? recErr.message : String(recErr),
        );
        throw new OrderPersistError(
          recErr instanceof Error ? recErr.message : 'order recorder threw',
        );
      }

      let lineItems: CheckoutSessionLineItem[] = [];
      try {
        const list = await stripe.checkout.sessions.listLineItems(session.id, { limit: 50 });
        lineItems = list.data.map((it) => ({
          description: it.description,
          quantity: it.quantity,
          amount_total: it.amount_total,
          amount_subtotal: it.amount_subtotal,
          currency: it.currency,
        }));
      } catch {
        // Non-fatal — we'll send confirmation without line detail.
      }
      const order = buildOrderSummaryFromSession(session, lineItems);
      if (!order) return;
      await Promise.all([
        sendOrderConfirmation(order.customer, order),
        sendOrderAlertToVic(order.customer, order),
      ]);
      return;
    }
    case 'payment_intent.payment_failed': {
      const pi = event.data.object as Stripe.PaymentIntent;
      const reason =
        pi.last_payment_error?.message ||
        pi.last_payment_error?.decline_code ||
        pi.last_payment_error?.code ||
        'Unknown';
      const currency = (pi.currency ?? 'usd').toUpperCase() as Currency;
      // Minor units for ALL currencies (Phase 0 wire-contract).
      const amount = (pi.amount ?? 0) / 100;
      await sendPaymentFailedAlertToVic({
        customerEmail:
          typeof pi.receipt_email === 'string'
            ? pi.receipt_email
            : pi.metadata?.email,
        orderId: pi.metadata?.orderId,
        reason,
        amount,
        currency,
      });
      return;
    }
    default:
      // No-op for unhandled event types. Stripe doesn't retry on 200.
      return;
  }
}

export default withSentry(handler);
