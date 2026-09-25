// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('showcase client safety', () => {
  beforeEach(() => {
    vi.resetModules();
    window.sessionStorage.clear();
    window.history.replaceState({}, '', '/designer');
    vi.stubGlobal('__SHOWCASE_READ_ONLY__', false);
  });
  afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

  it.each(['/demo', '/demo/tintex', '/embed/designer', '/studio', '/pitch/tintex', '/designer?demo=tintex'])('protects %s and subsequent checkout navigation', async (url) => {
    window.history.replaceState({}, '', url);
    const safety = await import('../showcaseSafety');
    expect(safety.isShowcaseReadOnly()).toBe(true);
    window.history.replaceState({}, '', '/checkout');
    expect(safety.isShowcaseReadOnly()).toBe(true);
    expect(() => safety.assertShowcaseWritable()).toThrow(safety.DEMO_NOTICE);
    vi.resetModules();
    expect((await import('../showcaseSafety')).isShowcaseReadOnly()).toBe(true);
  });

  it('locks all routes in a preview build independently of user URL flags', async () => {
    vi.stubGlobal('__SHOWCASE_READ_ONLY__', true);
    window.history.replaceState({}, '', '/checkout?demo=false');
    expect((await import('../showcaseSafety')).isShowcaseReadOnly()).toBe(true);
  });

  it('retains session protection when browser storage is unavailable', async () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
    window.history.replaceState({}, '', '/demo');
    const safety = await import('../showcaseSafety');
    expect(safety.isShowcaseReadOnly()).toBe(true);
    window.history.replaceState({}, '', '/checkout');
    expect(safety.isShowcaseReadOnly()).toBe(true);
  });

  it('leaves normal production sessions writable', async () => {
    const safety = await import('../showcaseSafety');
    expect(safety.isShowcaseReadOnly()).toBe(false);
    expect(() => safety.assertShowcaseWritable()).not.toThrow();
  });

  it('handles limited browser contexts without location paths or storage', async () => {
    vi.stubGlobal('window', { location: { assign: vi.fn() } });
    expect((await import('../showcaseSafety')).isShowcaseReadOnly()).toBe(false);
  });

  it('prevents API submissions and manual fallback before any network request', async () => {
    vi.stubGlobal('__SHOWCASE_READ_ONLY__', true);
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const { DEMO_NOTICE } = await import('../showcaseSafety');
    const { startStripeCheckout } = await import('../stripe');
    const { startPaypalCheckout, capturePaypalOrder } = await import('../paypal');
    const { createGumroadOrder } = await import('../gumroadCheckout');
    const { saveDesignToApi, updateDesignToApi, submitLead } = await import('../designsApi');
    expect(await startStripeCheckout({} as never, fetchSpy)).toEqual({ status: 'error', message: DEMO_NOTICE });
    expect(await startPaypalCheckout({} as never, fetchSpy)).toEqual({ status: 'error', message: DEMO_NOTICE });
    expect(await capturePaypalOrder('test', 'test', fetchSpy)).toEqual({ ok: false, error: DEMO_NOTICE });
    await expect(createGumroadOrder({})).rejects.toThrow(DEMO_NOTICE);
    await expect(saveDesignToApi({} as never)).rejects.toThrow(DEMO_NOTICE);
    await expect(updateDesignToApi(42, {} as never)).rejects.toThrow(DEMO_NOTICE);
    await expect(submitLead({} as never)).rejects.toThrow(DEMO_NOTICE);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('does not create a manual local order in a showcase session', async () => {
    vi.stubGlobal('__SHOWCASE_READ_ONLY__', true);
    const { useOrdersStore } = await import('../../store/ordersStore');
    const { DEMO_NOTICE } = await import('../showcaseSafety');
    useOrdersStore.setState({ orders: [] });
    const saved = window.localStorage.getItem('wrd_orders');
    expect(() => useOrdersStore.getState().saveOrder({ id: 'demo-order' } as never)).toThrow(DEMO_NOTICE);
    expect(useOrdersStore.getState().orders).toEqual([]);
    expect(window.localStorage.getItem('wrd_orders')).toBe(saved);
  });

  it('keeps manual local orders available in a normal production session', async () => {
    const { useOrdersStore } = await import('../../store/ordersStore');
    useOrdersStore.setState({ orders: [] });
    const order = { id: 'normal-order', status: 'pending' } as const;
    useOrdersStore.getState().saveOrder(order as never);
    expect(useOrdersStore.getState().orders).toEqual([order]);
    expect(window.localStorage.getItem('wrd_orders')).toContain('normal-order');
    useOrdersStore.getState().clearOrders();
  });
});
