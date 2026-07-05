/**
 * M5.b — merchant magic-link session tokens.
 *
 * Pure-fn HMAC sign/verify for the `/merchant/:slug` dashboard +
 * `/merchant/:slug/agent` route gate. No DB writes, no global state —
 * the token IS the session.
 *
 * Token shape:
 *   `<base64url(payloadJson)>.<hex(HMAC-SHA256(payloadJson))>`
 *
 *   where payloadJson = JSON.stringify({ slug, email, exp })
 *         exp        = ms epoch when the token expires (Date.now()-comparable)
 *
 * The signing secret comes from `MERCHANT_SESSION_SECRET` env. In a
 * production deployment that secret MUST be set; the dev fallback
 * (`'ppw-merchant-session-dev'`) only exists so local-dev runs without
 * the env crash. `readMerchantSessionSecret()` throws if you call it
 * inside a Vercel runtime without the env, so the magic-link endpoint
 * fails closed.
 *
 * `verifyMerchantSession` is constant-time (uses `timingSafeEqual` from
 * node:crypto) so a tampered signature can't be brute-forced via
 * timing leak.
 *
 * Why not Clerk? — M5.b is intentionally minimal (1-2 hour macro per
 * Vic's note). A Clerk merchant role + full org switcher is its own
 * future macro. Magic-link → opaque token → frontend gate is the
 * thinnest viable layer that closes the public-by-slug exposure
 * surfaced in macro-5-complete.
 */

import { createHmac, timingSafeEqual } from 'node:crypto';

export const DEFAULT_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const DEV_FALLBACK_SECRET = 'ppw-merchant-session-dev';

export interface MerchantSessionPayload {
  /** Merchant slug this session authorises. */
  slug: string;
  /** Verified contact email (for audit + display). */
  email: string;
  /** Expiry — milliseconds since epoch. */
  exp: number;
}

export type VerifyResult =
  | { ok: true; payload: MerchantSessionPayload }
  | { ok: false; reason: 'malformed' | 'bad_signature' | 'expired' | 'slug_mismatch' };

/**
 * Read the signing secret from process.env. Throws in production-like
 * envs (VERCEL_ENV set) if the env is missing — so the magic-link
 * endpoint refuses to issue session tokens it couldn't later verify.
 *
 * In local dev (no VERCEL_ENV) returns the dev fallback string so
 * `npm run dev` doesn't crash on first boot.
 */
export function readMerchantSessionSecret(): string {
  const fromEnv = (process.env.MERCHANT_SESSION_SECRET ?? '').trim();
  if (fromEnv) return fromEnv;
  if (process.env.VERCEL_ENV) {
    throw new Error('MERCHANT_SESSION_SECRET env var missing in deployed runtime');
  }
  return DEV_FALLBACK_SECRET;
}

function base64UrlEncode(input: string): string {
  return Buffer.from(input, 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function base64UrlDecode(input: string): string {
  const padded = input.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((input.length + 3) % 4);
  return Buffer.from(padded, 'base64').toString('utf8');
}

function sign(payloadJson: string, secret: string): string {
  return createHmac('sha256', secret).update(payloadJson).digest('hex');
}

export function signMerchantSession(
  payload: MerchantSessionPayload,
  secret: string = readMerchantSessionSecret(),
): string {
  const json = JSON.stringify(payload);
  const body = base64UrlEncode(json);
  const sig = sign(json, secret);
  return `${body}.${sig}`;
}

export function verifyMerchantSession(
  token: string,
  expectedSlug: string,
  now: number = Date.now(),
  secret: string = readMerchantSessionSecret(),
): VerifyResult {
  if (typeof token !== 'string' || !token.includes('.')) {
    return { ok: false, reason: 'malformed' };
  }
  const lastDot = token.lastIndexOf('.');
  const body = token.slice(0, lastDot);
  const providedSig = token.slice(lastDot + 1);
  if (!body || !providedSig) {
    return { ok: false, reason: 'malformed' };
  }
  let json: string;
  try {
    json = base64UrlDecode(body);
  } catch {
    return { ok: false, reason: 'malformed' };
  }
  let payload: MerchantSessionPayload;
  try {
    const parsed = JSON.parse(json);
    if (
      !parsed ||
      typeof parsed !== 'object' ||
      typeof parsed.slug !== 'string' ||
      typeof parsed.email !== 'string' ||
      typeof parsed.exp !== 'number'
    ) {
      return { ok: false, reason: 'malformed' };
    }
    payload = parsed as MerchantSessionPayload;
  } catch {
    return { ok: false, reason: 'malformed' };
  }
  const expectedSig = sign(json, secret);
  const a = Buffer.from(providedSig, 'hex');
  const b = Buffer.from(expectedSig, 'hex');
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { ok: false, reason: 'bad_signature' };
  }
  if (payload.slug !== expectedSlug) {
    return { ok: false, reason: 'slug_mismatch' };
  }
  if (payload.exp < now) {
    return { ok: false, reason: 'expired' };
  }
  return { ok: true, payload };
}

/**
 * Compose the magic-link URL the merchant clicks from their email.
 * Centralised so the email body + the test fixtures agree on shape.
 */
export function buildMagicLinkUrl(args: {
  /** Public origin, e.g. https://designer.ppwellness.co (no trailing slash). */
  origin: string;
  slug: string;
  token: string;
}): string {
  const u = new URL(`/merchant/${encodeURIComponent(args.slug)}`, args.origin);
  u.searchParams.set('session', args.token);
  return u.toString();
}
