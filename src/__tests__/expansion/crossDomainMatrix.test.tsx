/**
 * Cross-domain integration matrix (DESIGNER-EXPANSION P7).
 *
 * Proves the three domains work end-to-end through the REAL modules:
 *   {wellness-room, airplane, car} × {enter, build a minimal design, see
 *   pricing, get a hand-off URL}. Deterministic (fixed seeds, no network), so
 *   it's the machine-verifiable matrix the P7 gate requires. (The Playwright
 *   suite in tests/e2e targets a live BASE_URL — that's the [VIC-VERIFY] /
 *   CI deep pass, not an autonomous gate.)
 *
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { act } from 'react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

import { listDomains, getDefaultSpace, getDomain } from '../../lib/domain';
import type { DomainId } from '../../lib/domain';
import { getAllProducts } from '../../data/products';
import { priceDesign, buildMerchantHandoffUrl } from '../../lib/pricing/domainPricing';
import { evaluateDomainReadiness, evaluateAllDomains } from '../../lib/domain/rubric';
import { useDomainStore } from '../../store/domainStore';
import { DomainPicker } from '../../components/domain/DomainPicker';
import { DomainBuilderShell } from '../../components/domain/DomainBuilderShell';
import { CarStepperFlow } from '../../components/domain/CarStepperFlow';
import { AirplaneCabinFlow } from '../../components/domain/AirplaneCabinFlow';

const DOMAINS: DomainId[] = ['wellness-room', 'airplane', 'car'];

let container: HTMLDivElement;
let root: Root;
let errorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  localStorage.clear();
  useDomainStore.getState().resetDomain();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  errorSpy.mockRestore();
});
function renderNode(node: React.ReactNode): void {
  act(() => flushSync(() => root.render(node)));
}

describe('cross-domain data chain (enter → build → price → route-out)', () => {
  it.each(DOMAINS)('%s completes the full configurator chain', (domain) => {
    // enter
    useDomainStore.getState().setDomain(domain);
    expect(useDomainStore.getState().activeDomain).toBe(domain);
    expect(getDomain(domain).placement).toBeTruthy();

    // build a minimal design (default space + first catalog product)
    const space = getDefaultSpace(domain);
    expect(space.kind).toBeTruthy();
    const product = getAllProducts(domain)[0];
    expect(product).toBeTruthy();

    // see pricing
    const pricing = priceDesign(domain, [{ productId: product.id, quantity: 2 }]);
    expect(pricing.subtotal).toBeCloseTo(product.price.value * 2, 2);
    expect(pricing.totalCommission).toBeGreaterThanOrEqual(0);

    // route out
    const url = buildMerchantHandoffUrl(domain, { designId: 'matrix', productId: product.id });
    expect(new URL(url).searchParams.get('ref')).toBe('ppw');
    expect(url).not.toContain('/checkout');
  });
});

describe('readiness rubric', () => {
  it('every domain is rubric-ready (can enter/place/price/route-out)', () => {
    const results = evaluateAllDomains(DOMAINS);
    for (const r of results) {
      expect(r.canEnter, `${r.domain} canEnter`).toBe(true);
      expect(r.canPlaceOrConfig, `${r.domain} canPlaceOrConfig`).toBe(true);
      expect(r.canPrice, `${r.domain} canPrice`).toBe(true);
      expect(r.canRouteOut, `${r.domain} canRouteOut`).toBe(true);
      expect(r.ready, `${r.domain} ready`).toBe(true);
    }
  });

  it('only wellness-room is enabled for live (airplane/car gated → [VIC-VERIFY])', () => {
    expect(evaluateDomainReadiness('wellness-room').enabledForLive).toBe(true);
    expect(evaluateDomainReadiness('airplane').enabledForLive).toBe(false);
    expect(evaluateDomainReadiness('car').enabledForLive).toBe(false);
  });
});

describe('UI matrix (mounts, zero console errors)', () => {
  it('picker lists every domain with correct enabled state', () => {
    renderNode(
      <MemoryRouter>
        <DomainPicker />
      </MemoryRouter>,
    );
    for (const d of listDomains()) {
      const card = container.querySelector(
        `[data-testid="domain-card-${d.id}"]`,
      ) as HTMLButtonElement | null;
      expect(card, `card ${d.id}`).not.toBeNull();
      expect(card!.disabled).toBe(!d.enabled);
    }
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('disabled domains route to coming-soon in the builder shell', () => {
    for (const domain of ['airplane', 'car'] as const) {
      renderNode(
        <MemoryRouter initialEntries={[`/build/${domain}`]}>
          <Routes>
            <Route path="/build/:domainId" element={<DomainBuilderShell />} />
            <Route path="/designer" element={<div data-testid="designer-stub" />} />
          </Routes>
        </MemoryRouter>,
      );
      expect(container.querySelector('[data-testid="domain-coming-soon"]')).not.toBeNull();
    }
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('the airplane + car flows mount directly (render gate)', () => {
    renderNode(<AirplaneCabinFlow />);
    expect(container.querySelector('[data-testid="airplane-cabin-flow"]')).not.toBeNull();
    act(() => root.unmount());
    root = createRoot(container);
    renderNode(<CarStepperFlow />);
    expect(container.querySelector('[data-testid="car-stepper-flow"]')).not.toBeNull();
    expect(errorSpy).not.toHaveBeenCalled();
  });
});
