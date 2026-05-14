/**
 * POST /api/merchants/signup
 *
 * Public endpoint hit by the /suppliers form. Validates the payload,
 * inserts a merchant row, optionally kicks off Stripe Connect Express
 * onboarding, and emails both Vic and the merchant.
 *
 * Response shapes (200):
 *   { kind: 'stripe_onboarding', merchant: {...}, onboardingUrl: string }
 *   { kind: 'manual_followup',  merchant: {...}, completeUrl: string }
 *
 * Errors:
 *   400 { error, issues? }   validation
 *   409 { error }            duplicate contact email
 *   500 { error }            DB or unexpected
 *
 * Phase 1 keeps the response merchant shape lean (id, slug, status)
 * to avoid leaking internal fields to the public form. Phase 2's
 * merchant portal will use a fuller shape behind Clerk auth.
 */

import { drizzleMerchantStore } from '../db/merchantStore.js';
import { getStripe, isStripeConnectAvailable } from '../lib/stripeConnect.js';
import {
  liveEmailTransport,
  processMerchantSignup,
  type SignupOutcome,
} from '../lib/merchantSignup.js';
import { merchantSignupLimiter, getClientIp } from '../lib/rateLimit.js';
import { withSentry } from '../lib/sentry.js';

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

/** Sanitised merchant view for the public response. */
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

async function handler(req: MinimalReq, res: MinimalRes): Promise<void> {
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

  // Rate limit: 3 signups / IP / 10 min. Sliding window via Upstash KV.
  // Per OMS §1.11. Limiter degrades open if KV creds are absent.
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

export default withSentry(handler);
