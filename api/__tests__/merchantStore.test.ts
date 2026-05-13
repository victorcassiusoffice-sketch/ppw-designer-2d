import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryMerchantStore } from '../db/merchantStore';

describe('in-memory merchant store', () => {
  let store: ReturnType<typeof createInMemoryMerchantStore>;

  beforeEach(() => {
    store = createInMemoryMerchantStore();
  });

  it('inserts and round-trips a merchant', async () => {
    const m = await store.insert({
      slug: 'aurora-wellness',
      businessName: 'Aurora Wellness Ltd',
      brandName: 'Aurora',
      contactName: 'Jane Doe',
      contactEmail: 'jane@aurora.example',
      contactPhone: '+230 5 555 5555',
      country: 'MU',
      productCategories: 'sleep_pods,plants',
    });
    expect(m.id).toBeGreaterThan(0);
    expect(m.status).toBe('pending_signup');

    const byId = await store.findById(m.id);
    expect(byId?.businessName).toBe('Aurora Wellness Ltd');

    const bySlug = await store.findBySlug('aurora-wellness');
    expect(bySlug?.id).toBe(m.id);

    const byEmail = await store.findByContactEmail('JANE@aurora.example');
    expect(byEmail?.id).toBe(m.id);
  });

  it('attaches Stripe Connect account and looks it up', async () => {
    const m = await store.insert({
      slug: 's',
      businessName: 'S',
      brandName: 'S',
      contactName: 'S',
      contactEmail: 's@s.com',
      contactPhone: '+1',
      productCategories: 'other',
    });
    await store.attachStripeAccount(m.id, 'acct_test_123');
    const found = await store.findByStripeAccountId('acct_test_123');
    expect(found?.id).toBe(m.id);
  });

  it('updateStatus persists the new status and extras', async () => {
    const m = await store.insert({
      slug: 's',
      businessName: 'S',
      brandName: 'S',
      contactName: 'S',
      contactEmail: 's@s.com',
      contactPhone: '+1',
      productCategories: 'other',
    });
    const updated = await store.updateStatus(m.id, 'approved', {
      approvedAt: new Date('2026-05-13T00:00:00Z'),
      approvedBy: 'vic@ppwellness.co',
    });
    expect(updated?.status).toBe('approved');
    expect(updated?.approvedBy).toBe('vic@ppwellness.co');
  });

  it('listByStatus filters as expected', async () => {
    for (const s of ['a', 'b', 'c'] as const) {
      await store.insert({
        slug: s,
        businessName: s,
        brandName: s,
        contactName: s,
        contactEmail: `${s}@x.com`,
        contactPhone: '+1',
        productCategories: 'other',
      });
    }
    await store.updateStatus(2, 'pending_admin_approval');
    const pending = await store.listByStatus(['pending_admin_approval']);
    expect(pending.length).toBe(1);
    expect(pending[0].id).toBe(2);
  });

  it('updateStatus returns null for unknown id', async () => {
    const out = await store.updateStatus(999, 'approved');
    expect(out).toBeNull();
  });
});
