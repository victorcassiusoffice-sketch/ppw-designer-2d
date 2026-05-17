/**
 * V4 M9.A.1 — dispatchDesignSavedEmail unit tests.
 *
 * Mocks sendEmail so the helper's per-trigger payload contract is
 * exercised without hitting Resend or KV.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const sendEmail = vi.fn();
vi.mock('../../../lib/email/send.js', () => ({
  sendEmail: (args: unknown) => sendEmail(args),
}));

import {
  dispatchDesignSavedEmail,
  dispatchOrderConfirmedEmail,
  deriveGreetingName,
} from '../../../lib/email/dispatch';

describe('deriveGreetingName', () => {
  it('uses the email-prefix as a friendly proxy name', () => {
    expect(deriveGreetingName('vic@ppwellness.co')).toBe('Vic');
  });

  it('preserves dots in the prefix (no further parsing)', () => {
    expect(deriveGreetingName('vic.cassius@ppwellness.co')).toBe('Vic.cassius');
  });

  it('falls back to "there" for an empty / @-only address', () => {
    expect(deriveGreetingName('')).toBe('there');
    expect(deriveGreetingName('@x.com')).toBe('there');
  });

  it('handles upper-case prefix already (capitalize idempotent on first char)', () => {
    expect(deriveGreetingName('VIC@x.com')).toBe('VIC');
  });
});

describe('dispatchDesignSavedEmail', () => {
  beforeEach(() => {
    sendEmail.mockReset();
    sendEmail.mockResolvedValue({ ok: true, id: 're_x', dedupKey: 'k' });
  });

  it('skips when customerEmail is null (no fire, no send)', async () => {
    const r = await dispatchDesignSavedEmail({ id: 1, name: 'Quiet room', customerEmail: null });
    expect(r.fired).toBe(false);
    expect(r.skippedReason).toBe('no_customer_email');
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('skips when customerEmail is whitespace-only', async () => {
    const r = await dispatchDesignSavedEmail({ id: 2, name: 'X', customerEmail: '   ' });
    expect(r.fired).toBe(false);
    expect(r.skippedReason).toBe('no_customer_email');
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('fires sendEmail with the design-saved template + correct payload shape', async () => {
    const r = await dispatchDesignSavedEmail({
      id: 42,
      name: 'Morning light room',
      customerEmail: 'maya@example.com',
    });
    expect(r.fired).toBe(true);
    expect(sendEmail).toHaveBeenCalledTimes(1);
    const args = sendEmail.mock.calls[0]?.[0];
    expect(args).toBeDefined();
    expect(args.to).toBe('maya@example.com');
    expect(args.template).toBe('design-saved');
    expect(args.subject).toContain('Morning light room');
    expect(args.html).toContain('Maya'); // capitalised email-prefix greeting
    expect(args.html).toContain('/my-designs#42'); // designUrl includes id
    expect(args.payload).toEqual({ designId: 42, designName: 'Morning light room' });
  });

  it('coerces bigint id from Drizzle to number for the payload + URL', async () => {
    await dispatchDesignSavedEmail({
      id: 1234567890n as unknown as bigint,
      name: 'Big',
      customerEmail: 'b@x.com',
    });
    const args = sendEmail.mock.calls[0]?.[0];
    expect(args.payload.designId).toBe(1234567890);
    expect(args.html).toContain('/my-designs#1234567890');
  });

  it('catches sendEmail throw + returns caller_caught (does NOT re-throw)', async () => {
    sendEmail.mockRejectedValueOnce(new Error('Resend down'));
    const r = await dispatchDesignSavedEmail({
      id: 5,
      name: 'Room',
      customerEmail: 'c@x.com',
    });
    expect(r.fired).toBe(false);
    expect(r.skippedReason).toBe('caller_caught');
    expect(r.error).toBe('Resend down');
  });

  it('passes through send.ok=false result without raising', async () => {
    sendEmail.mockResolvedValueOnce({ ok: false, code: 'rate_limit', error: 'budget', dedupKey: 'k' });
    const r = await dispatchDesignSavedEmail({
      id: 6,
      name: 'Room',
      customerEmail: 'c@x.com',
    });
    expect(r.fired).toBe(true);
    expect(r.send?.ok).toBe(false);
    expect(r.send?.code).toBe('rate_limit');
  });
});

describe('dispatchOrderConfirmedEmail (M9.A.2)', () => {
  beforeEach(() => {
    sendEmail.mockReset();
    sendEmail.mockResolvedValue({ ok: true, id: 're_oc', dedupKey: 'k' });
  });

  it('skips when customerEmail is null', async () => {
    const r = await dispatchOrderConfirmedEmail({
      ppwOrderId: 'PPW-1',
      customerEmail: null,
      totalMinor: 12500,
      currency: 'USD',
    });
    expect(r.fired).toBe(false);
    expect(r.skippedReason).toBe('no_customer_email');
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('skips when customerEmail is whitespace-only', async () => {
    const r = await dispatchOrderConfirmedEmail({
      ppwOrderId: 'PPW-2',
      customerEmail: '   ',
      totalMinor: 12500,
      currency: 'USD',
    });
    expect(r.fired).toBe(false);
    expect(r.skippedReason).toBe('no_customer_email');
  });

  it('fires sendEmail with order-confirmed template + correct payload', async () => {
    const r = await dispatchOrderConfirmedEmail({
      ppwOrderId: 'PPW-42',
      customerEmail: 'buyer@example.com',
      totalMinor: 12500,
      currency: 'USD',
    });
    expect(r.fired).toBe(true);
    expect(sendEmail).toHaveBeenCalledTimes(1);
    const args = sendEmail.mock.calls[0]?.[0];
    expect(args.template).toBe('order-confirmed');
    expect(args.to).toBe('buyer@example.com');
    expect(args.subject).toContain('PPW-42');
    expect(args.payload).toMatchObject({
      ppwOrderId: 'PPW-42',
      totalMinor: 12500,
      currency: 'USD',
    });
  });

  it('converts non-MUR totalMinor (USD/EUR cents) to whole MUR for display', async () => {
    await dispatchOrderConfirmedEmail({
      ppwOrderId: 'PPW-1',
      customerEmail: 'c@x.com',
      totalMinor: 12500, // $125.00 in cents
      currency: 'USD',
    });
    const args = sendEmail.mock.calls[0]?.[0];
    // 12500 cents / 100 = 125; html should reference 125 not 12500
    expect(args.html).toContain('125');
    expect(args.html).not.toContain('12,500');
  });

  it('preserves MUR totalMinor as-is (MUR has no subunits in the wire format)', async () => {
    await dispatchOrderConfirmedEmail({
      ppwOrderId: 'PPW-1',
      customerEmail: 'c@x.com',
      totalMinor: 50000,
      currency: 'MUR',
    });
    const args = sendEmail.mock.calls[0]?.[0];
    expect(args.html).toContain('50,000');
  });

  it('uses explicit customerName when supplied (PayPal payer.name.given_name)', async () => {
    await dispatchOrderConfirmedEmail({
      ppwOrderId: 'PPW-1',
      customerEmail: 'mystery@x.com',
      totalMinor: 1,
      currency: 'MUR',
      customerName: 'Aanya',
    });
    const args = sendEmail.mock.calls[0]?.[0];
    expect(args.html).toContain('Aanya');
  });

  it('falls back to email-prefix greeting when no customerName supplied', async () => {
    await dispatchOrderConfirmedEmail({
      ppwOrderId: 'PPW-1',
      customerEmail: 'vic@x.com',
      totalMinor: 1,
      currency: 'MUR',
    });
    const args = sendEmail.mock.calls[0]?.[0];
    expect(args.html).toContain('Vic');
  });

  it('uses placeholder single-merchant breakdown when none supplied', async () => {
    await dispatchOrderConfirmedEmail({
      ppwOrderId: 'PPW-1',
      customerEmail: 'c@x.com',
      totalMinor: 10000,
      currency: 'MUR',
    });
    const args = sendEmail.mock.calls[0]?.[0];
    expect(args.payload.merchantCount).toBe(1);
    expect(args.html).toContain('Peak Performance Wellness Marketplace');
  });

  it('passes through supplied merchantBreakdown verbatim', async () => {
    await dispatchOrderConfirmedEmail({
      ppwOrderId: 'PPW-1',
      customerEmail: 'c@x.com',
      totalMinor: 30000,
      currency: 'MUR',
      merchantBreakdown: [
        { merchantName: 'Tamarin Rattan', itemCount: 2, subtotalMur: 20000 },
        { merchantName: 'Zen Saunas', itemCount: 1, subtotalMur: 10000 },
      ],
    });
    const args = sendEmail.mock.calls[0]?.[0];
    expect(args.payload.merchantCount).toBe(2);
    expect(args.html).toContain('Tamarin Rattan');
    expect(args.html).toContain('Zen Saunas');
  });

  it('catches sendEmail throw + returns caller_caught (does NOT re-throw)', async () => {
    sendEmail.mockRejectedValueOnce(new Error('Resend down'));
    const r = await dispatchOrderConfirmedEmail({
      ppwOrderId: 'PPW-1',
      customerEmail: 'c@x.com',
      totalMinor: 1,
      currency: 'MUR',
    });
    expect(r.fired).toBe(false);
    expect(r.skippedReason).toBe('caller_caught');
    expect(r.error).toBe('Resend down');
  });

  it('encodes ppwOrderId in the tracking URL', async () => {
    await dispatchOrderConfirmedEmail({
      ppwOrderId: 'PPW/special?id',
      customerEmail: 'c@x.com',
      totalMinor: 1,
      currency: 'MUR',
    });
    const args = sendEmail.mock.calls[0]?.[0];
    expect(args.html).toContain(encodeURIComponent('PPW/special?id'));
  });
});
