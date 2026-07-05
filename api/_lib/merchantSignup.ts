/**
 * Merchant signup pure-business-logic core — exported for tests.
 *
 * The Vercel function in api/merchants/signup.ts is a thin wrapper that
 * builds the dependencies (DB store, Stripe client, email transport)
 * from env then delegates to `processMerchantSignup` here. Tests
 * inject fakes for all three.
 *
 * Flow:
 *   1. Zod-validate the incoming payload.
 *   2. Compute a unique slug from business_name.
 *   3. Insert merchant row with status=pending_signup.
 *   4. Branch on Stripe Connect availability:
 *        - Available  → create Stripe Express account + onboarding
 *          link, attach to merchant, set status=awaiting_kyc, return
 *          `{ onboardingUrl }`.
 *        - Unavailable → keep status=awaiting_kyc, no Stripe call,
 *          return `{ manualFollowup: true, completeUrl }`.
 *   5. Fire two emails: ack to merchant, alert to Vic. Email failures
 *      are non-fatal — we log them in the result but still return 200.
 */

import { z } from 'zod';
import type { Merchant } from '../_db/schema.js';
import type { MerchantStore } from '../_db/merchantStore.js';
import { uniqueSlug } from './slug.js';
import {
  createExpressAccount,
  createOnboardingLink,
  isStripeConnectAvailable,
  type StripeAccountsClient,
} from './stripeConnect.js';
import {
  emailMerchantSignupAcknowledged,
  emailVicNewSignup,
  type SendResult,
} from './merchantEmails.js';

export const PRODUCT_CATEGORIES = [
  'ice_baths',
  'sleep_pods',
  'ergo_chairs',
  'plants',
  'eco_office_kits',
  'other',
] as const;

export const merchantSignupSchema = z.object({
  businessName: z.string().trim().min(2).max(200),
  brandName: z.string().trim().min(1).max(200),
  country: z
    .string()
    .trim()
    .length(2)
    .toUpperCase()
    .default('MU'),
  contactName: z.string().trim().min(2).max(200),
  contactEmail: z.string().trim().toLowerCase().email().max(320),
  contactPhone: z
    .string()
    .trim()
    .min(6)
    .max(40)
    .regex(/^[+0-9()\-\s]+$/, 'Phone may only contain digits, spaces, +, (), -'),
  productCategories: z
    .array(z.enum(PRODUCT_CATEGORIES))
    .min(1, 'Choose at least one product category'),
  estimatedMonthlyVolume: z.string().trim().max(80).optional(),
  website: z
    .string()
    .trim()
    .max(500)
    .optional()
    .refine(
      (v) => !v || /^https?:\/\//i.test(v),
      'Website must start with http:// or https://',
    ),
  referralNotes: z.string().trim().max(2000).optional(),
});

export type MerchantSignupInput = z.input<typeof merchantSignupSchema>;
export type MerchantSignupParsed = z.output<typeof merchantSignupSchema>;

export interface MerchantSignupEmailTransport {
  ackMerchant(args: Parameters<typeof emailMerchantSignupAcknowledged>[0]): Promise<SendResult>;
  alertVic(args: Parameters<typeof emailVicNewSignup>[0]): Promise<SendResult>;
}

export const liveEmailTransport: MerchantSignupEmailTransport = {
  ackMerchant: emailMerchantSignupAcknowledged,
  alertVic: emailVicNewSignup,
};

export interface MerchantSignupDeps {
  store: MerchantStore;
  /** Stripe client OR null to force the MU-gated manual-followup path. */
  stripe: StripeAccountsClient | null;
  emails: MerchantSignupEmailTransport;
  adminUrl: string;
  /** Public base URL for return_url/refresh_url on the Stripe onboarding link. */
  publicBaseUrl: string;
  /** Optional override; defaults to `isStripeConnectAvailable()`. */
  stripeAvailable?: boolean;
  /** Optional logger — defaults to no-op. */
  log?: (event: string, payload?: unknown) => void;
}

export type SignupOutcome =
  | {
      ok: true;
      kind: 'stripe_onboarding';
      merchant: Merchant;
      onboardingUrl: string;
      emailResults: { ack: SendResult; vic: SendResult };
    }
  | {
      ok: true;
      kind: 'manual_followup';
      merchant: Merchant;
      completeUrl: string;
      emailResults: { ack: SendResult; vic: SendResult };
    }
  | {
      ok: false;
      status: 400 | 409 | 500;
      error: string;
      issues?: Array<{ path: string; message: string }>;
    };

const SIGNUP_COMPLETE_PATH = '/suppliers/signup/complete';
const SIGNUP_REFRESH_PATH = '/suppliers';

