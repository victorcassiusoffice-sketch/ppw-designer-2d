/**
 * Unit tests for api/capturePaypalOrder.ts
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  processCaptureRequest,
  validateCaptureRequest,
} from '../lib/paypal/captureOrder';
import { _resetPaypalTokenCacheForTests } from '../lib/paypalClient';

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
});
