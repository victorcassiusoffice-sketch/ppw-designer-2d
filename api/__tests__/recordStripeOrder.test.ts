/**
 * Pure-helper tests for api/_lib/stripe/recordStripeOrder.ts
 * (IMPL-1 defect 6 — Stripe webhook order persistence).
 *
 * The DB writer itself (recordStripeCheckoutOrder) is exercised through
 * the injectable recorder seam in stripeWebhook.test.ts; here we cover
 * the deterministic transforms.
 */

import { describe, it, expect } from 'vitest';
import {
  resolvePpwOrderId,
  parseCartMetadata,
  buildCaptureShapeFromCartMeta,
} from '../_lib/stripe/recordStripeOrder';

describe('resolvePpwOrderId', () => {
  it('prefers metadata.orderId', () => {
    expect(
      resolvePpwOrderId({
        id: 'cs_1',
        client_reference_id: 'REF-1',
        metadata: { orderId: 'PPW-1' },
      }),
    ).toBe('PPW-1');
  });
  it('falls back to client_reference_id, then session id', () => {
    expect(resolvePpwOrderId({ id: 'cs_1', client_reference_id: 'REF-1', metadata: {} })).toBe(
      'REF-1',
    );
    expect(resolvePpwOrderId({ id: 'cs_1', metadata: {} })).toBe('cs_1');
    expect(resolvePpwOrderId({ id: 'cs_1' })).toBe('cs_1');
  });
});

describe('parseCartMetadata', () => {
  it('parses the compact snapshot written by create-checkout-session', () => {
    const raw = JSON.stringify([
      { s: 'K1-A', q: 1, u: 2999900 },
      { s: 'K1-B', q: 2, u: 4999900 },
    ]);
    expect(parseCartMetadata(raw)).toEqual([
      { sku: 'K1-A', quantity: 1, unitMinor: 2999900 },
      { sku: 'K1-B', quantity: 2, unitMinor: 4999900 },
    ]);
  });
  it('returns [] on missing / malformed / partial data', () => {
    expect(parseCartMetadata(undefined)).toEqual([]);
    expect(parseCartMetadata('')).toEqual([]);
    expect(parseCartMetadata('not json')).toEqual([]);
    expect(parseCartMetadata('{"a":1}')).toEqual([]);
    // Invalid rows are dropped, valid ones kept.
    expect(
      parseCartMetadata(JSON.stringify([{ s: '', q: 1, u: 1 }, { s: 'OK', q: 1, u: 100 }])),
    ).toEqual([{ sku: 'OK', quantity: 1, unitMinor: 100 }]);
  });
});

describe('buildCaptureShapeFromCartMeta', () => {
  it('shapes items like a PayPal capture with 2-decimal major values (minor ÷ 100)', () => {
    const shape = buildCaptureShapeFromCartMeta(
      [{ sku: 'K1-A', quantity: 2, unitMinor: 100000 }],
      'MUR',
    );
    expect(shape.purchase_units?.[0]?.items?.[0]).toEqual({
      sku: 'K1-A',
      quantity: '2',
      unit_amount: { currency_code: 'MUR', value: '1000.00' },
    });
  });
});
