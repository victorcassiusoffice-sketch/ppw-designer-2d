/**
 * Stripe Connect webhook business logic (testable core).
 *
 * Listens for `account.updated` events on Express accounts. Maps
 * Stripe's KYC state into our merchant status enum:
 *
 *   details_submitted=false                                    → awaiting_kyc
 *   details_submitted=true,  charges_enabled=false             → kyc_complete
 *     (Stripe asked for more info — partial KYC; we wait)
 *   details_submitted=true,  charges_enabled=true              → pending_admin_approval
 *     (Stripe cleared them; Vic needs to click Approve)
 *
 * On the kyc_complete → pending_admin_approval flip, fire the "KYC
 * complete, ready for approval" email to Vic. Idempotent: re-running
 * the same event is a no-op once the merchant is already in the
 * downstream state.
 */

import type Stripe from 'stripe';
import type { MerchantStatus } from '../db/schema.js';
import type { MerchantStore } from '../db/merchantStore.js';
import { emailVicKycComplete, type SendResult } from './merchantEmails.js';

export type StripeConnectEventOutcome =
  | { ok: true; kind: 'ignored'; reason: string }
  | { ok: true; kind: 'no_change'; merchantId: number; status: MerchantStatus }
  | {
      ok: true;
      kind: 'updated';
      merchantId: number;
      fromStatus: MerchantStatus;
      toStatus: MerchantStatus;
      emailResult?: SendResult;
    }
  | { ok: false; reason: string };

export interface StripeConnectWebhookDeps {
  store: MerchantStore;
  emailVic?: (args: Parameters<typeof emailVicKycComplete>[0]) => Promise<SendResult>;
  adminUrl: string;
  log?: (event: string, payload?: unknown) => void;
}

/**
 * Decide which target status applies to a Stripe Express account
 * snapshot. Pure function — easy to unit-test.
 */
export function mapStripeAccountToStatus(
  account: Pick<Stripe.Account, 'details_submitted' | 'charges_enabled'>,
): MerchantStatus {
  if (!account.details_submitted) return 'awaiting_kyc';
  if (account.charges_enabled) return 'pending_admin_approval';
  return 'kyc_complete';
}

const TERMINAL_STATUSES = new Set<MerchantStatus>(['approved', 'rejected', 'suspended']);

/**
 * Apply an `account.updated` event. Returns a structured outcome the
 * Vercel handler turns into an HTTP response.
 */
export async function handleAccountUpdated(
  event: Stripe.Event,
  deps: StripeConnectWebhookDeps,
): Promise<StripeConnectEventOutcome> {
  const log = deps.log ?? (() => undefined);
  if (event.type !== 'account.updated') {
    return { ok: true, kind: 'ignored', reason: `event type ${event.type} not handled` };
  }
  const account = event.data.object as Stripe.Account;
  if (!account.id) return { ok: true, kind: 'ignored', reason: 'account has no id' };

  const merchant = await deps.store.findByStripeAccountId(account.id);
  if (!merchant) {
    log('webhook_account_unknown', { accountId: account.id });
    return { ok: true, kind: 'ignored', reason: `no merchant for account ${account.id}` };
  }

  if (TERMINAL_STATUSES.has(merchant.status)) {
    return { ok: true, kind: 'no_change', merchantId: merchant.id, status: merchant.status };
  }

  const target = mapStripeAccountToStatus(account);
  if (target === merchant.status) {
    return { ok: true, kind: 'no_change', merchantId: merchant.id, status: merchant.status };
  }

  const updated = await deps.store.updateStatus(merchant.id, target);
  if (!updated) {
    return { ok: false, reason: 'updateStatus returned null' };
  }

  // Only fire the "ready for approval" email when we just landed in
  // pending_admin_approval (Stripe cleared them). The earlier
  // awaiting_kyc → kyc_complete transition is silent; Phase 2 may add
  // a "Stripe needs more info" merchant-side email.
  let emailResult: SendResult | undefined;
  if (target === 'pending_admin_approval') {
    const send = deps.emailVic ?? emailVicKycComplete;
    emailResult = await send({
      businessName: merchant.businessName,
      contactName: merchant.contactName,
      contactEmail: merchant.contactEmail,
      adminUrl: deps.adminUrl,
    });
  }

  log('webhook_status_changed', {
    merchantId: merchant.id,
    from: merchant.status,
    to: target,
  });
  return {
    ok: true,
    kind: 'updated',
    merchantId: merchant.id,
    fromStatus: merchant.status,
    toStatus: target,
    emailResult,
  };
}
