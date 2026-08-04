/**
 * Tests for api/stripe-webhook.ts
 *
 * We don't run real signature verification — we test the `dispatchEvent`
 * core, which is the post-verification branch logic.
 *
 * The email module is mocked (`vi.mock`) so we can assert on the
 * function calls without sending anything.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type Stripe from 'stripe';
import {
  dispatchEvent,
  buildOrderSummaryFromSession,
  OrderPersistError,
  _resetWebhookStateForTests,
} from '../stripe-webhook';

vi.mock('../_lib/email', () => ({
  sendOrderConfirmation: vi.fn().mockResolvedValue({ ok: true, loggedOnly: true }),
  sendOrderAlertToVic: vi.fn().mockResolvedValue({ ok: true, loggedOnly: true }),
  sendPaymentFailedAlertToVic: vi.fn().mockResolvedValue({ ok: true, loggedOnly: true }),
}));

import * as emailLib from '../_lib/email';

function makeSession(overrides: Partial<Stripe.Checkout.Session> = {}): Stripe.Checkout.Session {
  return {
    id: 'cs_test_abc',
    object: 'checkout.session',
    amount_total: 4999900,
    currency: 'mur',
    customer_email: 'buyer@example.com',
    customer_details: {
      email: 'buyer@example.com',
      name: 'Buyer Person',
      phone: null,
      address: null,
      tax_exempt: 'none',
      tax_ids: [],
    },
    metadata: {
      orderId: 'PPW-TEST-001',
      property: JSON.stringify({
        id: 'p1',
        name: 'Wellness Property',
        rooms: [{ id: 'r1', name: 'Main', itemCount: 2 }],
      }),
      customer_address: JSON.stringify({
        line1: '1 Wellness Way',
        line2: '',
        city: 'Tamarin',
        postcode: '90100',
        country: 'MU',
      }),
      notes: 'Lift access only on weekdays.',
    },
    payment_status: 'paid',
    status: 'complete',
    ...overrides,
  } as unknown as Stripe.Checkout.Session;
}

function makePaymentIntent(): Stripe.PaymentIntent {
  return {
    id: 'pi_test_fail',
    object: 'payment_intent',
    amount: 4999900,
    currency: 'mur',
    last_payment_error: {
      code: 'card_declined',
      message: 'Your card was declined.',
      type: 'card_error',
    },
    receipt_email: 'buyer@example.com',
    metadata: { orderId: 'PPW-TEST-001' },
  } as unknown as Stripe.PaymentIntent;
}

/** Succeeding order recorder — dispatchEvent now treats a FAILING
 *  order-persist as fatal (OrderPersistError), so tests that only care
 *  about email behaviour inject this. */
function okRecorder() {
  return vi.fn().mockResolvedValue({
    ok: true,
    ppwOrderId: 'PPW-TEST-001',
    orderUpserted: true,
    itemsInserted: 0,
  });
}

function makeStripe(linesData: Array<Partial<Stripe.LineItem>> = []): Pick<Stripe, 'checkout'> {
  return {
    checkout: {
      sessions: {
        listLineItems: vi.fn().mockResolvedValue({
          data: linesData,
        }),
      },
    },
  } as unknown as Pick<Stripe, 'checkout'>;
}

describe('buildOrderSummaryFromSession', () => {
  it('extracts orderId, customer, property from metadata', () => {
    const summary = buildOrderSummaryFromSession(makeSession());
    expect(summary).not.toBeNull();
    expect(summary!.id).toBe('PPW-TEST-001');
    expect(summary!.customer.email).toBe('buyer@example.com');
    expect(summary!.customer.addressLine1).toBe('1 Wellness Way');
    expect(summary!.property?.rooms[0].name).toBe('Main');
  });

  it('returns null when email is missing', () => {
    const s = makeSession({ customer_email: null, customer_details: null });
    expect(buildOrderSummaryFromSession(s)).toBeNull();
  });

  it('treats MUR amount_total as minor units (Phase 0 wire-contract)', () => {
    const summary = buildOrderSummaryFromSession(makeSession());
    // 4999900 minor (cents-of-MUR) → Rs 49,999.00 major.
    expect(summary!.total).toBe(49999);
    expect(summary!.currency).toBe('MUR');
  });
});

