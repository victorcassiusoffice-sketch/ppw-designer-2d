import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  PRODUCT_CATEGORIES,
  merchantSignupSchema,
  processMerchantSignup,
  type MerchantSignupEmailTransport,
} from '../lib/merchantSignup';
import { createInMemoryMerchantStore } from '../db/merchantStore';

function fakeEmails(): MerchantSignupEmailTransport & { ackCount: () => number; vicCount: () => number } {
  let ackCount = 0;
  let vicCount = 0;
  return {
    ackCount: () => ackCount,
    vicCount: () => vicCount,
    async ackMerchant() {
      ackCount++;
      return { ok: true, loggedOnly: true };
    },
    async alertVic() {
      vicCount++;
      return { ok: true, loggedOnly: true };
    },
  };
}

function validPayload(overrides: Record<string, unknown> = {}) {
  return {
    businessName: 'Aurora Wellness Ltd',
    brandName: 'Aurora',
    country: 'MU',
    contactName: 'Jane Doe',
    contactEmail: 'jane@aurora.example',
    contactPhone: '+230 5555 5555',
    productCategories: ['sleep_pods', 'plants'],
    estimatedMonthlyVolume: '20-50 units',
    website: 'https://aurora.example',
    referralNotes: 'Heard about you from a hotel partner.',
    ...overrides,
  };
}

describe('merchantSignupSchema', () => {
  it('accepts a complete valid payload', () => {
    const r = merchantSignupSchema.safeParse(validPayload());
    expect(r.success).toBe(true);
  });

  it('rejects missing required fields', () => {
    const r = merchantSignupSchema.safeParse(validPayload({ businessName: '' }));
    expect(r.success).toBe(false);
  });

  it('rejects bad email format', () => {
    const r = merchantSignupSchema.safeParse(validPayload({ contactEmail: 'not-an-email' }));
    expect(r.success).toBe(false);
  });

  it('rejects empty product category list', () => {
    const r = merchantSignupSchema.safeParse(validPayload({ productCategories: [] }));
    expect(r.success).toBe(false);
  });

  it('rejects website without http(s)', () => {
    const r = merchantSignupSchema.safeParse(validPayload({ website: 'aurora.example' }));
    expect(r.success).toBe(false);
  });

  it('uppercases country and lowercases email', () => {
    const r = merchantSignupSchema.safeParse(
      validPayload({ country: 'mu', contactEmail: 'JANE@Aurora.example' }),
    );
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.country).toBe('MU');
      expect(r.data.contactEmail).toBe('jane@aurora.example');
    }
  });

  it('locks PRODUCT_CATEGORIES list', () => {
    expect(PRODUCT_CATEGORIES).toContain('ice_baths');
    expect(PRODUCT_CATEGORIES).toContain('sleep_pods');
    expect(PRODUCT_CATEGORIES).toContain('ergo_chairs');
  });
});

describe('processMerchantSignup — manual followup path (MU gated)', () => {
  let store: ReturnType<typeof createInMemoryMerchantStore>;
  let emails: ReturnType<typeof fakeEmails>;

  beforeEach(() => {
    store = createInMemoryMerchantStore();
    emails = fakeEmails();
  });

  it('happy path inserts a merchant in awaiting_kyc + emails both', async () => {
    const out = await processMerchantSignup(validPayload(), {
      store,
      stripe: null,
      emails,
      adminUrl: 'https://designer.ppwellness.co/admin/merchants',
      publicBaseUrl: 'https://designer.ppwellness.co',
      stripeAvailable: false,
    });
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.kind).toBe('manual_followup');
    expect(out.merchant.status).toBe('awaiting_kyc');
    expect(out.merchant.notes).toMatch(/MU compliance/);
    if (out.kind === 'manual_followup') {
      expect(out.completeUrl).toMatch(/\/suppliers\/signup\/complete/);
    }
    expect(emails.ackCount()).toBe(1);
    expect(emails.vicCount()).toBe(1);
  });

  it('rejects an invalid payload with status=400 and issues array', async () => {
    const out = await processMerchantSignup(validPayload({ businessName: '' }), {
      store,
      stripe: null,
      emails,
      adminUrl: 'http://x',
      publicBaseUrl: 'http://x',
      stripeAvailable: false,
    });
    expect(out.ok).toBe(false);
    if (out.ok) return;
    expect(out.status).toBe(400);
    expect(out.issues?.length).toBeGreaterThan(0);
    expect(emails.ackCount()).toBe(0);
  });

  it('rejects duplicate contact email with 409', async () => {
    await processMerchantSignup(validPayload(), {
      store,
      stripe: null,
      emails,
      adminUrl: 'http://x',
      publicBaseUrl: 'http://x',
      stripeAvailable: false,
    });
    const second = await processMerchantSignup(
      validPayload({ businessName: 'Different Co' }),
      {
        store,
        stripe: null,
        emails,
        adminUrl: 'http://x',
        publicBaseUrl: 'http://x',
        stripeAvailable: false,
      },
    );
    expect(second.ok).toBe(false);
    if (second.ok) return;
    expect(second.status).toBe(409);
  });

  it('returns 500 if the store insert blows up', async () => {
    const brokenStore = createInMemoryMerchantStore();
    brokenStore.insert = async () => {
      throw new Error('boom');
    };
    const out = await processMerchantSignup(validPayload(), {
      store: brokenStore,
      stripe: null,
      emails,
      adminUrl: 'http://x',
      publicBaseUrl: 'http://x',
      stripeAvailable: false,
    });
    expect(out.ok).toBe(false);
    if (out.ok) return;
    expect(out.status).toBe(500);
  });
});

describe('processMerchantSignup — Stripe Connect path', () => {
  it('creates Stripe account + onboarding link, status flips to awaiting_kyc', async () => {
    const store = createInMemoryMerchantStore();
    const emails = fakeEmails();
    const fakeStripe = {
      accounts: {
        create: vi.fn().mockResolvedValue({ id: 'acct_test_abc123' }),
      },
      accountLinks: {
        create: vi.fn().mockResolvedValue({ url: 'https://stripe.example/onboard/abc' }),
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;

    const out = await processMerchantSignup(validPayload(), {
      store,
      stripe: fakeStripe,
      emails,
      adminUrl: 'https://designer.ppwellness.co/admin/merchants',
      publicBaseUrl: 'https://designer.ppwellness.co',
      stripeAvailable: true,
    });

    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.kind).toBe('stripe_onboarding');
    expect(out.merchant.status).toBe('awaiting_kyc');
    expect(out.merchant.stripeConnectAccountId).toBe('acct_test_abc123');
    if (out.kind === 'stripe_onboarding') {
      expect(out.onboardingUrl).toContain('stripe.example/onboard');
    }
    expect(fakeStripe.accounts.create).toHaveBeenCalledOnce();
    expect(fakeStripe.accountLinks.create).toHaveBeenCalledOnce();
  });

  it('falls back to manual followup if Stripe throws', async () => {
    const store = createInMemoryMerchantStore();
    const emails = fakeEmails();
    const fakeStripe = {
      accounts: {
        create: vi.fn().mockRejectedValue(new Error('stripe is down')),
      },
      accountLinks: { create: vi.fn() },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;

    const out = await processMerchantSignup(validPayload(), {
      store,
      stripe: fakeStripe,
      emails,
      adminUrl: 'http://x',
      publicBaseUrl: 'https://designer.ppwellness.co',
      stripeAvailable: true,
    });
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.kind).toBe('manual_followup');
    expect(out.merchant.notes).toMatch(/Stripe Connect call failed/);
  });
});
