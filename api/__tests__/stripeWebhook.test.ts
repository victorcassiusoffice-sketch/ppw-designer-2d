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
    await dispatchEvent(event, makeStripe([{ description: 'Ice bath', quantity: 1, amount_total: 4999900, currency: 'mur' }]));
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
    await dispatchEvent(event, stripe);
    expect(emailLib.sendOrderConfirmation).toHaveBeenCalledTimes(1);
  });
});
