/**
 * Tests for api/_lib/email.ts — template rendering + RESEND_API_KEY
 * dry-run path. No live network calls.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  renderOrderConfirmationHtml,
  renderVicAlertHtml,
  sendOrderConfirmation,
  sendOrderAlertToVic,
  _resetEmailClientForTests,
  formatMoney,
} from '../_lib/email';
import type { CustomerInfo, OrderSummary } from '../_lib/orderTypes';

function makeOrder(): OrderSummary {
  return {
    id: 'PPW-TEST-001',
    total: 99998,
    currency: 'MUR',
    customer: {
      name: 'Buyer Person',
      email: 'buyer@example.com',
      phone: '+230 5 555 1234',
      addressLine1: '1 Wellness Way',
      city: 'Tamarin',
      postcode: '90100',
      country: 'MU',
      notes: 'Lift access only on weekdays.',
    },
    lines: [
      { name: 'Ice bath', quantity: 1, unitAmount: 4999900, currency: 'MUR' },
      { name: 'Sleep pod', quantity: 2, unitAmount: 4999900, currency: 'MUR' },
    ],
    property: {
      id: 'p1',
      name: 'Vic Showroom',
      rooms: [
        { id: 'r1', name: 'Cold Plunge', itemCount: 1 },
        { id: 'r2', name: 'Recovery Bay', itemCount: 2 },
      ],
    },
  };
}

describe('formatMoney', () => {
  it('renders MUR with Rs prefix and 0 decimals', () => {
    expect(formatMoney(1234, 'MUR')).toBe('Rs 1234');
  });
  it('renders USD with $ prefix and 2 decimals', () => {
    expect(formatMoney(12.5, 'USD')).toBe('$12.50');
  });
});

describe('renderOrderConfirmationHtml', () => {
  it('contains customer name, order id, line items, and PPW branding', () => {
    const order = makeOrder();
    const html = renderOrderConfirmationHtml(order.customer, order);
    expect(html).toContain('Buyer Person');
    expect(html).toContain('PPW-TEST-001');
    expect(html).toContain('Ice bath');
    expect(html).toContain('Sleep pod');
    expect(html).toContain('Peak Performance Wellness');
    expect(html).toContain('ppwellness.co');
    // Property block rendered.
    expect(html).toContain('Cold Plunge');
  });

  it('escapes HTML in customer name (XSS)', () => {
    const order = makeOrder();
    const evil: CustomerInfo = { ...order.customer, name: '<script>alert(1)</script>' };
    const html = renderOrderConfirmationHtml(evil, order);
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
  });
});

describe('renderVicAlertHtml', () => {
  it('contains customer email + phone + address + notes', () => {
    const order = makeOrder();
    const html = renderVicAlertHtml(order);
    expect(html).toContain('buyer@example.com');
    expect(html).toContain('+230 5 555 1234');
    expect(html).toContain('1 Wellness Way');
    expect(html).toContain('Lift access only on weekdays');
  });
});

describe('send* (RESEND_API_KEY unset)', () => {
  beforeEach(() => {
    delete process.env.RESEND_API_KEY;
    _resetEmailClientForTests();
  });
  afterEach(() => {
    _resetEmailClientForTests();
  });

  it('sendOrderConfirmation → loggedOnly: true', async () => {
    const order = makeOrder();
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const res = await sendOrderConfirmation(order.customer, order);
    spy.mockRestore();
    expect(res.ok).toBe(true);
    expect(res.loggedOnly).toBe(true);
  });

  it('sendOrderAlertToVic → loggedOnly: true', async () => {
    const order = makeOrder();
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const res = await sendOrderAlertToVic(order.customer, order);
    spy.mockRestore();
    expect(res.ok).toBe(true);
    expect(res.loggedOnly).toBe(true);
  });
});
