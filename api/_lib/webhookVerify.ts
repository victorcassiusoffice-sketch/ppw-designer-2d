/**
 * OMS Wave 4.5 — centralised webhook signature verification.
 *
 * One place to verify every inbound webhook signature so the security
 * surface area is auditable. Each provider has its own scheme:
 *
 *   - Stripe: timestamp-prefixed HMAC-SHA256 with replay window
 *     (handled separately by the Stripe SDK in api/stripe-webhook.ts +
 *     api/stripe-connect/webhook.ts; centralisation is documentary).
 *   - PayPal: webhook_id-based signature check via /v1/notifications/
 *     verify-webhook-signature (handled by api/_lib/paypalClient).
 *   - Merchant order-update (Wave 1.4): SHA256 HMAC of raw body using
 *     merchants.webhook_secret. Constant-time comparison.
 *
 * The verifier returns `{ ok, reason }` shape so callers can branch on
 * a typed reason rather than parsing error strings.
 */

import { createHmac, timingSafeEqual } from 'crypto';

export type VerifyResult = { ok: true } | { ok: false; reason: string };

/**
 * Generic SHA256 HMAC verifier used by the merchant order-update
 * webhook. Caller passes the raw body string, the provided signature
 * header value (with or without a `sha256=` prefix), and the shared
 * secret stored against the calling identity (e.g. merchants.webhook_secret).
 *
 * Guarantees:
 *   - Constant-time comparison via crypto.timingSafeEqual.
 *   - Length mismatch fails fast without allocating a Buffer the wrong
 *     size (timingSafeEqual throws on length mismatch).
 *   - Tolerant of lowercase/uppercase signatures and the `sha256=`
 *     prefix that some clients send.
 */
export function verifySharedSecretHmac(
  rawBody: string,
  signature: string | undefined,
  secret: string,
): VerifyResult {
  if (!signature) return { ok: false, reason: 'missing-signature' };
  if (!secret) return { ok: false, reason: 'no-secret' };
  const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
  const provided = signature.toLowerCase().replace(/^sha256=/, '');
  if (expected.length !== provided.length) return { ok: false, reason: 'length-mismatch' };
  try {
    const eq = timingSafeEqual(Buffer.from(expected, 'utf8'), Buffer.from(provided, 'utf8'));
    return eq ? { ok: true } : { ok: false, reason: 'mismatch' };
  } catch {
    return { ok: false, reason: 'compare-failed' };
  }
}
