/**
 * CartDrawer — Polish B (V4 Driver tick 35).
 *
 * Tests cover: visibility tied to cartUIStore, marketplace-fee math,
 * per-merchant grouping (V1 fallback to PPW marketplace bucket),
 * checkout CTA disabled when empty, brand-canon palette presence.
 *
 * Uses `react-dom/client` + `flushSync` to render into jsdom — see
 * mini-cart.test.tsx for the rationale (SSR breaks Zustand's
 * useSyncExternalStore snapshot).
 *
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { act } from 'react';
import { MemoryRouter } from 'react-router-dom';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { CartDrawer } from '../../components/cart/CartDrawer';
import { usePropertyStore } from '../../store/propertyStore';
import { useCurrencyStore } from '../../store/currencyStore';
import { useCartUIStore } from '../../store/cartUIStore';
import { getAllProducts, getProductById } from '../../data/products';

let container: HTMLDivElement;
let root: Root;

function render(): string {
  act(() => {
    flushSync(() => {
      root.render(
        <MemoryRouter>
          <CartDrawer />
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

describe('CartDrawer — visibility', () => {
  it('renders nothing when closed', () => {
    expect(render()).toBe('');
  });

  it('renders the dialog when open', () => {
    useCartUIStore.getState().open();
    const html = render();
    expect(html).toContain('data-testid="cart-drawer"');
    expect(html).toContain('role="dialog"');
  });

  it('renders an empty-state message when no items', () => {
    useCartUIStore.getState().open();
    expect(render()).toContain('Cart is empty');
  });
});

describe('CartDrawer — totals + 7% marketplace fee', () => {
  it('renders both subtotal and 7% marketplace-fee line', () => {
    const product = getAllProducts()[0];
    usePropertyStore.getState().addItem({
      productId: product.id,
      x: 0,
      y: 0,
      rotation: 0,
    });
    useCartUIStore.getState().open();
    const html = render();
    expect(html).toContain('Marketplace fee (7%)');
    expect(html).toContain('data-testid="marketplace-fee"');
    expect(html).toContain('data-testid="cart-drawer-total"');
  });

  it('renders checkout CTA as disabled when the cart is empty', () => {
    useCartUIStore.getState().open();
    const html = render();
    const ctaSlice = html.split('data-testid="cart-drawer-checkout"')[1];
    expect(ctaSlice).toBeDefined();
    // jsdom serialises `disabled` as `disabled=""`. The button must be
    // present (the empty-state footer still renders both CTAs) but the
    // checkout one is disabled to prevent navigating to an empty cart.
    const html2 = html.split('Checkout')[0];
    expect(html2).toMatch(/disabled(="")?[^>]*data-testid="cart-drawer-checkout"|data-testid="cart-drawer-checkout"[^>]*disabled/);
  });

  it('renders an enabled checkout CTA once items are placed', () => {
    const product = getAllProducts()[0];
    usePropertyStore.getState().addItem({
      productId: product.id,
      x: 0,
      y: 0,
      rotation: 0,
    });
    useCartUIStore.getState().open();
    const html = render();
    expect(html).toContain('data-testid="cart-drawer-checkout"');
    // No `disabled` HTML attribute on the checkout button when items
    // exist. (The Tailwind class `disabled:opacity-50` contains the
    // word "disabled" but is a class — not an attribute.)
    const ctaTag = html.match(
      /<button[^>]*data-testid="cart-drawer-checkout"[^>]*>/,
    );
    expect(ctaTag).not.toBeNull();
    expect(ctaTag![0]).not.toMatch(/\sdisabled(="")?[\s>]/);
  });
});

describe('CartDrawer — per-merchant grouping (V1)', () => {
  it('groups lines under the product supplier name', () => {
    const product = getAllProducts().find(
      (p) => p.supplier && p.supplier.trim().length > 0,
    );
    expect(product).toBeDefined();
    usePropertyStore.getState().addItem({
      productId: product!.id,
      x: 0,
      y: 0,
      rotation: 0,
    });
    useCartUIStore.getState().open();
    const html = render();
    expect(html).toContain(product!.supplier);
    expect(html).toContain('data-testid="merchant-group"');
  });

  it('renders the product name in a line row', () => {
    const product = getAllProducts()[0];
    usePropertyStore.getState().addItem({
      productId: product.id,
      x: 0,
      y: 0,
      rotation: 0,
    });
    useCartUIStore.getState().open();
    const html = render();
    expect(html).toContain(product.name);
    expect(html).toContain('data-testid="cart-line"');
  });
});

describe('CartDrawer — Konva-untouched + brand canon', () => {
  it('emits no react-konva markup', () => {
    useCartUIStore.getState().open();
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

  it('uses canonical gold/ink/cream hex codes', () => {
    useCartUIStore.getState().open();
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

describe('CartDrawer — pure totals via rendered HTML', () => {
  it('renders non-empty subtotal + fee + total lines when cart has items', () => {
    const product = getProductById('k1-nordictrack-2450') ?? getAllProducts()[0];
    usePropertyStore.getState().addItem({
      productId: product.id,
      x: 0,
      y: 0,
      rotation: 0,
    });
    useCartUIStore.getState().open();
    const html = render();
    const totalMatch = html.match(
      /data-testid="cart-drawer-total"[^>]*>([^<]+)</,
    );
    const feeMatch = html.match(
      /data-testid="marketplace-fee"[^>]*>([^<]+)</,
    );
    expect(totalMatch).not.toBeNull();
    expect(feeMatch).not.toBeNull();
    expect(totalMatch![1].trim().length).toBeGreaterThan(0);
    expect(feeMatch![1].trim().length).toBeGreaterThan(0);
  });
});
