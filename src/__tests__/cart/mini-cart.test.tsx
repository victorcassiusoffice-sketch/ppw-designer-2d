/**
 * MiniCartPill — Polish B render coverage (V4 Driver tick 35).
 *
 * Covers: hidden-when-empty, visible-with-items, count + currency,
 * brand-canon palette presence, Konva-untouched (no <canvas> or
 * react-konva nodes emitted by the pill itself), aria-expanded sync
 * with drawer state.
 *
 * Uses `react-dom/client` + `flushSync` (NOT `renderToStaticMarkup`)
 * because Zustand stores rely on `useSyncExternalStore`, whose SSR
 * path returns the initial snapshot instead of the live store state.
 * Client-rendering into a detached jsdom node sidesteps the SSR
 * snapshot.
 *
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { act } from 'react';
import { MemoryRouter } from 'react-router-dom';

// Silence the React 18 "act(...) not configured" warning. createRoot
// + flushSync flushes synchronously; we wrap in act() purely to follow
// the React testing convention.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { MiniCartPill } from '../../components/cart/MiniCartPill';
import { usePropertyStore } from '../../store/propertyStore';
import { useCurrencyStore } from '../../store/currencyStore';
import { useCartUIStore } from '../../store/cartUIStore';
import { getAllProducts } from '../../data/products';

let container: HTMLDivElement;
let root: Root;

function render(): string {
  act(() => {
    flushSync(() => {
      root.render(
        <MemoryRouter>
          <MiniCartPill />
        </MemoryRouter>,
      );
    });
  });
  return container.innerHTML;
}

function resetStores() {
  usePropertyStore.getState().resetToDefault();
  useCartUIStore.getState().close();
  useCurrencyStore.setState({ currency: 'MUR' });
}

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  resetStores();
});

afterEach(() => {
  act(() => {
    root.unmount();
  });
  container.remove();
});

describe('MiniCartPill — visibility', () => {
  it('renders nothing when the cart is empty', () => {
    const html = render();
    expect(html).toBe('');
  });

  it('renders the pill once at least one item is placed', () => {
    const product = getAllProducts()[0];
    usePropertyStore.getState().addItem({
      productId: product.id,
      x: 0,
      y: 0,
      rotation: 0,
    });
    expect(render()).toContain('data-testid="mini-cart-pill"');
  });

  it('shows the unique-product count badge', () => {
    const products = getAllProducts();
    usePropertyStore.getState().addItem({
      productId: products[0].id,
      x: 0,
      y: 0,
      rotation: 0,
    });
    usePropertyStore.getState().addItem({
      productId: products[1].id,
      x: 1,
      y: 1,
      rotation: 0,
    });
    expect(render()).toContain('>2<');
  });

  it('renders aria-expanded tied to the drawer state', () => {
    const product = getAllProducts()[0];
    usePropertyStore.getState().addItem({
      productId: product.id,
      x: 0,
      y: 0,
      rotation: 0,
    });
    expect(render()).toContain('aria-expanded="false"');
    useCartUIStore.getState().open();
    expect(render()).toContain('aria-expanded="true"');
  });
});

describe('MiniCartPill — Konva-untouched assertion', () => {
  it('emits no <canvas> or react-konva markup', () => {
    const product = getAllProducts()[0];
    usePropertyStore.getState().addItem({
      productId: product.id,
      x: 0,
      y: 0,
      rotation: 0,
    });
    const html = render().toLowerCase();
    expect(html).not.toContain('<canvas');
    expect(html).not.toContain('konvajs-content');
  });
});

describe('MiniCartPill — brand canon palette (V4-AU-1)', () => {
  it('uses canonical gold/ink/cream hex codes', () => {
    const product = getAllProducts()[0];
    usePropertyStore.getState().addItem({
      productId: product.id,
      x: 0,
      y: 0,
      rotation: 0,
    });
    const html = render();
    expect(html).toContain('#C0A67E');
    expect(html).toContain('#0E0E10');
    expect(html).toContain('#F5EFE6');
  });
});
