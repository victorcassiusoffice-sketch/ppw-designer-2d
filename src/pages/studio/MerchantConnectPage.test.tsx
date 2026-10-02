/** @vitest-environment jsdom */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import MerchantConnectPage from './MerchantConnectPage';
import { SESSION_STORAGE_KEY } from '../../components/RequireMerchant';
import { CATALOG_TEMPLATE } from '../../lib/merchants/catalogImport';

const mode = vi.hoisted(() => ({ preview: false }));
vi.mock('../../lib/showcaseSafety', () => ({ isShowcaseReadOnly: () => mode.preview }));
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let host: HTMLDivElement, root: Root;
beforeEach(() => { localStorage.clear(); sessionStorage.clear(); mode.preview = false; host = document.createElement('div'); document.body.append(host); root = createRoot(host); });
afterEach(() => { act(() => root.unmount()); host.remove(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
function session(slug = 'garden', expired = false) {
  const exp = Date.now() + (expired ? -1000 : 600000);
  const token = `${btoa(JSON.stringify({ slug, email: 'merchant@example.com', exp }))}.test-signature`;
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({ slug, email: 'merchant@example.com', exp, token }));
  return token;
}
function render(path = '/studio/merchants/connect', products?: unknown[]) {
  act(() => root.render(<MemoryRouter initialEntries={[{ pathname: path, state: products ? { catalogText: JSON.stringify(products) } : null }]}><Routes><Route path="/studio/merchants/connect" element={<MerchantConnectPage />} /><Route path="/merchant/:slug/connect" element={<MerchantConnectPage />} /></Routes></MemoryRouter>));
}
function button(text: string) {
  const element = [...host.querySelectorAll<HTMLButtonElement>('button')].find(node => node.textContent?.includes(text));
  if (!element) throw new Error(`Missing button ${text}`);
  return element;
}
const click = (text: string) => act(() => button(text).click());
function confirm() { act(() => host.querySelector<HTMLInputElement>('input[type=checkbox]')!.click()); }
const publish = () => act(async () => button('Publish reviewed products').click());
function review() { click('Validate and review'); click('Continue to connection'); }

describe('merchant connection preparation', () => {
  it('validates a sample, explains units and exports a preparation-only connection without publishing', () => {
    const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher);
    render(); expect(host.textContent).toContain('450000 means Rs 4,500.00');
    click('Use example'); click('Validate and review');
    expect(host.querySelector('tbody')?.textContent).toContain('600 × 650 × 850');
    click('Continue to connection');
    expect(host.textContent).toContain('Preparation only');
    expect(host.querySelector('input[type=checkbox]')).toBeNull();
    expect(host.textContent).toContain('GET /api/merchants/your-company/products');
    expect(host.textContent).toContain('/api/mcp');
    expect(host.querySelector<HTMLTextAreaElement>('textarea')?.value).toContain('/embed/designer?view=3d&panel=ai');
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('does not allow invalid dimensions or duplicate SKUs through review', () => {
    render('/studio/merchants/connect', [{ ...CATALOG_TEMPLATE[0], widthMm: 0 }, CATALOG_TEMPLATE[0], CATALOG_TEMPLATE[0]]);
    click('Validate and review');
    expect(host.querySelector('[role=alert]')?.textContent).toContain('widthMm');
    expect(host.querySelector('[role=alert]')?.textContent).toContain('duplicate SKU');
    expect(button('Continue to connection').disabled).toBe(true);
  });
  it('retains preparation-only mode on a preview even with a merchant session', () => {
    mode.preview = true; session(); render('/merchant/garden/connect', CATALOG_TEMPLATE); review();
    expect(host.textContent).toContain('Preparation only');
    expect(host.querySelector('input[type=checkbox]')).toBeNull();
  });
});

describe('explicit authenticated catalogue publication', () => {
  it('requires review and consent, sends the existing bearer contract, and skips confirmed SKUs on retry', async () => {
    const token = session(); const product = CATALOG_TEMPLATE[0];
    const fetcher = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ product: { id: 123, sku: product.sku } }) }); vi.stubGlobal('fetch', fetcher);
    render('/merchant/garden/connect', CATALOG_TEMPLATE); review();
    expect(button('Publish reviewed products').disabled).toBe(true); confirm(); await publish();
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher.mock.calls[0][0]).toBe('/api/merchants/garden/products');
    expect(fetcher.mock.calls[0][1].headers.Authorization).toBe(`Bearer ${token}`);
    expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual(product);
    expect(host.textContent).toContain('confirmed publication receipts');
    confirm(); await publish(); expect(fetcher).toHaveBeenCalledTimes(1);
    expect(sessionStorage.getItem('ppw_catalog_publish_v1:garden')).not.toContain(token);
  });
  it.each([() => Promise.reject(new Error('lost network')), () => Promise.resolve({ ok: false, status: 500 }), () => Promise.resolve({ ok: true, json: async () => ({ product: { id: 99, sku: 'wrong-sku' } }) })])('stops at an unknown outcome and never retries it or later products', async (failure) => {
    session(); const products = ['CHAIR-1', 'CHAIR-2', 'CHAIR-3'].map(sku => ({ ...CATALOG_TEMPLATE[0], sku }));
    const fetcher = vi.fn().mockResolvedValueOnce({ ok: true, json: async () => ({ product: { id: 11, sku: 'CHAIR-1' } }) }).mockImplementationOnce(failure); vi.stubGlobal('fetch', fetcher);
    render('/merchant/garden/connect', products); review(); confirm(); await publish();
    expect(fetcher).toHaveBeenCalledTimes(2);
    const receipts = JSON.parse(sessionStorage.getItem('ppw_catalog_publish_v1:garden')!);
    expect(receipts['CHAIR-1']).toEqual({ status: 'published', id: 11 }); expect(receipts['CHAIR-2'].status).toBe('unknown'); expect(receipts['CHAIR-3']).toBeUndefined();
    confirm(); await publish(); expect(fetcher).toHaveBeenCalledTimes(2);
    expect(host.textContent).toContain('previous request has an unknown outcome');
  });
  it.each([['other', false], ['garden', true]] as const)('does not publish with wrong or expired session %s/%s', (slug, expired) => {
    session(slug, expired); const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher);
    render('/merchant/garden/connect', CATALOG_TEMPLATE); review(); confirm();
    expect(button('Publish reviewed products').disabled).toBe(true); expect(fetcher).not.toHaveBeenCalled();
    expect(host.querySelector('a[href="/merchant/garden"][target]')?.getAttribute('target')).toBe('_blank');
  });
});