describe('dispatchEvent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _resetWebhookStateForTests();
  });

  it('on checkout.session.completed: sends BOTH confirmation + Vic alert emails', async () => {
    const event = {
      id: 'evt_1',
      type: 'checkout.session.completed',
      data: { object: makeSession() },
    } as unknown as Stripe.Event;
    await dispatchEvent(
      event,
      makeStripe([{ description: 'Ice bath', quantity: 1, amount_total: 4999900, currency: 'mur' }]),
      okRecorder(),
    );
    expect(emailLib.sendOrderConfirmation).toHaveBeenCalledTimes(1);
    expect(emailLib.sendOrderAlertToVic).toHaveBeenCalledTimes(1);
  });

  it('on payment_intent.payment_failed: alerts Vic only', async () => {
    const event = {
      id: 'evt_2',
      type: 'payment_intent.payment_failed',
      data: { object: makePaymentIntent() },
    } as unknown as Stripe.Event;
    await dispatchEvent(event, makeStripe());
    expect(emailLib.sendPaymentFailedAlertToVic).toHaveBeenCalledTimes(1);
    expect(emailLib.sendOrderConfirmation).not.toHaveBeenCalled();
    expect(emailLib.sendOrderAlertToVic).not.toHaveBeenCalled();
  });

  it('ignores unhandled event types silently', async () => {
    const event = {
      id: 'evt_3',
      type: 'invoice.created',
      data: { object: {} },
    } as unknown as Stripe.Event;
    await dispatchEvent(event, makeStripe());
    expect(emailLib.sendOrderConfirmation).not.toHaveBeenCalled();
    expect(emailLib.sendOrderAlertToVic).not.toHaveBeenCalled();
    expect(emailLib.sendPaymentFailedAlertToVic).not.toHaveBeenCalled();
  });

  it('on checkout.session.completed: records the order in Neon (IMPL-1 defect 6)', async () => {
    const recorder = vi.fn().mockResolvedValue({
      ok: true,
      ppwOrderId: 'PPW-TEST-001',
      orderUpserted: true,
      itemsInserted: 2,
    });
    const event = {
      id: 'evt_rec_1',
      type: 'checkout.session.completed',
      data: { object: makeSession() },
    } as unknown as Stripe.Event;
    await dispatchEvent(event, makeStripe(), recorder);
    expect(recorder).toHaveBeenCalledTimes(1);
    expect(recorder.mock.calls[0][0]).toMatchObject({ id: 'cs_test_abc' });
    // Emails still fire after recording.
    expect(emailLib.sendOrderConfirmation).toHaveBeenCalledTimes(1);
  });

  it('order-record THROW → OrderPersistError, no emails (review P1: 5xx path, Stripe will redeliver)', async () => {
    const recorder = vi.fn().mockRejectedValue(new Error('neon down'));
    const event = {
      id: 'evt_rec_2',
      type: 'checkout.session.completed',
      data: { object: makeSession() },
    } as unknown as Stripe.Event;
    await expect(dispatchEvent(event, makeStripe(), recorder)).rejects.toThrow(OrderPersistError);
    // Emails must NOT go out before persistence succeeds — otherwise the
    // Stripe redelivery (post-500) would email the buyer twice.
    expect(emailLib.sendOrderConfirmation).not.toHaveBeenCalled();
    expect(emailLib.sendOrderAlertToVic).not.toHaveBeenCalled();
  });

  it('order-record {ok:false} → OrderPersistError too (recorder reports transient DB failure)', async () => {
    const recorder = vi.fn().mockResolvedValue({
      ok: false,
      ppwOrderId: 'PPW-TEST-001',
      orderUpserted: false,
      itemsInserted: 0,
      error: 'connection timeout',
    });
    const event = {
      id: 'evt_rec_2b',
      type: 'checkout.session.completed',
      data: { object: makeSession() },
    } as unknown as Stripe.Event;
    await expect(dispatchEvent(event, makeStripe(), recorder)).rejects.toThrow(OrderPersistError);
    expect(emailLib.sendOrderConfirmation).not.toHaveBeenCalled();
  });

  it('does not record orders for non-checkout events', async () => {
    const recorder = vi.fn();
    const event = {
      id: 'evt_rec_3',
      type: 'payment_intent.payment_failed',
      data: { object: makePaymentIntent() },
    } as unknown as Stripe.Event;
    await dispatchEvent(event, makeStripe(), recorder);
    expect(recorder).not.toHaveBeenCalled();
  });

  it('tolerates listLineItems failure — still emails', async () => {
    const stripe = {
      checkout: {
        sessions: {
          listLineItems: vi.fn().mockRejectedValue(new Error('Network')),
        },
      },
    } as unknown as Pick<Stripe, 'checkout'>;
    const event = {
      id: 'evt_4',
      type: 'checkout.session.completed',
      data: { object: makeSession() },
    } as unknown as Stripe.Event;
    await dispatchEvent(event, stripe, okRecorder());
    expect(emailLib.sendOrderConfirmation).toHaveBeenCalledTimes(1);
  });
});
