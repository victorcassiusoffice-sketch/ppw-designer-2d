/**
 * Unit tests for api/paypal-webhook.ts
 *
 * We don't run real signature verification - we target the post-verify
 * dispatch core (`dispatchPaypalEvent`) and the helpers.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  dispatchPaypalEvent,
  extractHeaders,
  applyEventToOrder,
  type PaypalEvent,
} from '../_lib/paypal/webhook';

// Mock the dedupe + db modules so the dispatch core can run without a real DB.
vi.mock('../_lib/webhookDedupe', () => ({
  recordWebhookEvent: vi.fn(),
}));
vi.mock('../_db/client', () => ({
  getDb: () => ({
    execute: vi.fn().mockResolvedValue([]),
  }),
}));

import { recordWebhookEvent } from '../_lib/webhookDedupe';

const mockRecord = recordWebhookEvent as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
  mockRecord.mockReset();
});

describe('extractHeaders', () => {
  it('reads PayPal headers (lower or mixed case)', () => {
    const h = extractHeaders({
      'paypal-auth-algo': 'SHA256withRSA',
      'paypal-cert-url': 'https://api.paypal.com/cert',
      'paypal-transmission-id': 'tx-1',
      'paypal-transmission-sig': 'sig-1',
      'paypal-transmission-time': '2026-01-01T00:00:00Z',
    });
    expect(h).not.toBeNull();
    expect(h?.authAlgo).toBe('SHA256withRSA');
  });
  it('returns null when any header is missing', () => {
    const h = extractHeaders({
      'paypal-auth-algo': 'SHA256withRSA',
    });
    expect(h).toBeNull();
  });
});

function makeEvent(type: string, overrides: Partial<PaypalEvent> = {}): PaypalEvent {
  return {
    id: 'WH-EVT-' + type,
    event_type: type,
    resource: {
      id: 'CAP-1',
      status: 'COMPLETED',
      custom_id: 'PPW-ORDER-001',
      amount: { currency_code: 'USD', value: '99.00' },
    },
    ...overrides,
  };
}

describe('dispatchPaypalEvent - idempotency', () => {
  it('returns alreadyProcessed:true when dedupe says so', async () => {
    mockRecord.mockResolvedValue({ alreadyProcessed: true });
    const r = await dispatchPaypalEvent(makeEvent('PAYMENT.CAPTURE.COMPLETED'));
    expect(r.alreadyProcessed).toBe(true);
    expect(r.updated).toBe(false);
  });

  it('returns updated:true on a fresh CAPTURE.COMPLETED', async () => {
    mockRecord.mockResolvedValue({ alreadyProcessed: false, rowId: 1 });
    const r = await dispatchPaypalEvent(makeEvent('PAYMENT.CAPTURE.COMPLETED'));
    expect(r.alreadyProcessed).toBe(false);
    expect(r.updated).toBe(true);
  });

  it('treats CHECKOUT.ORDER.APPROVED as no-op (updated:false)', async () => {
    mockRecord.mockResolvedValue({ alreadyProcessed: false, rowId: 2 });
    const r = await dispatchPaypalEvent(makeEvent('CHECKOUT.ORDER.APPROVED'));
    expect(r.alreadyProcessed).toBe(false);
    expect(r.updated).toBe(false);
  });

  it('throws when event has no id', async () => {
    await expect(
      dispatchPaypalEvent({ event_type: 'PAYMENT.CAPTURE.COMPLETED' } as PaypalEvent),
    ).rejects.toThrow();
  });

  it('still acks (no throw) when dedupe DB is down', async () => {
    mockRecord.mockRejectedValue(new Error('connection refused'));
    const r = await dispatchPaypalEvent(makeEvent('PAYMENT.CAPTURE.COMPLETED'));
    expect(r.ok).toBe(true);
    expect(r.alreadyProcessed).toBe(false);
    expect(r.updated).toBe(false);
  });
});

describe('applyEventToOrder - status mapping', () => {
  it('CAPTURE.COMPLETED maps to captured', async () => {
    const r = await applyEventToOrder(makeEvent('PAYMENT.CAPTURE.COMPLETED'));
    expect(r.updated).toBe(true);
  });
  it('CAPTURE.DENIED maps to failed', async () => {
    const r = await applyEventToOrder(makeEvent('PAYMENT.CAPTURE.DENIED'));
    expect(r.updated).toBe(true);
  });
  it('CAPTURE.REFUNDED maps to refunded', async () => {
    const r = await applyEventToOrder(makeEvent('PAYMENT.CAPTURE.REFUNDED'));
    expect(r.updated).toBe(true);
  });
  it('unknown event types are ignored', async () => {
    const r = await applyEventToOrder(makeEvent('CHECKOUT.PAYMENT.UNKNOWN'));
    expect(r.updated).toBe(false);
  });
  it('events without a ppwOrderId are ignored', async () => {
    const r = await applyEventToOrder({
      id: 'X',
      event_type: 'PAYMENT.CAPTURE.COMPLETED',
      resource: { id: 'CAP-2', amount: { currency_code: 'USD', value: '1.00' } },
    });
    expect(r.updated).toBe(false);
  });
  it('resolves the orderRef from a packed custom_id (orderRef|email)', async () => {
    const r = await applyEventToOrder(
      makeEvent('PAYMENT.CAPTURE.COMPLETED', {
        resource: {
          id: 'CAP-3',
          status: 'COMPLETED',
          custom_id: 'PPW-ORDER-002|buyer@example.com',
          amount: { currency_code: 'MUR', value: '1000.00' },
        },
      }),
    );
    expect(r.updated).toBe(true);
  });
});
