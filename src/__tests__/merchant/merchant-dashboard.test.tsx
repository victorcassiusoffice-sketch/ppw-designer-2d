/**
 * @vitest-environment jsdom
 *
 * M5 — MerchantDashboardPage. Renders into jsdom against a stubbed
 * fetch and asserts the brand-themed surface lights up with the
 * mocked products plus the placeholder cards.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { act } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

import MerchantDashboardPage from '../../pages/MerchantDashboardPage';

const SAMPLE_PRODUCTS = [
  {
    id: 1,
    sku: 'DEMO-CHAIR',
    name: 'Ergo Office Chair',
    category: 'ergo-chair',
    description: 'Aluminium frame, mesh back.',
    widthMm: 700,
    depthMm: 700,
    heightMm: 1200,
    weightG: 18000,
    priceMinor: 1490000,
    currency: 'MUR',
    imageUrl: null,
    region: 'MU',
  },
  {
    id: 2,
    sku: 'DEMO-TREAD',
    name: 'Recovery Treadmill',
    category: 'fitness',
    description: 'Curved deck.',
    widthMm: 1800,
    depthMm: 800,
    heightMm: 1500,
    weightG: 90000,
    priceMinor: 5990000,
    currency: 'MUR',
    imageUrl: null,
    region: 'MU',
  },
];

function mockFetch(payload: unknown, status = 200): typeof globalThis.fetch {
  return vi.fn(async () =>
    new Response(JSON.stringify(payload), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
  ) as unknown as typeof globalThis.fetch;
}

async function flushAsync(): Promise<void> {
  // Microtask flush so the fetch promise + setState settle before
  // we read container.innerHTML in the assertions below.
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

let container: HTMLDivElement;
let root: Root;

function renderAt(slug: string, fetchImpl: typeof globalThis.fetch): void {
  act(() => {
    flushSync(() => {
      root.render(
        <MemoryRouter initialEntries={[`/merchant/${slug}`]}>
          <Routes>
            <Route
              path="/merchant/:slug"
              element={<MerchantDashboardPage fetchImpl={fetchImpl} />}
            />
          </Routes>
        </MemoryRouter>,
      );
    });
  });
}

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => {
    root.unmount();
  });
  container.remove();
});

describe('MerchantDashboardPage (M5)', () => {
  it('renders the merchant slug + Add Product CTA in the header', async () => {
    const fetchImpl = mockFetch({ products: [], total: 0, limit: 100, offset: 0, schemaMissing: false });
    renderAt('demo-supplier-cn', fetchImpl);
    await flushAsync();
    const html = container.innerHTML;
    expect(html).toContain('PPW Merchant');
    expect(html).toContain('demo-supplier-cn');
    expect(html).toContain('+ Add product');
    // The CTA links to the existing M4 agent surface.
    const addProductLink = container.querySelector(
      '[data-testid="merchant-dashboard-add-product"]',
    ) as HTMLAnchorElement | null;
    expect(addProductLink?.getAttribute('href')).toBe('/merchant/demo-supplier-cn/agent');
  });

  it('renders the product grid when /api/merchants/:slug/products returns rows', async () => {
    const fetchImpl = mockFetch({
      products: SAMPLE_PRODUCTS,
      total: SAMPLE_PRODUCTS.length,
      limit: 100,
      offset: 0,
      schemaMissing: false,
    });
    renderAt('demo-supplier-cn', fetchImpl);
    await flushAsync();
    const grid = container.querySelector('[data-testid="products-grid"]');
    expect(grid).not.toBeNull();
    const cards = container.querySelectorAll('[data-testid="merchant-product-card"]');
    expect(cards.length).toBe(SAMPLE_PRODUCTS.length);
    const html = container.innerHTML;
    expect(html).toContain('DEMO-CHAIR');
    expect(html).toContain('DEMO-TREAD');
    expect(html).toContain('700 × 700 × 1200 mm');
    expect(html).toContain('14,900 MUR');
  });

  it('shows the "no products yet" empty state when the merchant has no products', async () => {
    const fetchImpl = mockFetch({ products: [], total: 0, limit: 100, offset: 0, schemaMissing: false });
    renderAt('demo-supplier-cn', fetchImpl);
    await flushAsync();
    const empty = container.querySelector('[data-testid="products-empty"]');
    expect(empty).not.toBeNull();
    expect(container.innerHTML).toContain('Open Integration Agent');
  });

  it('surfaces merchantNotFound when the slug is unknown', async () => {
    const fetchImpl = mockFetch({
      products: [],
      total: 0,
      limit: 100,
      offset: 0,
      schemaMissing: false,
      merchantNotFound: true,
    });
    renderAt('does-not-exist', fetchImpl);
    await flushAsync();
    const notice = container.querySelector('[data-testid="merchant-not-found"]');
    expect(notice).not.toBeNull();
    expect(notice?.textContent).toContain('does-not-exist');
  });

  it('renders the placeholder Recent Designs + Commission Ledger cards', async () => {
    const fetchImpl = mockFetch({ products: SAMPLE_PRODUCTS, total: 2, limit: 100, offset: 0, schemaMissing: false });
    renderAt('demo-supplier-cn', fetchImpl);
    await flushAsync();
    expect(container.querySelector('[data-testid="recent-designs-card"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="commission-ledger-card"]')).not.toBeNull();
    expect(container.innerHTML).toContain('M7 commission attribution');
    expect(container.innerHTML).toContain('/api/commission/reconcile');
  });

  it('applies the brand-token palette (navy bg, gold accent, cream text)', async () => {
    const fetchImpl = mockFetch({ products: [], total: 0, limit: 100, offset: 0, schemaMissing: false });
    renderAt('demo-supplier-cn', fetchImpl);
    await flushAsync();
    const root = container.querySelector('[data-testid="merchant-dashboard"]') as HTMLDivElement | null;
    expect(root).not.toBeNull();
    // jsdom normalises CSS hex to rgb() — assert against the resolved
    // form (#232C3B = rgb(35, 44, 59), #F5EBD7 = rgb(245, 235, 215),
    // #FFBB58 = rgb(255, 187, 88)).
    const style = root!.getAttribute('style') ?? '';
    expect(style).toContain('rgb(35, 44, 59)'); // navy
    expect(style).toContain('rgb(245, 235, 215)'); // cream
    expect(container.innerHTML).toContain('rgb(255, 187, 88)'); // gold
  });
});
