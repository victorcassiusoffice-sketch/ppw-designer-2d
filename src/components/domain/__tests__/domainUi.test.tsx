/**
 * Domain UI — picker, catalog strip, per-domain flows, builder shell
 * (DESIGNER-EXPANSION P4).
 *
 * Uses the repo's raw react-dom/client render pattern (no @testing-library).
 * The RENDER GATE (per render_verification_gate.md): each surface mounts with
 * container.childElementCount > 0 and ZERO console.error calls.
 *
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { act } from 'react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

import { DomainPicker } from '../DomainPicker';
import { DomainCatalogStrip } from '../DomainCatalogStrip';
import { CarStepperFlow } from '../CarStepperFlow';
import { AirplaneCabinFlow } from '../AirplaneCabinFlow';
import { DomainBuilderShell } from '../DomainBuilderShell';
import { useDomainStore } from '../../../store/domainStore';

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
  act(() => {
    flushSync(() => root.render(node));
  });
}

/** Render-gate assertion: mounted children + zero console errors. */
function expectCleanMount(): void {
  expect(container.childElementCount).toBeGreaterThan(0);
  expect(errorSpy).not.toHaveBeenCalled();
}

function click(testid: string): void {
  const el = container.querySelector(`[data-testid="${testid}"]`) as HTMLElement | null;
  expect(el, `missing [data-testid="${testid}"]`).not.toBeNull();
  act(() => {
    flushSync(() => el!.click());
  });
}

describe('DomainPicker', () => {
  it('mounts cleanly with a card per registered domain', () => {
    renderNode(
      <MemoryRouter>
        <DomainPicker />
      </MemoryRouter>,
    );
    expectCleanMount();
    expect(container.querySelector('[data-testid="domain-card-wellness-room"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="domain-card-airplane"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="domain-card-car"]')).not.toBeNull();
  });

  it('shows "coming soon" on disabled domains and enables wellness-room', () => {
    renderNode(
      <MemoryRouter>
        <DomainPicker />
      </MemoryRouter>,
    );
    const wellness = container.querySelector(
      '[data-testid="domain-card-wellness-room"]',
    ) as HTMLButtonElement;
    const airplane = container.querySelector(
      '[data-testid="domain-card-airplane"]',
    ) as HTMLButtonElement;
    expect(wellness.disabled).toBe(false);
    expect(airplane.disabled).toBe(true);
    expect(container.querySelector('[data-testid="domain-soon-airplane"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="domain-soon-car"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="domain-soon-wellness-room"]')).toBeNull();
  });

  it('clicking the wellness card sets the active domain', () => {
    renderNode(
      <MemoryRouter initialEntries={['/build']}>
        <Routes>
          <Route path="/build" element={<DomainPicker />} />
          <Route path="/designer" element={<div data-testid="designer-stub" />} />
        </Routes>
      </MemoryRouter>,
    );
    click('domain-card-wellness-room');
    expect(useDomainStore.getState().activeDomain).toBe('wellness-room');
    expect(container.querySelector('[data-testid="designer-stub"]')).not.toBeNull();
  });
});

describe('DomainCatalogStrip', () => {
  it('reflects wellness categories', () => {
    renderNode(<DomainCatalogStrip domain="wellness-room" />);
    expectCleanMount();
    const strip = container.querySelector('[data-testid="domain-catalog-strip"]');
    expect(strip?.getAttribute('data-domain')).toBe('wellness-room');
    expect(container.querySelector('[data-testid="domain-cat-tab-ice-bath"]')).not.toBeNull();
  });

  it('reflects airplane categories (domain-aware tabs)', () => {
    renderNode(<DomainCatalogStrip domain="airplane" />);
    expectCleanMount();
    expect(container.querySelector('[data-testid="domain-cat-tab-seat"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="domain-cat-tab-galley"]')).not.toBeNull();
    // no wellness tab leaked into the airplane strip
    expect(container.querySelector('[data-testid="domain-cat-tab-ice-bath"]')).toBeNull();
  });

  it('reflects car categories', () => {
    renderNode(<DomainCatalogStrip domain="car" />);
    expectCleanMount();
    expect(container.querySelector('[data-testid="domain-cat-tab-model"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="domain-cat-tab-paint"]')).not.toBeNull();
  });
});

describe('CarStepperFlow', () => {
  it('mounts cleanly and starts on the first step', () => {
    renderNode(<CarStepperFlow />);
    expectCleanMount();
    const title = container.querySelector('[data-testid="car-step-title"]');
    expect(title?.textContent).toContain('Step 1 of');
    const back = container.querySelector('[data-testid="car-step-back"]') as HTMLButtonElement;
    expect(back.disabled).toBe(true); // first step → Back disabled
  });

  it('advances to the next step on Next', () => {
    renderNode(<CarStepperFlow />);
    click('car-step-next');
    const title = container.querySelector('[data-testid="car-step-title"]');
    expect(title?.textContent).toContain('Step 2 of');
  });
});

describe('AirplaneCabinFlow', () => {
  it('mounts cleanly with the fuselage seat-grid', () => {
    renderNode(<AirplaneCabinFlow />);
    expectCleanMount();
    expect(container.querySelector('[data-testid="airplane-seat-grid"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="airplane-cell-0-0"]')).not.toBeNull();
    const count = container.querySelector('[data-testid="airplane-placed-count"]');
    expect(count?.textContent).toContain('0 placed');
  });
});

describe('DomainBuilderShell', () => {
  function renderShell(path: string): void {
    renderNode(
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/build/:domainId" element={<DomainBuilderShell />} />
          <Route path="/designer" element={<div data-testid="designer-stub" />} />
        </Routes>
      </MemoryRouter>,
    );
  }

  it('gates a disabled domain behind "coming soon" (no unfinished builder reachable)', () => {
    renderShell('/build/airplane');
    expectCleanMount();
    expect(container.querySelector('[data-testid="domain-coming-soon"]')).not.toBeNull();
    // the actual flow must NOT render while disabled
    expect(container.querySelector('[data-testid="airplane-cabin-flow"]')).toBeNull();
    expect(container.querySelector('[data-testid="car-stepper-flow"]')).toBeNull();
  });

  it('redirects wellness-room to the live /designer app', () => {
    renderShell('/build/wellness-room');
    expect(container.querySelector('[data-testid="designer-stub"]')).not.toBeNull();
  });

  it('junk domain id falls back to wellness-room → /designer', () => {
    renderShell('/build/not-a-domain');
    expect(container.querySelector('[data-testid="designer-stub"]')).not.toBeNull();
  });
});
