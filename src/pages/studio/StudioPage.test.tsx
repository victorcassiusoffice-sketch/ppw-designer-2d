/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { ShowcaseCheckoutGuard, StudioDesignerPage, StudioShopFrame } from './StudioPage';

const policy = vi.hoisted(() => ({ readOnly: true, checked: vi.fn() }));
vi.mock('../../lib/showcaseSafety', () => ({ isShowcaseReadOnly: () => { policy.checked(); return policy.readOnly; } }));
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let container: HTMLDivElement;
let root: Root;
beforeEach(() => { policy.readOnly = true; policy.checked.mockClear(); container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container); });
afterEach(() => { act(() => root.unmount()); container.remove(); });

describe('Studio safety and view navigation', () => {
  it('does not mount or run payment page side effects in a demo', () => {
    const paymentMount = vi.fn();
    function PaymentPage() { paymentMount(); return <form>Payment</form>; }
    act(() => root.render(<MemoryRouter><ShowcaseCheckoutGuard><PaymentPage /></ShowcaseCheckoutGuard></MemoryRouter>));
    expect(paymentMount).not.toHaveBeenCalled();
    expect(container.querySelector('form')).toBeNull();
    expect(container.textContent).toContain('No orders are placed');
    expect(container.querySelector('a[href="/studio/shop"]')).not.toBeNull();
  });
  it('retains the normal checkout in a live non-demo session', () => {
    policy.readOnly = false;
    act(() => root.render(<MemoryRouter><ShowcaseCheckoutGuard><form aria-label="Payment">Live payment</form></ShowcaseCheckoutGuard></MemoryRouter>));
    expect(container.querySelector('form')?.textContent).toBe('Live payment');
  });
  it('opens the same editable demo in the selected 2D or 3D view', () => {
    act(() => root.render(<MemoryRouter initialEntries={['/studio/designer?view=2d']}><StudioDesignerPage /></MemoryRouter>));
    const frame = container.querySelector('iframe')!;
    const posted = vi.spyOn(frame.contentWindow!, 'postMessage');
    expect(frame.getAttribute('src')).toBe('/embed/designer?scene=home&view=2d');
    const premium = [...container.querySelectorAll('button')].find((button) => button.textContent === 'Premium 3D')!;
    act(() => premium.click());
    expect(container.querySelector('iframe')).toBe(frame);
    expect(frame.getAttribute('src')).toBe('/embed/designer?scene=home&view=2d');
    expect(posted).toHaveBeenCalledWith({ type: 'ppw:designer-view', view: '3d' }, window.location.origin);
    expect(premium.getAttribute('aria-pressed')).toBe('true');
    expect(container.querySelector('a[aria-label="Open designer alone in a new tab"]')?.getAttribute('href')).toBe('/demo?view=3d');
    act(() => window.dispatchEvent(new MessageEvent('message', { source: frame.contentWindow, origin: window.location.origin, data: { type: 'ppw:designer-view-state', view: '2d' } })));
    expect(premium.getAttribute('aria-pressed')).toBe('false');
    expect(container.querySelector('iframe')).toBe(frame);
    act(() => premium.click());
    expect(posted).toHaveBeenLastCalledWith({ type: 'ppw:designer-view', view: '3d' }, window.location.origin);
  });
  it('marks a direct Studio Shop entry as a demo before rendering its catalogue', () => {
    let markedBeforeCatalog = false;
    function Catalog() { markedBeforeCatalog = policy.checked.mock.calls.length > 0; return <p>Products</p>; }
    act(() => root.render(<MemoryRouter><StudioShopFrame><Catalog /></StudioShopFrame></MemoryRouter>));
    expect(markedBeforeCatalog).toBe(true);
    expect(policy.checked).toHaveBeenCalled();
  });
});
