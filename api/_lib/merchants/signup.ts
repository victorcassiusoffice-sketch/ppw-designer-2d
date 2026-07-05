/**
 * Merchant signup handler — extracted from the deprecated lambda at
 * `api/merchants/signup.ts` into the library layer so the Sims-Parity
 * DT-02 `merchants-router.ts` catchall can dispatch to it while staying
 * inside the Hobby 12-fn cap.
 *
 * Behaviour is preserved verbatim from the prior lambda:
 *   • CORS allow-list (designer.ppwellness.co + preview + localhost).
 *   • OPTIONS preflight handled at 204.
 *   • Non-POST → 405.
 *   • Sliding-window rate limit (3 / IP / 10 min) via Upstash KV.
 *   • Body parsing identical (object | string | Buffer).
 *   • Stripe Connect branch — onboarding URL if available else manual.
 *   • Two response shapes (stripe_onboarding | manual_followup).
 *
 * Tests live at `api/__tests__/merchantSignup.test.ts` and exercise
 * the underlying `processMerchantSignup` pure-fn. The HTTP wrapper
 * here is exercised end-to-end by the merchants-router dispatch test.
 */

import { drizzleMerchantStore } from '../../_db/merchantStore.js';
import { getStripe, isStripeConnectAvailable } from '../stripeConnect.js';
import {
  liveEmailTransport,
  processMerchantSignup,
  type SignupOutcome,
} from '../merchantSignup.js';
import { merchantSignupLimiter, getClientIp } from '../rateLimit.js';

const ALLOWED_ORIGINS = new Set([
  'http://127.0.0.1:5173',
  'http://localhost:5173',
  'https://designer.ppwellness.co',
  'https://ppw-designer-2d.vercel.app',
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

interface MinimalReq {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  body?: unknown;
}
interface MinimalRes {
  setHeader(name: string, value: string): void;
  status(code: number): MinimalRes;
  end(payload?: string): void;
  json(body: unknown): void;
}

async function readJsonBody(req: MinimalReq): Promise<unknown> {
  const b = req.body;
  if (b === undefined || b === null) return {};
  if (typeof b === 'object' && !Buffer.isBuffer(b)) return b;
  if (typeof b === 'string') {
    try {
      return JSON.parse(b);
    } catch {
      return null;
    }
  }
  if (Buffer.isBuffer(b)) {
    try {
      return JSON.parse(b.toString('utf8'));
    } catch {
      return null;
    }
  }
  return null;
}

function publicMerchantView(outcome: SignupOutcome): Record<string, unknown> | null {
  if (!outcome.ok) return null;
  const m = outcome.merchant;
  return {
    id: m.id,
    slug: m.slug,
    businessName: m.businessName,
    status: m.status,
  };
}

export async function handler(req: MinimalReq, res: MinimalRes): Promise<void> {
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

  const ip = getClientIp(req);
  const verdict = await merchantSignupLimiter.check(ip);
  if (!verdict.success) {
    res.setHeader('Retry-After', String(verdict.retryAfterSec));
    res.setHeader('X-RateLimit-Limit', String(verdict.limit));
    res.setHeader('X-RateLimit-Remaining', String(verdict.remaining));
    res.status(429);
    res.json({ error: 'Too many signup attempts. Please try again later.' });
    return;
  }

  const body = await readJsonBody(req);
  if (body === null) {
    res.status(400);
    res.json({ error: 'Body must be valid JSON.' });
    return;
  }

  const publicBaseUrl =
    process.env.PUBLIC_BASE_URL ??
    process.env.VERCEL_URL ??
    'https://designer.ppwellness.co';
  const adminUrl = process.env.ADMIN_URL ?? `${publicBaseUrl.replace(/\/$/, '')}/admin/merchants`;

  const stripeAvailable = isStripeConnectAvailable();
  const stripe = stripeAvailable ? getStripe() : null;

  let store;
  try {
    store = drizzleMerchantStore();
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[merchant-signup] DB unavailable', err);
    res.status(500);
    res.json({ error: 'Signup is temporarily unavailable. Please try again later.' });
    return;
  }

  const outcome = await processMerchantSignup(body, {
    store,
    stripe,
    emails: liveEmailTransport,
    adminUrl,
    publicBaseUrl: publicBaseUrl.startsWith('http') ? publicBaseUrl : `https://${publicBaseUrl}`,
    stripeAvailable,
    log: (event, payload) => {
      // eslint-disable-next-line no-console
      console.log(`[merchant-signup] ${event}`, payload ?? '');
    },
  });

  if (!outcome.ok) {
    res.status(outcome.status);
    res.json({ error: outcome.error, issues: outcome.issues });
    return;
  }

  const merchantView = publicMerchantView(outcome);
  if (outcome.kind === 'stripe_onboarding') {
    res.status(200);
    res.json({
      kind: 'stripe_onboarding',
      merchant: merchantView,
      onboardingUrl: outcome.onboardingUrl,
    });
    return;
  }
  res.status(200);
  res.json({
    kind: 'manual_followup',
    merchant: merchantView,
    completeUrl: outcome.completeUrl,
  });
}
