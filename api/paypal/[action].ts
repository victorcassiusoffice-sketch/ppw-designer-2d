/**
 * Catch-all PayPal router — single Vercel function for /api/paypal/*.
 *
 * Consolidates 3 PayPal endpoints into one to fit the Hobby tier
 * 12-function cap. URL transparency preserved for backwards
 * compatibility via vercel.json rewrites:
 *   /api/createPaypalOrder  → /api/paypal/createOrder
 *   /api/capturePaypalOrder → /api/paypal/captureOrder
 *   /api/paypal-webhook     → /api/paypal/webhook
 */

import { handler as createOrderHandler } from '../lib/paypal/createOrder.js';
import { handler as captureOrderHandler } from '../lib/paypal/captureOrder.js';
import { handler as webhookHandler } from '../lib/paypal/webhook.js';

interface MinimalReq {
  method?: string;
  url?: string;
  headers: Record<string, string | string[] | undefined>;
  query?: Record<string, string | string[] | undefined>;
  body?: unknown;
}
interface MinimalRes {
  setHeader(name: string, value: string): void;
  status(code: number): MinimalRes;
  end(payload?: string): void;
  json(body: unknown): void;
}

function getAction(req: MinimalReq): string | null {
  const q = req.query ?? {};
  const raw = q['action'];
  const v = Array.isArray(raw) ? raw[0] : raw;
  if (typeof v === 'string' && v) return v;
  if (req.url) {
    const path = req.url.split('?')[0] ?? '';
    const parts = path.split('/').filter(Boolean);
    // expect ['api','paypal', action]
    return parts[2] ?? null;
  }
  return null;
}

export default async function handler(req: MinimalReq, res: MinimalRes): Promise<void> {
  const action = getAction(req);
  if (action === 'createOrder') return createOrderHandler(req as never, res as never);
  if (action === 'captureOrder') return captureOrderHandler(req as never, res as never);
  if (action === 'webhook') return webhookHandler(req as never, res as never);
  res.status(404).json({ error: `unknown paypal action: ${action ?? '(empty)'}` });
}
