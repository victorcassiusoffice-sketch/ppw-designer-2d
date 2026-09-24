/** @vitest-environment jsdom */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SimsDock } from '../desktop/SimsDock';
import { SimsBottomToolbar } from '../mobile/SimsBottomToolbar';
import { useDesignerUIStore } from '../../store/designerUIStore';

vi.mock('../../lib/useMerchantCatalog', () => ({ useMerchantCatalog: () => [] }));
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;
let frames: FrameRequestCallback[];

beforeEach(() => {
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  frames = [];
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { frames.push(callback); return frames.length; });
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
  useDesignerUIStore.setState({ viewMode: 'plan', tool: 'hand' });
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  useDesignerUIStore.setState({ viewMode: 'plan', tool: 'hand' });
  vi.unstubAllGlobals();
});

function openCatalog(category?: string) {
  act(() => window.dispatchEvent(new CustomEvent('ppw:open-catalog', { detail: { category } })));
  act(() => { frames.splice(0).forEach((callback) => callback(0)); });
}

describe('workspace catalog navigation', () => {
  it('opens and focuses the requested desktop category without opening the hidden phone dock', () => {
    vi.stubGlobal('innerWidth', 1440);
    act(() => root.render(<><SimsDock /><SimsBottomToolbar /></>));
    expect(host.querySelector('[data-testid="dock-strip"]')).not.toBeNull();
    act(() => useDesignerUIStore.getState().setViewMode('3d'));
    expect(host.querySelector('[data-testid="sims-dock"]')?.getAttribute('data-catalog-mode')).toBe('3d');
    expect(host.querySelector('[data-testid="dock-strip"]')).toBeNull();
    openCatalog('eco');
    expect(host.querySelector('[data-testid="sims-dock"] .catalog-browser-header strong')?.textContent).toBe('Eco');
    expect(document.activeElement).toBe(host.querySelector('[data-testid="dock-search"]'));
    const cards = host.querySelectorAll('[data-testid="dock-strip"] [data-product-id]');
    expect(cards.length).toBeGreaterThan(0);
    expect([...cards].every((card) => card.getAttribute('data-macro') === 'eco')).toBe(true);
    expect(host.querySelector('[data-testid="sims-thumb-strip"]')).toBeNull();
  });

  it('opens the phone catalog without bringing up its keyboard or stealing focus into the desktop dock', () => {
    vi.stubGlobal('innerWidth', 390);
    useDesignerUIStore.setState({ viewMode: '3d' });
    act(() => root.render(<><SimsDock /><SimsBottomToolbar /></>));
    openCatalog('eco');
    expect(host.querySelector('[data-testid="sims-bottom-toolbar"] .catalog-browser-header strong')?.textContent).toBe('Eco');
    expect(document.activeElement).toBe(host.querySelector('[data-testid="sims-bottom-toolbar"] .catalog-browser-back'));
    expect(host.querySelector('[data-testid="sims-thumb-strip"]')).not.toBeNull();
    expect(host.querySelector('[data-testid="dock-strip"]')).toBeNull();
    openCatalog('not-a-category');
    expect(document.activeElement).toBe(host.querySelector('[data-testid="sims-cat-all"]'));
  });

  it('opens a single category home, replaces it with products, then returns with Back', () => {
    vi.stubGlobal('innerWidth', 390);
    useDesignerUIStore.setState({ viewMode: '3d' });
    act(() => root.render(<SimsBottomToolbar />));
    openCatalog();
    expect(host.querySelector('.catalog-home')).not.toBeNull();
    expect(host.querySelector('[data-testid="sims-thumb-strip"]')).toBeNull();
    act(() => (host.querySelector('[data-testid="sims-cat-eco"]') as HTMLButtonElement).click());
    expect(host.querySelector('.catalog-home')).toBeNull();
    expect(host.querySelector('[data-testid="sims-thumb-strip"]')).not.toBeNull();
    act(() => (host.querySelector('.catalog-browser-back') as HTMLButtonElement).click());
    expect(host.querySelector('.catalog-home')).not.toBeNull();
    expect(host.querySelector('[data-testid="sims-thumb-strip"]')).toBeNull();
  });

  it.each([390, 1440])('closes the store on scene click or Escape without passing through the first click at %ipx', (width) => {
    vi.stubGlobal('innerWidth', width);
    useDesignerUIStore.setState({ viewMode: '3d' });
    act(() => root.render(<><SimsDock /><SimsBottomToolbar /></>));
    const dock = () => host.querySelector(width < 1024 ? '[data-testid="sims-bottom-toolbar"]' : '[data-testid="sims-dock"]');
    openCatalog();
    const pointer = new CustomEvent('ppw:house-scene-pointer', { cancelable: true });
    act(() => window.dispatchEvent(pointer));
    expect(pointer.defaultPrevented).toBe(true);
    expect(dock()?.getAttribute('data-catalog-open')).toBe('false');
    const nextPointer = new CustomEvent('ppw:house-scene-pointer', { cancelable: true });
    act(() => window.dispatchEvent(nextPointer));
    expect(nextPointer.defaultPrevented).toBe(false);
    openCatalog('all');
    const escape = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    act(() => (host.querySelector(width < 1024 ? '[data-testid="sims-search"]' : '[data-testid="dock-search"]') as HTMLInputElement).dispatchEvent(escape));
    expect(escape.defaultPrevented).toBe(true);
    expect(dock()?.getAttribute('data-catalog-open')).toBe('false');
    expect(useDesignerUIStore.getState().viewMode).toBe('3d');
  });

  it('preserves an armed placement until Close or an explicit mode change', () => {
    vi.stubGlobal('innerWidth', 1440);
    useDesignerUIStore.setState({ viewMode: '3d' });
    const setPending = vi.fn();
    act(() => root.render(<SimsDock pendingProductId="test-product" setPendingProductId={setPending} />));
    openCatalog('all');
    const pointer = new CustomEvent('ppw:house-scene-pointer', { cancelable: true });
    act(() => window.dispatchEvent(pointer));
    expect(pointer.defaultPrevented).toBe(false);
    expect(host.querySelector('[data-testid="sims-dock"]')?.getAttribute('data-catalog-open')).toBe('true');
    expect(setPending).not.toHaveBeenCalled();
    act(() => window.dispatchEvent(new CustomEvent('ppw:close-catalog')));
    expect(host.querySelector('[data-testid="sims-dock"]')?.getAttribute('data-catalog-open')).toBe('false');
    expect(setPending).toHaveBeenCalledWith(null);
  });

  it('shows phone product details inside the store and lets a scene click close them', () => {
    vi.stubGlobal('innerWidth', 390);
    useDesignerUIStore.setState({ viewMode: '3d' });
    act(() => root.render(<SimsBottomToolbar />));
    openCatalog('eco');
    act(() => (host.querySelector('[data-testid="sims-thumb"]') as HTMLButtonElement).click());
    expect(host.querySelector('[data-testid="sims-bottom-toolbar"] [data-testid="mobile-product-popup"]')).not.toBeNull();
    expect(host.querySelector('[role="dialog"]')).toBeNull();
    expect(host.querySelector('[data-testid="sims-thumb-strip"]')).toBeNull();
    act(() => window.dispatchEvent(new CustomEvent('ppw:house-scene-pointer', { cancelable: true })));
    expect(host.querySelector('[data-testid="mobile-product-popup"]')).toBeNull();
  });

  it('closes an inactive store when crossing the phone/desktop breakpoint', () => {
    vi.stubGlobal('innerWidth', 390);
    useDesignerUIStore.setState({ viewMode: '3d' });
    act(() => root.render(<><SimsDock /><SimsBottomToolbar /></>));
    openCatalog('eco');
    vi.stubGlobal('innerWidth', 1280);
    act(() => window.dispatchEvent(new Event('resize')));
    expect(host.querySelector('[data-testid="sims-bottom-toolbar"]')?.getAttribute('data-catalog-open')).toBe('false');
    openCatalog();
    expect(host.querySelector('[data-testid="sims-dock"]')?.getAttribute('data-catalog-open')).toBe('true');
    vi.stubGlobal('innerWidth', 390);
    act(() => window.dispatchEvent(new Event('resize')));
    expect(host.querySelector('[data-testid="sims-dock"]')?.getAttribute('data-catalog-open')).toBe('false');
    const pointer = new CustomEvent('ppw:house-scene-pointer', { cancelable: true });
    act(() => window.dispatchEvent(pointer));
    expect(pointer.defaultPrevented).toBe(false);
  });
});
