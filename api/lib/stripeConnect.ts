/**
 * Stripe Connect Express helpers — Phase 1 scaffold.
 *
 * Two operations:
 *   1. createExpressAccount({email, country, businessName})
 *   2. createOnboardingLink({accountId, returnUrl, refreshUrl})
 *
 * Both are pinned to the same API version used by the existing
 * checkout-session function so we don't fork the SDK behaviour across
 * endpoints.
 *
 * MU gating
 * ---------
 * `isStripeConnectAvailable()` reads `STRIPE_MU_SUPPORTED`. If unset
 * or not `'true'`, the signup endpoint skips the Stripe call and falls
 * back to a manual-followup path (status=awaiting_kyc, email to Vic).
 * This makes the whole flow function while the A.4 Mauritius
 * compliance reply is still pending — see OMS plan §A.4.
 */

import Stripe from 'stripe';

export const STRIPE_API_VERSION = '2025-02-24.acacia' as const;

export interface StripeConnectAccountInput {
  email: string;
  country: string;
  businessName: string;
}

export interface OnboardingLinkInput {
  accountId: string;
  returnUrl: string;
  refreshUrl: string;
}

/** True iff `STRIPE_MU_SUPPORTED=true` AND `STRIPE_SECRET_KEY` is set. */
export function isStripeConnectAvailable(env: NodeJS.ProcessEnv = process.env): boolean {
  const muOk = (env.STRIPE_MU_SUPPORTED ?? '').trim().toLowerCase() === 'true';
  const secret = (env.STRIPE_SECRET_KEY ?? '').trim();
  return muOk && secret.length > 0;
}

/** Build a Stripe client from env — throws if `STRIPE_SECRET_KEY` is missing. */
export function getStripe(env: NodeJS.ProcessEnv = process.env): Stripe {
  const secret = env.STRIPE_SECRET_KEY;
  if (!secret || secret.trim().length === 0) {
    throw new Error('STRIPE_SECRET_KEY is not configured');
  }
  return new Stripe(secret, { apiVersion: STRIPE_API_VERSION });
}

/**
 * Minimal surface we touch on the Stripe client. Tests pass a fake
 * that satisfies this without pulling the whole SDK.
 */
export type StripeAccountsClient = Pick<Stripe, 'accounts' | 'accountLinks'>;

export async function createExpressAccount(
  stripe: StripeAccountsClient,
  input: StripeConnectAccountInput,
): Promise<Stripe.Account> {
  return stripe.accounts.create({
    type: 'express',
    email: input.email,
    country: input.country,
    business_profile: { name: input.businessName },
    capabilities: {
      transfers: { requested: true },
      card_payments: { requested: true },
    },
  });
}

export async function createOnboardingLink(
  stripe: StripeAccountsClient,
  input: OnboardingLinkInput,
): Promise<Stripe.AccountLink> {
  return stripe.accountLinks.create({
    account: input.accountId,
    return_url: input.returnUrl,
    refresh_url: input.refreshUrl,
    type: 'account_onboarding',
  });
}

/**
 * Read the Stripe Connect-specific webhook secret (separate from the
 * checkout-session webhook secret already in use).
 */
export function getConnectWebhookSecret(env: NodeJS.ProcessEnv = process.env): string | null {
  const v = env.STRIPE_WEBHOOK_SECRET_CONNECT;
  return v && v.trim().length > 0 ? v.trim() : null;
}
