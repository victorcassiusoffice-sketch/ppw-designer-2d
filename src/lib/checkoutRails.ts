/**
 * Checkout-rail seam — Phase 0 Gumroad interim rail (2026-08-04).
 *
 * MarketplaceCheckoutPage picks its payment rail here instead of
 * hard-coding PayPal. Selection is env-driven so rails can be flipped
 * without code changes:
 *
 *   VITE_GUMROAD_ENABLED=true → 'gumroad'  (the live direct-sale rail —
 *                                           PayPal account is banned)
 *   VITE_PAYPAL_ENABLED=true  → 'paypal'   (code retained, env-gated off)
 *   VITE_STRIPE_ENABLED=true  → 'stripe'   (code retained, env-gated off)
 *   nothing set               → 'paypal'   (legacy default — unchanged
 *                                           behaviour until envs are set)
 *
 * Precedence is gumroad > paypal > stripe when several are on.
 * Pure function over an injected env record so it is unit-testable
 * (import.meta.env is only touched by the convenience wrapper).
 */

export type CheckoutRail = 'gumroad' | 'paypal' | 'stripe';

export interface RailEnv {
  VITE_GUMROAD_ENABLED?: string | boolean;
  VITE_PAYPAL_ENABLED?: string | boolean;
  VITE_STRIPE_ENABLED?: string | boolean;
}

function isOn(v: string | boolean | undefined): boolean {
  if (v === true) return true;
  if (typeof v !== 'string') return false;
  const s = v.trim().toLowerCase();
  return s === 'true' || s === '1' || s === 'yes' || s === 'on';
}

export function resolveCheckoutRail(env: RailEnv): CheckoutRail {
  if (isOn(env.VITE_GUMROAD_ENABLED)) return 'gumroad';
  if (isOn(env.VITE_PAYPAL_ENABLED)) return 'paypal';
  if (isOn(env.VITE_STRIPE_ENABLED)) return 'stripe';
  return 'paypal';
}

/** Convenience wrapper for React components. */
export function activeCheckoutRail(): CheckoutRail {
  return resolveCheckoutRail(import.meta.env as unknown as RailEnv);
}

/** Buyer-facing button label per rail. */
export function railButtonLabel(rail: CheckoutRail, submitting: boolean): string {
  switch (rail) {
    case 'gumroad':
      return submitting ? 'Redirecting to secure checkout…' : 'Pay by card (USD via Gumroad)';
    case 'paypal':
      return submitting ? 'Redirecting to PayPal…' : 'Pay with PayPal';
    case 'stripe':
      return submitting ? 'Redirecting to Stripe…' : 'Pay by card (Stripe)';
  }
}
