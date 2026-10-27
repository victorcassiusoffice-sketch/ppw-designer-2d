/** @vitest-environment jsdom */
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getAllProducts } from '../../data/products';
import { HouseCostPanel } from '../HouseCostPanel';
import { CartStrip } from '../CartStrip';
import { resetPitchEmbedCache } from '../../demo/pitchEmbed';
vi.mock('../../store/cartStore', () => ({ useCart: () => {
  const products = [getAllProducts().find(p => p.id === 'k1-nordictrack-2450')!, getAllProducts().find(p => p.id === 'demo-console-table')!];
  return { lines: products.map(product => ({ productId: product.id, product, quantity: 1, lineTotalDisplay: 100, unitPriceDisplay: 100 })),
    floorLines: [{ lineId: 'floor', materialName: 'Floor finish', unitsToOrder: 777, surplusUnits: 666, unit: 'pack', lineTotalDisplay: 100, unitPriceDisplay: 1 }],
    wallPaintLines: [{ lineId: 'paint', paintName: 'Paint finish', boughtLitres: 888, tins: [{ count: 444, sizeL: 2 }], totalDisplay: 100, renderHex: '#eee' }],
    claddingLines: [], currency: 'MUR', totalItemCount: 2, uniqueProductCount: 2, subtotal: 400, subtotalByCurrency: { MUR: 400, USD: 10 } };
} }));
vi.mock('../../lib/showcaseSafety', () => ({ isShowcaseReadOnly: () => true, DEMO_NOTICE: 'Preview only' }));
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
describe('pictures in both design baskets', () => {
  beforeEach(() => resetPitchEmbedCache());
  it.each(['house', 'plan'])('%s keeps supplier photos, labels plan art and removes demo counts and money', kind => {
    window.history.replaceState(null, '', '/demo?pitch=1');
    const host = document.createElement('div'), root = createRoot(host); document.body.append(host);
    act(() => root.render(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>{kind === 'house' ? <HouseCostPanel /> : <CartStrip />}</MemoryRouter>));
    if (kind === 'plan') act(() => host.querySelector<HTMLButtonElement>('[data-testid="cart-pill"]')!.click());
    expect(host.querySelectorAll('.basket-product-picture')).toHaveLength(2);
    expect(host.querySelectorAll('[data-image-kind="photo"]')).toHaveLength(1);
    expect(host.querySelectorAll('[data-image-kind="plan"]')).toHaveLength(1);
    expect(host.textContent).toContain('Drawing');
    expect(host.textContent).not.toMatch(/\bMUR\b|\bRs\b|\bQty\b|unique|placed|1 ×|777|666|888|444|\$|£|€/);
    for (const image of host.querySelectorAll('img')) expect(image.getAttribute('src')).not.toMatch(/placehold\.co/);
    act(() => root.unmount()); host.remove();
  });
  it.each(['house', 'plan'])('%s retains normal Designer purchasing quantities and money', kind => {
    window.history.replaceState(null, '', '/designer');
    const host = document.createElement('div'), root = createRoot(host); document.body.append(host);
    act(() => root.render(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>{kind === 'house' ? <HouseCostPanel /> : <CartStrip />}</MemoryRouter>));
    if (kind === 'plan') act(() => host.querySelector<HTMLButtonElement>('[data-testid="cart-pill"]')!.click());
    expect(host.querySelectorAll('.basket-product-picture')).toHaveLength(2);
    expect(host.textContent).toContain('777');
    expect(host.textContent).toMatch(/Rs|MUR/);
    act(() => root.unmount()); host.remove();
  });
});
