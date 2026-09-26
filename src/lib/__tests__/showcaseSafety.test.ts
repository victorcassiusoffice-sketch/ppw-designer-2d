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

  it.each(['/demo', '/demo/tintex', '/embed/designer', '/studio', '/studio/shop', '/pitch/tintex', '/pitch/merchants'])('protects %s and subsequent checkout navigation', async (url) => {
    window.history.replaceState({}, '', url);
    const safety = await import('../showcaseSafety');
    expect(safety.isShowcaseReadOnly()).toBe(true);
    window.history.replaceState({}, '', '/checkout');
    expect(safety.isShowcaseReadOnly()).toBe(true);
    expect(() => safety.assertShowcaseWritable()).toThrow(safety.DEMO_NOTICE);
    vi.resetModules();
    expect((await import('../showcaseSafety')).isShowcaseReadOnly()).toBe(true);
  });

  it('blocks demo -> checkout, including a reload straight onto the marketplace checkout', async () => {
    window.history.replaceState({}, '', '/demo');
    expect((await import('../showcaseSafety')).isShowcaseReadOnly()).toBe(true);
    vi.resetModules();
    window.history.replaceState({}, '', '/marketplace/checkout');
    const safety = await import('../showcaseSafety');
    expect(safety.isShowcaseReadOnly()).toBe(true);
    expect(() => safety.assertShowcaseWritable()).toThrow(safety.DEMO_NOTICE);
  });

  it('is transactional again for pitch -> designer -> checkout in one tab', async () => {
    window.history.replaceState({}, '', '/pitch/merchants');
    const safety = await import('../showcaseSafety');
    expect(safety.isShowcaseReadOnly()).toBe(true);
    expect(window.sessionStorage.getItem('ppw_showcase_read_only')).toBe('1');
    window.history.replaceState({}, '', '/designer');
    expect(safety.isShowcaseReadOnly()).toBe(false);
    expect(window.sessionStorage.getItem('ppw_showcase_read_only')).toBeNull();
    window.history.replaceState({}, '', '/checkout');
    expect(safety.isShowcaseReadOnly()).toBe(false);
    expect(() => safety.assertShowcaseWritable()).not.toThrow();
    // A fresh module (full reload on the payment page) reads the cleared storage the same way.
    vi.resetModules();
    expect((await import('../showcaseSafety')).isShowcaseReadOnly()).toBe(false);
  });

  it.each(['/products', '/products/12', '/cart', '/marketplace/cart', '/'])('clears a studio session on %s so the following checkout pays', async (url) => {
    window.history.replaceState({}, '', '/studio/designer?view=3d');
    const safety = await import('../showcaseSafety');
    expect(safety.isShowcaseReadOnly()).toBe(true);
    window.history.replaceState({}, '', url);
    expect(safety.isShowcaseReadOnly()).toBe(false);
    window.history.replaceState({}, '', '/marketplace/checkout');
    expect(safety.isShowcaseReadOnly()).toBe(false);
  });

  it.each(['/designer?demo=tintex', '/designer?demo=courts', '/designer?demo=sofap', '/designer?demo=captamarin'])('keeps the legacy meeting-pack URL %s transactional', async (url) => {
    window.history.replaceState({}, '', url);
    const safety = await import('../showcaseSafety');
    expect(safety.isShowcaseReadOnly()).toBe(false);
    expect(() => safety.assertShowcaseWritable()).not.toThrow();
    window.history.replaceState({}, '', '/checkout');
    expect(safety.isShowcaseReadOnly()).toBe(false);
  });

  it('never treats ?demo=off as a demo', async () => {
    window.history.replaceState({}, '', '/designer?demo=off');
    const safety = await import('../showcaseSafety');
    expect(safety.isShowcaseReadOnly()).toBe(false);
    expect(window.sessionStorage.getItem('ppw_showcase_read_only')).toBeNull();
  });

  it('classifies the read-only families by path alone', async () => {
    const { isShowcaseRoute } = await import('../showcaseSafety');
    for (const path of ['/demo', '/demo/', '/embed/designer', '/embed/designer/', '/studio', '/studio/shop', '/studio/designer', '/pitch/developers', '/pitch/merchants']) expect(isShowcaseRoute(path), path).toBe(true);
    for (const path of ['/', '/designer', '/products', '/cart', '/checkout', '/marketplace/checkout', '/studios', '/embed', '/demos', '/pitcher']) expect(isShowcaseRoute(path), path).toBe(false);
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
