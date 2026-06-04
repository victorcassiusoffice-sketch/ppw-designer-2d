/**
 * OrdersPage (P2-3) — local order history is a gateway to live server status.
 * Each order links to /order/track/:ref (OrderTrackPage polls /api/orders/:ref).
 *
 * Uses the repo's raw react-dom/client + flushSync render pattern (no
 * @testing-library) — see src/__tests__/cart/mini-cart.test.tsx.
 *
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { act } from 'react';
import { MemoryRouter } from 'react-router-dom';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import OrdersPage from '../OrdersPage';
import { useOrdersStore } from '../../store/ordersStore';
import type { Order } from '../../store/ordersStore';

const ORDER: Order = {
  id: 'PPW-TEST-1234',
  timestamp: 1_700_000_000_000,
  status: 'pending',
  customer: { name: 'Test Buyer', email: 'buyer@example.com' } as Order['customer'],
  currency: 'MUR',
  total: 12000,
  lines: [{
    productId: 'p1', name: 'Sauna Pod', category: 'sauna', quantity: 1,
    unitPrice: 12000, unitCurrency: 'MUR', unitPriceDisplay: 12000, lineTotalDisplay: 12000,
  }],
  property: {} as Order['property'],
};

let container: HTMLDivElement;
let root: Root;

function render(): string {
  act(() => {
    flushSync(() => {
      root.render(<MemoryRouter><OrdersPage /></MemoryRouter>);
    });
  });
  return container.innerHTML;
}

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => { root.unmount(); });
  container.remove();
  useOrdersStore.setState({ orders: [] });
});

describe('OrdersPage', () => {
  it('links each order to its live order-track route', () => {
    useOrdersStore.setState({ orders: [ORDER] });
    const html = render();
    expect(html).toContain('href="/order/track/PPW-TEST-1234"');
    expect(html).toContain('Track live status');
  });

  it('shows the empty state with no orders', () => {
    useOrdersStore.setState({ orders: [] });
    expect(render()).toContain('No orders yet');
  });
});
