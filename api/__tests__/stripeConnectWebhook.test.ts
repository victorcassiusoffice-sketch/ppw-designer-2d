import { describe, it, expect, vi } from 'vitest';
import type Stripe from 'stripe';
import { createInMemoryMerchantStore } from '../_db/merchantStore';
import {
  handleAccountUpdated,
  mapStripeAccountToStatus,
} from '../_lib/stripeConnectWebhook';

function mkAccount(
  id: string,
  partial: Partial<Stripe.Account> = {},
): Stripe.Account {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { id, ...partial } as any;
}

function mkEvent(account: Stripe.Account, type: string = 'account.updated'): Stripe.Event {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { id: `evt_${Math.random()}`, type, data: { object: account } } as any;
}

describe('mapStripeAccountToStatus', () => {
  it('maps not-submitted → awaiting_kyc', () => {
    expect(mapStripeAccountToStatus({ details_submitted: false, charges_enabled: false })).toBe(
      'awaiting_kyc',
    );
  });
  it('maps submitted + not charges_enabled → kyc_complete (Stripe asked for more info)', () => {
    expect(mapStripeAccountToStatus({ details_submitted: true, charges_enabled: false })).toBe(
      'kyc_complete',
    );
  });
  it('maps submitted + charges_enabled → pending_admin_approval', () => {
    expect(mapStripeAccountToStatus({ details_submitted: true, charges_enabled: true })).toBe(
      'pending_admin_approval',
    );
  });
});

describe('handleAccountUpdated', () => {
  async function seed(stripeId: string) {
    const store = createInMemoryMerchantStore();
    const m = await store.insert({
      slug: 'aurora',
      businessName: 'Aurora',
      brandName: 'Aurora',
      contactName: 'Jane',
      contactEmail: 'jane@aurora.example',
      contactPhone: '+230 5555 5555',
      country: 'MU',
      productCategories: 'sleep_pods',
      stripeConnectAccountId: stripeId,
      status: 'awaiting_kyc',
    });
    return { store, merchantId: m.id };
  }

  it('ignores non-account.updated events', async () => {
    const { store } = await seed('acct_xyz');
    const out = await handleAccountUpdated(
      mkEvent(mkAccount('acct_xyz', { details_submitted: true, charges_enabled: true }), 'foo.bar'),
      { store, adminUrl: 'http://x' },
    );
    expect(out.ok).toBe(true);
    if (out.ok) expect(out.kind).toBe('ignored');
  });

  it('ignores accounts not in our DB', async () => {
    const { store } = await seed('acct_xyz');
    const out = await handleAccountUpdated(
      mkEvent(mkAccount('acct_someone_else', { details_submitted: true, charges_enabled: true })),
      { store, adminUrl: 'http://x' },
    );
    expect(out.ok).toBe(true);
    if (out.ok) expect(out.kind).toBe('ignored');
  });

  it('flips awaiting_kyc → pending_admin_approval and emails Vic', async () => {
    const { store, merchantId } = await seed('acct_abc');
    const emailVic = vi.fn().mockResolvedValue({ ok: true, loggedOnly: true });
    const out = await handleAccountUpdated(
      mkEvent(mkAccount('acct_abc', { details_submitted: true, charges_enabled: true })),
      { store, emailVic, adminUrl: 'https://designer.ppwellness.co/admin/merchants' },
    );
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.kind).toBe('updated');
    if (out.kind === 'updated') {
      expect(out.fromStatus).toBe('awaiting_kyc');
      expect(out.toStatus).toBe('pending_admin_approval');
    }
    expect(emailVic).toHaveBeenCalledOnce();
    const refreshed = await store.findById(merchantId);
    expect(refreshed?.status).toBe('pending_admin_approval');
  });

  it('does NOT email when transitioning to kyc_complete (Stripe needs more info)', async () => {
    const { store } = await seed('acct_partial');
    const emailVic = vi.fn().mockResolvedValue({ ok: true, loggedOnly: true });
    const out = await handleAccountUpdated(
      mkEvent(mkAccount('acct_partial', { details_submitted: true, charges_enabled: false })),
      { store, emailVic, adminUrl: 'http://x' },
    );
    expect(out.ok).toBe(true);
    if (out.ok && out.kind === 'updated') {
      expect(out.toStatus).toBe('kyc_complete');
    }
    expect(emailVic).not.toHaveBeenCalled();
  });

  it('is idempotent against already-terminal merchants', async () => {
    const { store, merchantId } = await seed('acct_done');
    await store.updateStatus(merchantId, 'approved');
    const out = await handleAccountUpdated(
      mkEvent(mkAccount('acct_done', { details_submitted: true, charges_enabled: true })),
      { store, adminUrl: 'http://x' },
    );
    expect(out.ok).toBe(true);
    if (out.ok) expect(out.kind).toBe('no_change');
    const refreshed = await store.findById(merchantId);
    expect(refreshed?.status).toBe('approved');
  });

  it('is a no-op when target status equals current', async () => {
    const { store } = await seed('acct_same');
    const out = await handleAccountUpdated(
      mkEvent(mkAccount('acct_same', { details_submitted: false, charges_enabled: false })),
      { store, adminUrl: 'http://x' },
    );
    expect(out.ok).toBe(true);
    if (out.ok) expect(out.kind).toBe('no_change');
  });
});
