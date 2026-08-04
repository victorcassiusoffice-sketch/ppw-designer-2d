/**
 * Unit tests for api/capturePaypalOrder.ts
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  processCaptureRequest,
  validateCaptureRequest,
  extractBuyerEmail,
  isAlreadyCapturedError,
} from '../_lib/paypal/captureOrder';
import { buildPaypalCustomId, parsePaypalCustomId } from '../_lib/paypal/customId';
import { _resetPaypalTokenCacheForTests } from '../_lib/paypalClient';

describe('validateCaptureRequest', () => {
  it('accepts valid body', () => {
    const v = validateCaptureRequest({ paypalOrderId: 'PAY-X', ppwOrderId: 'PPW-Y' });
    expect(v.ok).toBe(true);
  });
  it('rejects missing paypalOrderId', () => {
    expect(validateCaptureRequest({ ppwOrderId: 'PPW-Y' }).ok).toBe(false);
  });
  it('rejects missing ppwOrderId', () => {
    expect(validateCaptureRequest({ paypalOrderId: 'PAY-X' }).ok).toBe(false);
  });
  it('rejects non-object body', () => {
    expect(validateCaptureRequest(null).ok).toBe(false);
    expect(validateCaptureRequest('hi').ok).toBe(false);
  });
});

describe('processCaptureRequest', () => {
  const ORIGINAL_ENV = process.env;
  beforeEach(() => {
    _resetPaypalTokenCacheForTests();
    process.env = {
      ...ORIGINAL_ENV,
      PAYPAL_CLIENT_ID: 'test-client',
      PAYPAL_CLIENT_SECRET: 'test-secret',
      PAYPAL_ENV: 'sandbox',
    };
  });
  afterEach(() => {
    process.env = ORIGINAL_ENV;
  });

  it('returns 500 when env not configured', async () => {
    delete process.env.PAYPAL_CLIENT_SECRET;
    const res = await processCaptureRequest({ paypalOrderId: 'X', ppwOrderId: 'Y' });
    expect(res.status).toBe(500);
  });

  it('returns 400 on validation failure', async () => {
    const res = await processCaptureRequest({});
    expect(res.status).toBe(400);
  });

  it('happy path - COMPLETED status, recorder invoked', async () => {
    const fakeFetch = vi.fn(async (url: string |string | URL) => {
      const u = String(url);
      if (u.endsWith('/v1/oauth2/token')) {
        return new Response(JSON.stringify({ access_token: 'tok', expires_in: 3600 }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }
      if (u.includes('/capture')) {
        return new Response(
          JSON.stringify({
            id: 'PAYPAL-X',
            status: 'COMPLETED',
            purchase_units: [
              {
                payments: {
                  captures: [
                    { id: 'CAP-1', status: 'COMPLETED', amount: { currency_code: 'USD', value: '99.00' } },
                  ],
                },
              },
            ],
          }),
          { status: 201, headers: { 'content-type': 'application/json' } },
        );
      }
      throw new Error('Unexpected: ' + u);
    }) as unknown as typeof fetch;
    const recorder = vi.fn().mockResolvedValue({ ok: true });
    const res = await processCaptureRequest(
      { paypalOrderId: 'PAYPAL-X', ppwOrderId: 'PPW-Y' },
      fakeFetch,
      recorder,
    );
    expect(res.status).toBe(200);
    if (res.status === 200) expect(res.paymentStatus).toBe('captured');
    expect(recorder).toHaveBeenCalledWith('PPW-Y', 'PAYPAL-X', expect.any(Object));
  });

  it('returns 500 when capture status is not COMPLETED', async () => {
    const fakeFetch = vi.fn(async (url: string |string | URL) => {
      const u = String(url);
      if (u.endsWith('/v1/oauth2/token')) {
        return new Response(JSON.stringify({ access_token: 'tok', expires_in: 3600 }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({ id: 'X', status: 'PENDING' }), {
        status: 201,
        headers: { 'content-type': 'application/json' },
      });
    }) as unknown as typeof fetch;
    const res = await processCaptureRequest(
      { paypalOrderId: 'PAYPAL-X', ppwOrderId: 'PPW-Y' },
      fakeFetch,
      vi.fn(),
    );
    expect(res.status).toBe(500);
  });

  it('recorder failure does not break the 200', async () => {
    const fakeFetch = vi.fn(async (url: string |string | URL) => {
      const u = String(url);
      if (u.endsWith('/v1/oauth2/token')) {
        return new Response(JSON.stringify({ access_token: 'tok', expires_in: 3600 }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }
      return new Response(
        JSON.stringify({
          id: 'X',
          status: 'COMPLETED',
          purchase_units: [{ payments: { captures: [{ id: 'C', amount: { currency_code: 'USD', value: '1.00' } }] } }],
        }),
        { status: 201, headers: { 'content-type': 'application/json' } },
      );
    }) as unknown as typeof fetch;
    const recorder = vi.fn().mockResolvedValue({ ok: false, error: 'no db' });
    const res = await processCaptureRequest(
      { paypalOrderId: 'PAYPAL-X', ppwOrderId: 'PPW-Y' },
      fakeFetch,
      recorder,
    );
    expect(res.status).toBe(200);
  });

  it('422 ORDER_ALREADY_CAPTURED → 200 AND re-runs the recorder chain from a GET of the order (review P1)', async () => {
    // Scenario: the FIRST capture invocation died between the PayPal
    // capture succeeding and the recorders running (Vercel timeout).
    // The retry must not assume "the first capture recorded everything"
    // — it GETs the completed order and re-runs the (idempotent)
    // recorder chain.
    const fakeFetch = vi.fn(async (url: string | URL, init?: RequestInit) => {
      const u = String(url);
      if (u.endsWith('/v1/oauth2/token')) {
        return new Response(JSON.stringify({ access_token: 'tok', expires_in: 3600 }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }
      if (u.includes('/capture')) {
        return new Response(
          JSON.stringify({
            name: 'UNPROCESSABLE_ENTITY',
            details: [{ issue: 'ORDER_ALREADY_CAPTURED', description: 'Order already captured.' }],
          }),
          { status: 422, headers: { 'content-type': 'application/json' } },
        );
      }
      // GET /v2/checkout/orders/PAYPAL-X — the recovery read.
      if ((init?.method ?? 'GET') === 'GET' && u.includes('/v2/checkout/orders/PAYPAL-X')) {
        return new Response(
          JSON.stringify({
            id: 'PAYPAL-X',
            status: 'COMPLETED',
            purchase_units: [
              {
                payments: {
                  captures: [
                    { id: 'CAP-1', status: 'COMPLETED', amount: { currency_code: 'USD', value: '99.00' } },
                  ],
                },
              },
            ],
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        );
      }
      throw new Error('Unexpected: ' + u);
    }) as unknown as typeof fetch;
    const recorder = vi.fn().mockResolvedValue({ ok: true });
    const res = await processCaptureRequest(
      { paypalOrderId: 'PAYPAL-X', ppwOrderId: 'PPW-Y' },
      fakeFetch,
      recorder,
    );
    expect(res.status).toBe(200);
    if (res.status === 200) {
      expect(res.paymentStatus).toBe('captured');
      expect(res.alreadyCaptured).toBe(true);
    }
    // Recovery ran: orders row upsert re-invoked idempotently.
    expect(recorder).toHaveBeenCalledWith('PPW-Y', 'PAYPAL-X', expect.any(Object));
  });

  it('422 recovery is skipped (still 200) when the GET-order read fails', async () => {
    const fakeFetch = vi.fn(async (url: string | URL) => {
      const u = String(url);
      if (u.endsWith('/v1/oauth2/token')) {
        return new Response(JSON.stringify({ access_token: 'tok', expires_in: 3600 }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }
      if (u.includes('/capture')) {
        return new Response(
          JSON.stringify({ details: [{ issue: 'ORDER_ALREADY_CAPTURED' }] }),
          { status: 422, headers: { 'content-type': 'application/json' } },
        );
      }
      return new Response('{}', { status: 500, headers: { 'content-type': 'application/json' } });
    }) as unknown as typeof fetch;
    const recorder = vi.fn();
    const res = await processCaptureRequest(
      { paypalOrderId: 'PAYPAL-X', ppwOrderId: 'PPW-Y' },
      fakeFetch,
      recorder,
    );
    expect(res.status).toBe(200);
    if (res.status === 200) expect(res.alreadyCaptured).toBe(true);
    expect(recorder).not.toHaveBeenCalled();
  });

  it('records under the custom_id orderRef, not a mismatched client ppwOrderId (review P2)', async () => {
    const packed = buildPaypalCustomId('PPW-REAL', 'buyer@example.com');
    const fakeFetch = vi.fn(async (url: string | URL) => {
      const u = String(url);
      if (u.endsWith('/v1/oauth2/token')) {
        return new Response(JSON.stringify({ access_token: 'tok', expires_in: 3600 }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }
      return new Response(
        JSON.stringify({
          id: 'PAYPAL-X',
          status: 'COMPLETED',
          purchase_units: [
            {
              custom_id: packed,
              payments: {
                captures: [
                  {
                    id: 'CAP-1',
                    status: 'COMPLETED',
                    custom_id: packed,
                    amount: { currency_code: 'USD', value: '99.00' },
                  },
                ],
              },
            },
          ],
        }),
        { status: 201, headers: { 'content-type': 'application/json' } },
      );
    }) as unknown as typeof fetch;
    const recorder = vi.fn().mockResolvedValue({ ok: true });
    const res = await processCaptureRequest(
      { paypalOrderId: 'PAYPAL-X', ppwOrderId: 'PPW-FORGED' },
      fakeFetch,
      recorder,
    );
    expect(res.status).toBe(200);
    expect(recorder).toHaveBeenCalledWith('PPW-REAL', 'PAYPAL-X', expect.any(Object));
  });

  it('still 500s on a 422 that is NOT already-captured', async () => {
    const fakeFetch = vi.fn(async (url: string | URL) => {
      const u = String(url);
      if (u.endsWith('/v1/oauth2/token')) {
        return new Response(JSON.stringify({ access_token: 'tok', expires_in: 3600 }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }
      return new Response(
        JSON.stringify({ details: [{ issue: 'INSTRUMENT_DECLINED' }] }),
        { status: 422, headers: { 'content-type': 'application/json' } },
      );
    }) as unknown as typeof fetch;
    const res = await processCaptureRequest(
      { paypalOrderId: 'PAYPAL-X', ppwOrderId: 'PPW-Y' },
      fakeFetch,
      vi.fn(),
    );
    expect(res.status).toBe(500);
  });
});

describe('isAlreadyCapturedError', () => {
  it('detects the ORDER_ALREADY_CAPTURED issue', () => {
    expect(isAlreadyCapturedError({ details: [{ issue: 'ORDER_ALREADY_CAPTURED' }] })).toBe(true);
  });
  it('rejects other issues / malformed bodies', () => {
    expect(isAlreadyCapturedError({ details: [{ issue: 'INSTRUMENT_DECLINED' }] })).toBe(false);
    expect(isAlreadyCapturedError(null)).toBe(false);
    expect(isAlreadyCapturedError({})).toBe(false);
    expect(isAlreadyCapturedError('nope')).toBe(false);
  });
});

describe('buyer email extraction (defect 5)', () => {
  it('custom_id round-trips orderRef + email', () => {
    const packed = buildPaypalCustomId('mp_abc123', 'buyer@example.com');
    expect(parsePaypalCustomId(packed)).toEqual({
      orderRef: 'mp_abc123',
      email: 'buyer@example.com',
    });
  });

  it('parse handles orderRef-only and empty values', () => {
    expect(parsePaypalCustomId('mp_abc')).toEqual({ orderRef: 'mp_abc', email: null });
    expect(parsePaypalCustomId('')).toEqual({ orderRef: null, email: null });
    expect(parsePaypalCustomId(undefined)).toEqual({ orderRef: null, email: null });
  });

  it('prefers the checkout email from custom_id over the PayPal payer email', () => {
    const email = extractBuyerEmail({
      payer: { email_address: 'paypal-account@example.com' },
      purchase_units: [
        {
          payments: {
            captures: [
              {
                custom_id: buildPaypalCustomId('PPW-1', 'checkout@example.com'),
                amount: { currency_code: 'MUR', value: '1000.00' },
              },
            ],
          },
        },
      ],
    });
    expect(email).toBe('checkout@example.com');
  });

  it('falls back to the PayPal payer email when custom_id has no email', () => {
    const email = extractBuyerEmail({
      payer: { email_address: 'paypal-account@example.com' },
      purchase_units: [{ payments: { captures: [{ custom_id: 'PPW-1' }] } }],
    });
    expect(email).toBe('paypal-account@example.com');
  });

  it('returns empty string when nothing is available', () => {
    expect(extractBuyerEmail({})).toBe('');
  });
});
