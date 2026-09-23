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
    const tab = host.querySelector('[data-testid="dock-cat-eco"]');
    expect(tab?.getAttribute('aria-selected')).toBe('true');
    expect(document.activeElement).toBe(tab);
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
    const tab = host.querySelector('[data-testid="sims-cat-eco"]');
    expect(tab?.getAttribute('aria-selected')).toBe('true');
    expect(document.activeElement).toBe(tab);
    expect(host.querySelector('[data-testid="sims-thumb-strip"]')).not.toBeNull();
    expect(host.querySelector('[data-testid="dock-strip"]')).toBeNull();
    openCatalog('not-a-category');
    expect(document.activeElement).toBe(host.querySelector('[data-testid="sims-cat-all"]'));
  });
});
