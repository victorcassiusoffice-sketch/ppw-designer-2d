/**
 * @vitest-environment jsdom
 *
 * M7 — MerchantOnboardingPage render check.
 * Static page; the test confirms section presence + slug-aware copy +
 * the email CTA mailto.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { act } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

import MerchantOnboardingPage from '../../pages/MerchantOnboardingPage';

let container: HTMLDivElement;
let root: Root;

function renderAt(initial: string): void {
  act(() => {
    flushSync(() => {
      root.render(
        <MemoryRouter initialEntries={[initial]}>
          <Routes>
            <Route path="/merchants/onboard" element={<MerchantOnboardingPage />} />
            <Route path="/merchants/onboard/:slug" element={<MerchantOnboardingPage />} />
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
  act(() => { root.unmount(); });
  container.remove();
});

describe('MerchantOnboardingPage', () => {
  it('renders all four sections + the CTA on /merchants/onboard/k1-sport', () => {
    renderAt('/merchants/onboard/k1-sport');
    expect(container.querySelector('[data-testid="merchant-onboarding"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="merchant-onboarding-title"]')?.textContent).toContain('K1-Sport');
    expect(container.querySelector('[data-testid="onboarding-how-it-works"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="onboarding-merchant-todo"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="onboarding-finance-posture"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="onboarding-cta"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="onboarding-dashboard-link"]')?.getAttribute('href'))
      .toBe('/merchant/k1-sport');
  });

  it('renders the unbranded variant on /merchants/onboard (no slug)', () => {
    renderAt('/merchants/onboard');
    expect(container.querySelector('[data-testid="merchant-onboarding-title"]')?.textContent).toContain('Merchant onboarding');
    // No dashboard link when no slug is present.
    expect(container.querySelector('[data-testid="onboarding-dashboard-link"]')).toBeNull();
  });

  it('builds the MoU mailto with the slug-aware subject', () => {
    renderAt('/merchants/onboard/k1-sport');
    const cta = container.querySelector('[data-testid="onboarding-mou-cta"]') as HTMLAnchorElement | null;
    expect(cta).not.toBeNull();
    const href = cta!.getAttribute('href') ?? '';
    expect(href.startsWith('mailto:victor@ppwellness.co')).toBe(true);
    expect(href).toContain(encodeURIComponent('PPW × K1-Sport — Pattern C MoU'));
  });

  it('uses the brand palette (navy / gold / cream rgb forms in jsdom)', () => {
    renderAt('/merchants/onboard/k1-sport');
    const root = container.querySelector('[data-testid="merchant-onboarding"]') as HTMLDivElement | null;
    const style = root?.getAttribute('style') ?? '';
    expect(style).toContain('rgb(35, 44, 59)'); // navy
    expect(style).toContain('rgb(245, 235, 215)'); // cream
    expect(container.innerHTML).toContain('rgb(255, 187, 88)'); // gold
  });
});
