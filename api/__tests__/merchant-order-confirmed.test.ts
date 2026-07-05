/**
 * Wellness-Designer-App (g) — merchant-side order-confirmed tests.
 *
 * Three layers covered:
 *   1. `renderMerchantOrderConfirmed` template — pure HTML render
 *   2. `dispatchMerchantOrderConfirmedEmail` — wraps render + sendEmail
 *   3. `fetchMerchantNotifyRowsForOrder` — DB JOIN with mock builder
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../_db/client.js', () => {
  const builder = {
    _orderLookup: [] as unknown[],
    _itemRows: [] as unknown[],
    select(_cols?: unknown) {
      return this;
    },
    from(t: { _name: string }) {
      builder._activeTable = t._name;
      return builder;
    },
    innerJoin(_t: unknown, _pred: unknown) {
      return builder;
    },
    where(_pred: unknown) {
      return builder;
    },
    limit(_n: number) {
      return Promise.resolve(builder._orderLookup);
    },
    // After innerJoin + where, the await resolves the orderItems thenable
    then(resolve: (v: unknown[]) => void) {
      resolve(builder._itemRows);
      return undefined;
    },
    _activeTable: '',
  };
  return {
    getDb: () => builder,
    schema: {
      orders: { _name: 'orders', id: {}, ppwOrderId: {} },
      orderItems: {
        _name: 'order_items',
        orderId: {},
        merchantId: {},
        sku: {},
        name: {},
        quantity: {},
        lineTotalMinor: {},
      },
      merchants: {
        _name: 'merchants',
        id: {},
        businessName: {},
        contactName: {},
        contactEmail: {},
      },
    },
    __fake: { builder },
  };
});

vi.mock('../_lib/email/send.js', () => ({
  sendEmail: vi.fn(async (args: { to: string; subject: string; template: string }) => ({
    ok: true,
    id: 're_test_' + args.template,
  })),
}));

import {
  renderMerchantOrderConfirmed,
  type MerchantOrderConfirmedData,
} from '../_lib/email/templates';
import { dispatchMerchantOrderConfirmedEmail } from '../_lib/email/dispatch';
import { fetchMerchantNotifyRowsForOrder } from '../_lib/email/merchantOrderLookup';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const fakeDb: any = await import('../_db/client.js').then((m) => (m as any).__fake);

describe('Wellness-Designer-App (g) / renderMerchantOrderConfirmed', () => {
  const baseData: MerchantOrderConfirmedData = {
    merchantName: 'K1 Sport',
    contactName: 'Kareem',
    orderRef: 'PPW-2026-A1B2',
    customerGreetingName: 'Vic',
    currency: 'MUR',
    lines: [
      { sku: 'K1-CDIO-NT2450', name: 'NordicTrack Treadmill', quantity: 1, lineTotalMinor: 250_000 },
      { sku: 'K1-STRG-MXMGGT', name: 'Matrix Glute Trainer', quantity: 2, lineTotalMinor: 180_000 },
    ],
    subtotalMinor: 430_000,
    dashboardUrl: 'https://designer.ppwellness.co/merchant/k1-sport',
  };

  it('returns a subject containing the order ref', () => {
    const out = renderMerchantOrderConfirmed(baseData);
    expect(out.subject).toContain('PPW-2026-A1B2');
  });

  it('embeds each line SKU + name in the HTML', () => {
    const out = renderMerchantOrderConfirmed(baseData);
    expect(out.html).toContain('K1-CDIO-NT2450');
    expect(out.html).toContain('NordicTrack Treadmill');
    expect(out.html).toContain('K1-STRG-MXMGGT');
  });

  it('embeds the dashboard URL', () => {
    const out = renderMerchantOrderConfirmed(baseData);
    expect(out.html).toContain('designer.ppwellness.co/merchant/k1-sport');
  });

  it('escapes HTML in the customer greeting name', () => {
    const out = renderMerchantOrderConfirmed({
      ...baseData,
      customerGreetingName: '<script>alert(1)</script>',
    });
    expect(out.html).not.toContain('<script>alert(1)</script>');
    expect(out.html).toContain('&lt;script&gt;');
  });
});

describe('Wellness-Designer-App (g) / dispatchMerchantOrderConfirmedEmail', () => {
  it('skips when contactEmail is empty', async () => {
    const result = await dispatchMerchantOrderConfirmedEmail({
      row: {
        merchantName: 'K1 Sport',
        contactName: 'Kareem',
        contactEmail: '',
        lines: [{ sku: 'A', name: 'A', quantity: 1, lineTotalMinor: 100 }],
        subtotalMinor: 100,
      },
      orderRef: 'PPW-1',
      customerGreetingName: 'Vic',
      currency: 'MUR',
    });
    expect(result.fired).toBe(false);
    expect(result.skippedReason).toBe('no_customer_email');
  });

  it('skips when there are no lines', async () => {
    const result = await dispatchMerchantOrderConfirmedEmail({
      row: {
        merchantName: 'K1 Sport',
        contactName: 'Kareem',
        contactEmail: 'k1@example.com',
        lines: [],
        subtotalMinor: 0,
      },
      orderRef: 'PPW-1',
      customerGreetingName: 'Vic',
      currency: 'MUR',
    });
    expect(result.fired).toBe(false);
    expect(result.skippedReason).toBe('caller_caught');
  });

  it('fires sendEmail on the happy path and returns fired:true', async () => {
    const result = await dispatchMerchantOrderConfirmedEmail({
      row: {
        merchantName: 'K1 Sport',
        contactName: 'Kareem',
        contactEmail: 'k1@example.com',
        lines: [{ sku: 'A', name: 'A', quantity: 1, lineTotalMinor: 100 }],
        subtotalMinor: 100,
      },
      orderRef: 'PPW-1',
      customerGreetingName: 'Vic',
      currency: 'MUR',
    });
    expect(result.fired).toBe(true);
  });
});

describe('Wellness-Designer-App (g) / fetchMerchantNotifyRowsForOrder', () => {
  beforeEach(() => {
    fakeDb.builder._orderLookup = [];
    fakeDb.builder._itemRows = [];
  });

  it('returns [] when the order is not found', async () => {
    fakeDb.builder._orderLookup = [];
    const rows = await fetchMerchantNotifyRowsForOrder('PPW-NONEXISTENT');
    expect(rows).toEqual([]);
  });

  it('returns [] when no order_items exist for the order', async () => {
    fakeDb.builder._orderLookup = [{ id: 42 }];
    fakeDb.builder._itemRows = [];
    const rows = await fetchMerchantNotifyRowsForOrder('PPW-EMPTY');
    expect(rows).toEqual([]);
  });

  it('groups lines by merchant + sums subtotalMinor per group', async () => {
    fakeDb.builder._orderLookup = [{ id: 42 }];
    fakeDb.builder._itemRows = [
      {
        merchantId: 1,
        merchantName: 'K1 Sport',
        merchantContactName: 'Kareem',
        merchantContactEmail: 'k1@example.com',
        sku: 'K1-A',
        name: 'Treadmill',
        quantity: 1,
        lineTotalMinor: 250_000,
      },
      {
        merchantId: 1,
        merchantName: 'K1 Sport',
        merchantContactName: 'Kareem',
        merchantContactEmail: 'k1@example.com',
        sku: 'K1-B',
        name: 'Bike',
        quantity: 1,
        lineTotalMinor: 180_000,
      },
      {
        merchantId: 2,
        merchantName: 'Decathlon MU',
        merchantContactName: 'Manager',
        merchantContactEmail: 'mu@decathlon.com',
        sku: 'DE-A',
        name: 'Mat',
        quantity: 3,
        lineTotalMinor: 30_000,
      },
    ];
    const rows = await fetchMerchantNotifyRowsForOrder('PPW-MULTI');
    expect(rows.length).toBe(2);
    const k1 = rows.find((r) => r.merchantName === 'K1 Sport');
    const dec = rows.find((r) => r.merchantName === 'Decathlon MU');
    expect(k1?.lines.length).toBe(2);
    expect(k1?.subtotalMinor).toBe(430_000);
    expect(dec?.lines.length).toBe(1);
    expect(dec?.subtotalMinor).toBe(30_000);
  });
});
