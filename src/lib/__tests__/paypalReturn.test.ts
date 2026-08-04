/**
 * PayPal return-leg tests — Phase 0 money-path (IMPL-1 defects 1 + 4).
 *
 * Covers:
 *   • return-param parsing (present / absent)
 *   • query-param stripping after capture
 *   • the capture orchestrator (success / failure / throw)
 *   • cart-preservation semantics: the marketplace cart survives a
 *     cancel-at-PayPal round trip and is cleared ONLY on capture success
 *     (exercised against the real zustand store).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  readPaypalReturnParams,
  stripPaypalReturnParams,
  runPaypalReturnCapture,
} from '../paypalReturn';
import { useMarketplaceCart } from '../../store/marketplaceCartStore';

describe('readPaypalReturnParams', () => {
  it('detects a PayPal return when token is present', () => {
    const r = readPaypalReturnParams('?rail=paypal&id=mp_1&token=PAYPAL-123&PayerID=XYZ');
    expect(r.isPaypalReturn).toBe(true);
    expect(r.token).toBe('PAYPAL-123');
  });
  it('is not a PayPal return without a token', () => {
    expect(readPaypalReturnParams('?id=mp_1').isPaypalReturn).toBe(false);
    expect(readPaypalReturnParams('').isPaypalReturn).toBe(false);
  });
});

describe('stripPaypalReturnParams', () => {
  it('removes token/PayerID/rail but keeps id + path + hash', () => {
    const cleaned = stripPaypalReturnParams(
      'https://designer.ppwellness.co/order/success?id=PPW-1&rail=paypal&token=T1&PayerID=P1#top',
    );
    expect(cleaned).toBe('/order/success?id=PPW-1#top');
  });
  it('leaves clean URLs alone', () => {
    expect(stripPaypalReturnParams('https://x.co/order/track/mp_1')).toBe('/order/track/mp_1');
  });
});

describe('runPaypalReturnCapture', () => {
  it('calls onSuccess only when the capture succeeds', async () => {
    const onSuccess = vi.fn();
    const onFailure = vi.fn();
    const ok = await runPaypalReturnCapture({
      token: 'T1',
      orderRef: 'mp_1',
      capture: vi.fn().mockResolvedValue({ ok: true }),
      onSuccess,
      onFailure,
    });
    expect(ok).toBe(true);
    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(onFailure).not.toHaveBeenCalled();
  });

  it('routes a failed capture to onFailure with the error message', async () => {
    const onSuccess = vi.fn();
    const onFailure = vi.fn();
    const ok = await runPaypalReturnCapture({
      token: 'T1',
      orderRef: 'mp_1',
      capture: vi.fn().mockResolvedValue({ ok: false, error: 'PayPal capture failed: 500' }),
      onSuccess,
      onFailure,
    });
    expect(ok).toBe(false);
    expect(onSuccess).not.toHaveBeenCalled();
    expect(onFailure).toHaveBeenCalledWith('PayPal capture failed: 500');
  });

  it('routes a thrown capture (network) to onFailure', async () => {
    const onFailure = vi.fn();
    const ok = await runPaypalReturnCapture({
      token: 'T1',
      orderRef: 'mp_1',
      capture: vi.fn().mockRejectedValue(new Error('network down')),
      onSuccess: vi.fn(),
      onFailure,
    });
    expect(ok).toBe(false);
    expect(onFailure).toHaveBeenCalledWith('network down');
  });

  it('is re-invocable for retry — second attempt can succeed after a failure', async () => {
    const capture = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, error: 'transient' })
      .mockResolvedValueOnce({ ok: true });
    const onSuccess = vi.fn();
    const onFailure = vi.fn();
    const args = { token: 'T1', orderRef: 'mp_1', capture, onSuccess, onFailure };
    expect(await runPaypalReturnCapture(args)).toBe(false);
    expect(await runPaypalReturnCapture(args)).toBe(true);
    expect(onFailure).toHaveBeenCalledTimes(1);
    expect(onSuccess).toHaveBeenCalledTimes(1);
  });
});

describe('cart preservation across the PayPal round trip (defect 4)', () => {
  beforeEach(() => {
    useMarketplaceCart.getState().clear();
    useMarketplaceCart.getState().addItem({
      productId: 42,
      sku: 'K1-A',
      name: 'Treadmill',
      category: 'fitness',
      unitPriceMinor: 100000,
      currency: 'MUR',
      imageUrl: null,
    });
  });

  it('cart is intact after a cancel-at-PayPal round trip (no capture ran)', () => {
    // Checkout redirect happens WITHOUT clearing (the page-level clear()
    // was removed); a cancel return renders checkout from the same store.
    expect(useMarketplaceCart.getState().items).toHaveLength(1);
  });

  it('cart is cleared ONLY on capture success', async () => {
    const clearOnSuccess = () => useMarketplaceCart.getState().clear();

    // Failed capture → cart stays.
    await runPaypalReturnCapture({
      token: 'T1',
      orderRef: 'mp_1',
      capture: vi.fn().mockResolvedValue({ ok: false, error: 'nope' }),
      onSuccess: clearOnSuccess,
      onFailure: () => undefined,
    });
    expect(useMarketplaceCart.getState().items).toHaveLength(1);

    // Successful capture → cart cleared.
    await runPaypalReturnCapture({
      token: 'T1',
      orderRef: 'mp_1',
      capture: vi.fn().mockResolvedValue({ ok: true }),
      onSuccess: clearOnSuccess,
      onFailure: () => undefined,
    });
    expect(useMarketplaceCart.getState().items).toHaveLength(0);
  });
});