export async function processMerchantSignup(
  rawPayload: unknown,
  deps: MerchantSignupDeps,
): Promise<SignupOutcome> {
  const log = deps.log ?? (() => undefined);

  // 1. Validate payload.
  const parsed = merchantSignupSchema.safeParse(rawPayload);
  if (!parsed.success) {
    return {
      ok: false,
      status: 400,
      error: 'Invalid signup payload.',
      issues: parsed.error.issues.map((i) => ({
        path: i.path.join('.'),
        message: i.message,
      })),
    };
  }
  const data: MerchantSignupParsed = parsed.data;

  // 2. Reject duplicate signups by contact email — surface a friendly
  //    "you've already applied" rather than letting a 2nd row through.
  const existingByEmail = await deps.store.findByContactEmail(data.contactEmail);
  if (existingByEmail) {
    return {
      ok: false,
      status: 409,
      error: 'A signup with this contact email is already in the queue.',
    };
  }

  // 3. Compute a unique slug.
  let slug: string;
  try {
    slug = await uniqueSlug(data.brandName || data.businessName, async (candidate) => {
      const hit = await deps.store.findBySlug(candidate);
      return !!hit;
    });
  } catch (err) {
    log('signup_slug_error', err);
    return { ok: false, status: 500, error: 'Could not allocate merchant slug.' };
  }

  // 4. Insert the merchant.
  let merchant: Merchant;
  try {
    merchant = await deps.store.insert({
      slug,
      businessName: data.businessName,
      brandName: data.brandName,
      contactName: data.contactName,
      contactEmail: data.contactEmail,
      contactPhone: data.contactPhone,
      country: data.country,
      website: data.website ?? null,
      productCategories: data.productCategories.join(','),
      estimatedMonthlyVolume: data.estimatedMonthlyVolume ?? null,
      referralNotes: data.referralNotes ?? null,
      status: 'pending_signup',
    });
  } catch (err) {
    log('signup_insert_error', err);
    return { ok: false, status: 500, error: 'Could not record merchant signup.' };
  }

  // 5. Branch on Stripe availability.
  const stripeAvailable = deps.stripeAvailable ?? isStripeConnectAvailable();
  const baseUrl = deps.publicBaseUrl.replace(/\/$/, '');
  const completeUrl = `${baseUrl}${SIGNUP_COMPLETE_PATH}?m=${encodeURIComponent(merchant.slug)}`;
  const refreshUrl = `${baseUrl}${SIGNUP_REFRESH_PATH}?refresh=1`;

  const emailData = {
    businessName: merchant.businessName,
    contactName: merchant.contactName,
    contactEmail: merchant.contactEmail,
    adminUrl: deps.adminUrl,
  };

  if (stripeAvailable && deps.stripe) {
    try {
      const acct = await createExpressAccount(deps.stripe, {
        email: merchant.contactEmail,
        country: merchant.country,
        businessName: merchant.businessName,
      });
      const updated = await deps.store.attachStripeAccount(merchant.id, acct.id);
      const link = await createOnboardingLink(deps.stripe, {
        accountId: acct.id,
        returnUrl: completeUrl,
        refreshUrl,
      });
      const finalMerchant = await deps.store.updateStatus(merchant.id, 'awaiting_kyc');
      const ack = await deps.emails.ackMerchant(emailData);
      const vic = await deps.emails.alertVic(emailData);
      log('signup_stripe_ok', { merchantId: merchant.id, accountId: acct.id });
      return {
        ok: true,
        kind: 'stripe_onboarding',
        merchant: finalMerchant ?? updated ?? merchant,
        onboardingUrl: link.url,
        emailResults: { ack, vic },
      };
    } catch (err) {
      log('signup_stripe_error', err);
      // Don't lose the merchant row — flag for manual followup so Vic
      // can see what happened in /admin. Phase 2: store the error.
      const fallbackMerchant =
        (await deps.store.updateStatus(merchant.id, 'awaiting_kyc', {
          notes: `Stripe Connect call failed during signup: ${err instanceof Error ? err.message : 'unknown'}. Manual followup required.`,
        })) ?? merchant;
      const ack = await deps.emails.ackMerchant(emailData);
      const vic = await deps.emails.alertVic(emailData);
      return {
        ok: true,
        kind: 'manual_followup',
        merchant: fallbackMerchant,
        completeUrl,
        emailResults: { ack, vic },
      };
    }
  }

  // 5b. Stripe Connect unavailable (MU-gated): leave status=awaiting_kyc
  //     and email Vic. Spec: "fires email to Vic via Resend: Stripe
  //     Connect awaiting MU compliance — manual followup required."
  const fallback = await deps.store.updateStatus(merchant.id, 'awaiting_kyc', {
    notes: 'Stripe Connect awaiting MU compliance — manual followup required.',
  });
  const ack = await deps.emails.ackMerchant(emailData);
  const vic = await deps.emails.alertVic(emailData);
  log('signup_manual_followup', { merchantId: merchant.id });
  return {
    ok: true,
    kind: 'manual_followup',
    merchant: fallback ?? merchant,
    completeUrl,
    emailResults: { ack, vic },
  };
}
