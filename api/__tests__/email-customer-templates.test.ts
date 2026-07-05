/**
 * Tests for the W0.D M9.A.3 customer-loop email templates.
 *
 * Content checks only — no Resend mocks. Asserts subject lines are
 * sensible, the canonical palette is wired, escapeHtml is applied,
 * and each template surfaces the dynamic fields it claims to.
 */

import { describe, it, expect } from 'vitest';
import {
  renderDesignSaved,
  renderOrderConfirmed,
  renderMerchantOnboard,
  renderOrderShipped,
} from '../_lib/email/templates';

describe('renderDesignSaved', () => {
  it('subject leads with the design name and uses the canonical phrase', () => {
    const r = renderDesignSaved({
      customerName: 'Aanya',
      designName: 'Tamarin Sea Room',
      designUrl: 'https://designer.ppwellness.co/my-designs?t=abc',
    });
    expect(r.subject).toBe('Your wellness room design — Tamarin Sea Room');
  });

  it('embeds the design URL', () => {
    const r = renderDesignSaved({
      customerName: 'Aanya',
      designName: 'X',
      designUrl: 'https://designer.ppwellness.co/my-designs?t=abc',
    });
    expect(r.html).toContain('https://designer.ppwellness.co/my-designs?t=abc');
  });

  it('omits the cart line when no cartSummary provided', () => {
    const r = renderDesignSaved({ customerName: 'Aanya', designName: 'X', designUrl: 'https://x' });
    expect(r.html).not.toContain('subtotal of');
  });

  it('includes the cart line + formats MUR thousands when cartSummary present', () => {
    const r = renderDesignSaved({
      customerName: 'Aanya',
      designName: 'X',
      designUrl: 'https://x',
      cartSummary: { itemCount: 3, subtotalMur: 12500 },
    });
    expect(r.html).toContain('3 items');
    expect(r.html).toContain('MUR 12,500');
  });

  it('escapes user-controlled fields in the HTML body', () => {
    const r = renderDesignSaved({
      customerName: '<script>alert(1)</script>',
      designName: 'X',
      designUrl: 'https://x',
    });
    expect(r.html).not.toContain('<script>alert(1)</script>');
    expect(r.html).toContain('&lt;script&gt;');
  });

  it('uses the canonical gold palette (not clinic teal)', () => {
    const r = renderDesignSaved({ customerName: 'A', designName: 'X', designUrl: 'https://x' });
    expect(r.html).toContain('#C0A67E'); // canonical gold
    expect(r.html).not.toContain('#1f4a4a'); // legacy clinic teal must NOT appear
  });
});

describe('renderOrderConfirmed', () => {
  function payload(overrides: Partial<Parameters<typeof renderOrderConfirmed>[0]> = {}) {
    return {
      customerName: 'Aanya',
      orderRef: 'PPW-ORD-001',
      totalMur: 24500,
      currency: 'MUR',
      trackingUrl: 'https://designer.ppwellness.co/order/track/PPW-ORD-001',
      merchantBreakdown: [
        { merchantName: 'Aurora Wellness', itemCount: 2, subtotalMur: 14500 },
        { merchantName: 'Sangaree Plants', itemCount: 1, subtotalMur: 10000 },
      ],
      ...overrides,
    };
  }

  it('subject states "Order confirmed" + ref', () => {
    const r = renderOrderConfirmed(payload());
    expect(r.subject).toBe('Order confirmed — PPW-ORD-001');
  });

  it('embeds totals + each merchant row', () => {
    const r = renderOrderConfirmed(payload());
    expect(r.html).toContain('MUR 24,500');
    expect(r.html).toContain('Aurora Wellness');
    expect(r.html).toContain('Sangaree Plants');
    expect(r.html).toContain('2× · MUR 14,500');
    expect(r.html).toContain('1× · MUR 10,000');
  });

  it('embeds the tracking URL with a Track button', () => {
    const r = renderOrderConfirmed(payload());
    expect(r.html).toContain('https://designer.ppwellness.co/order/track/PPW-ORD-001');
    expect(r.html).toContain('Track this order');
  });

  it('handles single-merchant orders cleanly', () => {
    const r = renderOrderConfirmed(
      payload({ merchantBreakdown: [{ merchantName: 'Solo', itemCount: 1, subtotalMur: 100 }] }),
    );
    expect(r.html).toContain('Solo');
  });
});

