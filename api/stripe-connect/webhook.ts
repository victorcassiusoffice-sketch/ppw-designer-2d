/**
 * POST /api/stripe-connect/webhook
 *
 * Receives Connect-platform events (`account.updated` etc.) from
 * Stripe. Distinct from the existing /api/stripe-webhook receiver,
 * which only handles platform-checkout events.
 *
 * Required env vars:
 *   - STRIPE_SECRET_KEY
 *   - STRIPE_WEBHOOK_SECRET_CONNECT   (the signing secret for the
 *     Connect endpoint — Vic registers a separate endpoint in the
 *     Stripe Dashboard and pastes that whsec into Vercel).
 *
 * Body parsing is disabled so we receive the exact bytes Stripe signed.
 */

import Stripe from 'stripe';
import { drizzleMerchantStore } from '../db/merchantStore';
import { STRIPE_API_VERSION, getConnectWebhookSecret } from '../lib/stripeConnect';
import { handleAccountUpdated } from '../lib/stripeConnectWebhook';

// Disable Vercel JSON parser — needed for signature verification.
export const config = {
  api: { bodyParser: false },
};

/** In-memory event dedupe — see api/stripe-webhook.ts for the same pattern. */
const PROCESSED_EVENTS = new Set<string>();
const MAX_PROCESSED = 1000;

function rememberEvent(id: string): void {
  PROCESSED_EVENTS.add(id);
  if (PROCESSED_EVENTS.size > MAX_PROCESSED) {
    const it = PROCESSED_EVENTS.values();
    for (let i = 0; i < 100; i++) {
      const v = it.next();
      if (v.done) break;
      PROCESSED_EVENTS.delete(v.value);
    }
  }
}

export function _resetConnectWebhookStateForTests(): void {
  PROCESSED_EVENTS.clear();
}

interface NodeReadable {
  on(event: 'data', cb: (chunk: Buffer | string) => void): void;
  on(event: 'end', cb: () => void): void;
  on(event: 'error', cb: (err: Error) => void): void;
}

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

export default async function handler(req: MinimalReq, res: MinimalRes): Promise<void> {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).end();
    return;
  }

  const secret = process.env.STRIPE_SECRET_KEY;
  const whSecret = getConnectWebhookSecret();
  if (!secret || !whSecret) {
    res.status(500);
    res.json({ error: 'Connect webhook receiver not configured.' });
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

  if (PROCESSED_EVENTS.has(event.id)) {
    res.status(200);
    res.json({ ok: true, deduped: true });
    return;
  }
  rememberEvent(event.id);

  const publicBaseUrl =
    process.env.PUBLIC_BASE_URL ?? 'https://designer.ppwellness.co';
  const adminUrl =
    process.env.ADMIN_URL ?? `${publicBaseUrl.replace(/\/$/, '')}/admin/merchants`;

  try {
    const store = drizzleMerchantStore();
    const outcome = await handleAccountUpdated(event, {
      store,
      adminUrl,
      log: (e, p) => {
        // eslint-disable-next-line no-console
        console.log(`[stripe-connect-webhook] ${e}`, p ?? '');
      },
    });
    if (!outcome.ok) {
      res.status(500);
      res.json({ error: outcome.reason });
      return;
    }
    res.status(200);
    res.json({ ok: true, outcome });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[stripe-connect-webhook] handler error', err);
    res.status(500);
    res.json({ error: 'Webhook handler failed.' });
  }
}
