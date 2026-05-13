import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createInMemoryMerchantStore } from '../db/merchantStore';
import {
  approveMerchant,
  listPendingMerchants,
  rejectMerchant,
} from '../lib/adminMerchantActions';

async function seedPending(store: ReturnType<typeof createInMemoryMerchantStore>) {
  const m = await store.insert({
    slug: 'aurora',
    businessName: 'Aurora',
    brandName: 'Aurora',
    contactName: 'Jane Doe',
    contactEmail: 'jane@aurora.example',
    contactPhone: '+230 5555 5555',
    country: 'MU',
    productCategories: 'sleep_pods',
    status: 'pending_admin_approval',
  });
  return m.id;
}

describe('listPendingMerchants', () => {
  it('returns only pending_admin_approval merchants, sorted by createdAt', async () => {
    const store = createInMemoryMerchantStore();
    const id1 = await seedPending(store);
    const id2 = await seedPending(store);
    // Insert a merchant in a different status — should not appear.
    await store.insert({
      slug: 'other',
      businessName: 'Other',
      brandName: 'Other',
      contactName: 'Bob',
      contactEmail: 'bob@other.com',
      contactPhone: '+1',
      productCategories: 'plants',
      status: 'awaiting_kyc',
    });
    const out = await listPendingMerchants(store);
    expect(out.map((m) => m.id)).toEqual([id1, id2]);
  });
});

describe('approveMerchant', () => {
  let store: ReturnType<typeof createInMemoryMerchantStore>;
  beforeEach(() => {
    store = createInMemoryMerchantStore();
  });

  it('flips status to approved, sets approvedAt/By, emails merchant', async () => {
    const id = await seedPending(store);
    const email = vi.fn().mockResolvedValue({ ok: true, loggedOnly: true });
    const out = await approveMerchant(
      id,
      { email: 'victor@ppwellness.co', role: 'super_admin' },
      { store, emailMerchant: email },
    );
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.merchant.status).toBe('approved');
    expect(out.merchant.approvedBy).toBe('victor@ppwellness.co');
    expect(out.merchant.approvedAt).toBeInstanceOf(Date);
    expect(email).toHaveBeenCalledOnce();
  });

  it('returns 404 for unknown merchant', async () => {
    const out = await approveMerchant(
      9999,
      { email: 'victor@ppwellness.co', role: 'super_admin' },
      { store, emailMerchant: vi.fn() },
    );
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.status).toBe(404);
  });

  it('returns 409 if already approved', async () => {
    const id = await seedPending(store);
    await store.updateStatus(id, 'approved');
    const out = await approveMerchant(
      id,
      { email: 'victor@ppwellness.co', role: 'super_admin' },
      { store, emailMerchant: vi.fn() },
    );
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.status).toBe(409);
  });

  it('refuses to approve a rejected merchant', async () => {
    const id = await seedPending(store);
    await store.updateStatus(id, 'rejected');
    const out = await approveMerchant(
      id,
      { email: 'v@v.com', role: 'super_admin' },
      { store, emailMerchant: vi.fn() },
    );
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.status).toBe(409);
  });
});

describe('rejectMerchant', () => {
  let store: ReturnType<typeof createInMemoryMerchantStore>;
  beforeEach(() => {
    store = createInMemoryMerchantStore();
  });

  it('flips status to rejected with the trimmed reason + emails merchant', async () => {
    const id = await seedPending(store);
    const email = vi.fn().mockResolvedValue({ ok: true, loggedOnly: true });
    const out = await rejectMerchant(
      id,
      '  not aligned with our current sourcing  ',
      { email: 'victor@ppwellness.co', role: 'super_admin' },
      { store, emailMerchant: email },
    );
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.merchant.status).toBe('rejected');
    expect(out.merchant.rejectedReason).toBe('not aligned with our current sourcing');
    expect(out.merchant.rejectedAt).toBeInstanceOf(Date);
    expect(email).toHaveBeenCalledOnce();
  });

  it('rejects empty reason with 400', async () => {
    const id = await seedPending(store);
    const out = await rejectMerchant(
      id,
      '   ',
      { email: 'v@v.com', role: 'super_admin' },
      { store, emailMerchant: vi.fn() },
    );
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.status).toBe(400);
  });

  it('returns 409 if already rejected', async () => {
    const id = await seedPending(store);
    await store.updateStatus(id, 'rejected');
    const out = await rejectMerchant(
      id,
      'duplicate reason here',
      { email: 'v@v.com', role: 'super_admin' },
      { store, emailMerchant: vi.fn() },
    );
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.status).toBe(409);
  });

  it('refuses to reject an already-approved merchant', async () => {
    const id = await seedPending(store);
    await store.updateStatus(id, 'approved');
    const out = await rejectMerchant(
      id,
      'some reason',
      { email: 'v@v.com', role: 'super_admin' },
      { store, emailMerchant: vi.fn() },
    );
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.status).toBe(409);
  });
});