describe('renderMerchantOnboard', () => {
  it('subject welcomes by brand name', () => {
    const r = renderMerchantOnboard({
      contactName: 'Reema',
      brandName: 'Aurora Wellness Ltd',
      portalUrl: 'https://x.com/portal',
      agentUrl: 'https://x.com/agent',
    });
    expect(r.subject).toBe('Welcome to the PPW Marketplace — Aurora Wellness Ltd');
  });

  it('embeds both the portal URL and agent URL', () => {
    const r = renderMerchantOnboard({
      contactName: 'Reema',
      brandName: 'X',
      portalUrl: 'https://portal',
      agentUrl: 'https://agent',
    });
    expect(r.html).toContain('https://portal');
    expect(r.html).toContain('https://agent');
  });
});

describe('renderOrderShipped', () => {
  function payload(overrides: Partial<Parameters<typeof renderOrderShipped>[0]> = {}) {
    return {
      customerName: 'Aanya',
      orderRef: 'PPW-ORD-001',
      merchantName: 'Aurora Wellness',
      carrier: 'Mauritius Post',
      trackingNumber: 'MP123456789MU',
      trackingUrl: 'https://designer.ppwellness.co/order/track/PPW-ORD-001',
      ...overrides,
    };
  }

  it('subject states "Shipped" + ref + merchant', () => {
    const r = renderOrderShipped(payload());
    expect(r.subject).toBe('Shipped — PPW-ORD-001 from Aurora Wellness');
  });

  it('embeds the tracking number + URL', () => {
    const r = renderOrderShipped(payload());
    expect(r.html).toContain('MP123456789MU');
    expect(r.html).toContain('https://designer.ppwellness.co/order/track/PPW-ORD-001');
  });

  it('includes ETA line when estimatedArrival provided', () => {
    const r = renderOrderShipped(payload({ estimatedArrival: '2026-05-25' }));
    expect(r.html).toContain('Estimated arrival');
    expect(r.html).toContain('2026-05-25');
  });

  it('omits ETA line when estimatedArrival absent', () => {
    const r = renderOrderShipped(payload());
    expect(r.html).not.toContain('Estimated arrival');
  });
});

describe('shared shell / brand discipline', () => {
  it.each([
    ['renderDesignSaved', renderDesignSaved({ customerName: 'X', designName: 'Y', designUrl: 'https://x' })],
    ['renderOrderConfirmed', renderOrderConfirmed({
      customerName: 'X', orderRef: 'R', totalMur: 1, currency: 'MUR', trackingUrl: 'https://x',
      merchantBreakdown: [{ merchantName: 'M', itemCount: 1, subtotalMur: 1 }],
    })],
    ['renderMerchantOnboard', renderMerchantOnboard({ contactName: 'X', brandName: 'Y', portalUrl: 'https://p', agentUrl: 'https://a' })],
    ['renderOrderShipped', renderOrderShipped({
      customerName: 'X', orderRef: 'R', merchantName: 'M', carrier: 'C', trackingNumber: 'T', trackingUrl: 'https://x',
    })],
  ])('%s includes brand wordmark + science snippet P.S.', (_name, rendered) => {
    expect(rendered.html).toContain('Peak Performance Wellness');
    expect(rendered.html).toContain('P.S.');
  });

  it.each([
    ['renderDesignSaved', renderDesignSaved({ customerName: 'X', designName: 'Y', designUrl: 'https://x' })],
    ['renderOrderConfirmed', renderOrderConfirmed({
      customerName: 'X', orderRef: 'R', totalMur: 1, currency: 'MUR', trackingUrl: 'https://x',
      merchantBreakdown: [{ merchantName: 'M', itemCount: 1, subtotalMur: 1 }],
    })],
    ['renderMerchantOnboard', renderMerchantOnboard({ contactName: 'X', brandName: 'Y', portalUrl: 'https://p', agentUrl: 'https://a' })],
    ['renderOrderShipped', renderOrderShipped({
      customerName: 'X', orderRef: 'R', merchantName: 'M', carrier: 'C', trackingNumber: 'T', trackingUrl: 'https://x',
    })],
  ])('%s renders a complete HTML document', (_name, rendered) => {
    expect(rendered.html.startsWith('<!doctype html>')).toBe(true);
    expect(rendered.html).toContain('</body></html>');
  });
});
