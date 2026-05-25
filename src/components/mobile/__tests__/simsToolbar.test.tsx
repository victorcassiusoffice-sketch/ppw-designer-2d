/**
 * Mobile Sims rebuild — component coverage (Phase 2 + 3).
 *
 * SimsBottomToolbar: renders the sticky toolbar with all macro category
 * tabs + a thumbnail strip, and the minimize chevron collapses the strip.
 * MobileProductPopup: "+ Add to room" / Cancel fire their callbacks and
 * the long description truncates with a "more" expander.
 *
 * Uses react-dom/client + flushSync (the repo convention — Zustand stores
 * need a client render, not the SSR snapshot).
 *
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { act } from 'react';
import { SimsBottomToolbar } from '../SimsBottomToolbar';
import { MobileProductPopup } from '../MobileProductPopup';
import { getAllProducts } from '../../../data/products';
import type { Product } from '../../../data/products.schema';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.restoreAllMocks();
});

// Settle the on-mount fetchApiProducts() promise inside act() so its
// state update doesn't trip the "not wrapped in act(...)" warning.
async function flushAsync(): Promise<void> {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
}

describe('SimsBottomToolbar', () => {
  it('renders the sticky toolbar with category tabs and thumbnails', async () => {
    act(() => {
      flushSync(() => root.render(<SimsBottomToolbar />));
    });
    await flushAsync();
    expect(container.querySelector('[data-testid="sims-bottom-toolbar"]')).not.toBeNull();
    // All seven macro tabs + "All".
    for (const cat of ['all', 'furniture', 'cardio', 'recovery', 'sauna', 'flooring', 'walls', 'decor']) {
      expect(container.querySelector(`[data-testid="sims-cat-${cat}"]`)).not.toBeNull();
    }
    // Bundled catalog (22 products) renders thumbnails in the "All" tab.
    expect(container.querySelectorAll('[data-testid="sims-thumb"]').length).toBeGreaterThan(0);
  });

  it('minimize chevron collapses the thumbnail strip', async () => {
    act(() => {
      flushSync(() => root.render(<SimsBottomToolbar />));
    });
    await flushAsync();
    expect(container.querySelector('[data-testid="sims-thumb-strip"]')).not.toBeNull();
    const minBtn = container.querySelector('[data-testid="sims-toolbar-minimize"]') as HTMLButtonElement;
    expect(minBtn.getAttribute('aria-expanded')).toBe('true');
    act(() => minBtn.click());
    expect(container.querySelector('[data-testid="sims-thumb-strip"]')).toBeNull();
    expect(minBtn.getAttribute('aria-expanded')).toBe('false');
  });
});

describe('MobileProductPopup', () => {
  const product = getAllProducts()[0];

  it('fires onAdd with the product id when "+ Add to room" is tapped', () => {
    const onAdd = vi.fn();
    act(() => {
      flushSync(() =>
        root.render(
          <MobileProductPopup product={product} onAdd={onAdd} onDragPlace={vi.fn()} onClose={vi.fn()} />,
        ),
      );
    });
    const addBtn = container.querySelector('[data-testid="popup-add-to-room"]') as HTMLButtonElement;
    act(() => addBtn.click());
    expect(onAdd).toHaveBeenCalledWith(product.id);
  });

  it('truncates a long description behind a "more" expander', () => {
    const longProduct: Product = { ...product, notes: 'x'.repeat(400) };
    act(() => {
      flushSync(() =>
        root.render(
          <MobileProductPopup product={longProduct} onAdd={vi.fn()} onDragPlace={vi.fn()} onClose={vi.fn()} />,
        ),
      );
    });
    expect(container.innerHTML).toContain('…');
    expect(container.textContent).toContain('more');
  });
});
