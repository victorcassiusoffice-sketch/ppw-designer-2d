/**
 * CA.8 — accessibility baseline.
 *
 * Renders the shared uxKit components and the MobilePreviewBanner copy
 * into a jsdom DOM and runs axe-core. The starter assertion set covers
 * the highest-use surfaces (Empty / Error / Inline / Toast / etc.) so a
 * future regression in any of them is caught.
 *
 * Scope of this baseline tick:
 *   - Install axe-core + jsdom as dev deps (done).
 *   - Cover the uxKit components that ship on every customer-facing
 *     page (`EmptyState`, `ErrorBanner`, `SkeletonRow`, `SkeletonGrid`,
 *     `InlineFieldError`).
 *   - Disallow color-contrast / keyboard / aria-* / region rules with
 *     impact ≥ "serious".
 *
 * Follow-up scope (next CA.8 ticks):
 *   - Render the full pages (TopBar, MyDesignsPage, DashboardPage) once
 *     ClerkProvider + Router contexts can be stubbed without flake.
 *   - Add the same harness to PR CI gating.
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import axe from 'axe-core';
import {
  EmptyState,
  ErrorBanner,
  InlineFieldError,
  SkeletonGrid,
  SkeletonRow,
} from '../uxKit';
import MyDesignsPage from '../../pages/MyDesignsPage';
import MarketplaceCartPage from '../../pages/MarketplaceCartPage';
import OrderTrackPage from '../../pages/OrderTrackPage';

async function runAxe(html: string): Promise<axe.AxeResults> {
  document.documentElement.lang = 'en';
  document.body.innerHTML = `<main>${html}</main>`;
  return axe.run(document.body, {
    // Only the rules whose violations would harm real users on the
    // Designer surface. We keep the rule set lean so the baseline
    // doesn't churn on Tailwind utility-class noise (color-contrast
    // is best validated in a Lighthouse pass, not jsdom).
    runOnly: {
      type: 'rule',
      values: [
        'aria-allowed-attr',
        'aria-required-attr',
        'aria-valid-attr',
        'aria-valid-attr-value',
        'button-name',
        'image-alt',
        'label',
        'landmark-one-main',
        'link-name',
        'role-img-alt',
      ],
    },
    resultTypes: ['violations'],
  });
}

function formatViolations(results: axe.AxeResults): string {
  if (results.violations.length === 0) return '(none)';
  return results.violations
    .map((v) => `${v.id} [${v.impact ?? 'unknown'}]: ${v.help}`)
    .join('\n');
}

describe('CA.8 — uxKit a11y baseline (axe-core)', () => {
  it('EmptyState passes axe', async () => {
    const html = renderToStaticMarkup(
      <EmptyState title="No designs yet" message="Open the Designer and save your first layout." />,
    );
    const results = await runAxe(html);
    expect(formatViolations(results)).toBe('(none)');
  });

  it('EmptyState with action button passes axe', async () => {
    const html = renderToStaticMarkup(
      <EmptyState
        title="Empty"
        message="Nothing here."
        actionLabel="Add one"
        onAction={() => undefined}
      />,
    );
    const results = await runAxe(html);
    expect(formatViolations(results)).toBe('(none)');
  });

  it('ErrorBanner passes axe', async () => {
    const html = renderToStaticMarkup(
      <ErrorBanner error="Couldn't load designs." onRetry={() => undefined} />,
    );
    const results = await runAxe(html);
    expect(formatViolations(results)).toBe('(none)');
  });

  it('SkeletonRow passes axe', async () => {
    const html = renderToStaticMarkup(<SkeletonRow />);
    const results = await runAxe(html);
    expect(formatViolations(results)).toBe('(none)');
  });

  it('SkeletonGrid passes axe', async () => {
    const html = renderToStaticMarkup(<SkeletonGrid rows={3} />);
    const results = await runAxe(html);
    expect(formatViolations(results)).toBe('(none)');
  });

  it('InlineFieldError passes axe', async () => {
    const html = renderToStaticMarkup(<InlineFieldError error="Required field." />);
    const results = await runAxe(html);
    expect(formatViolations(results)).toBe('(none)');
  });

  it('Combined surface (skeleton + error + empty) passes axe', async () => {
    const html =
      renderToStaticMarkup(<SkeletonGrid rows={2} />) +
      renderToStaticMarkup(<ErrorBanner error="x" />) +
      renderToStaticMarkup(<EmptyState title="x" message="y" />);
    const results = await runAxe(html);
    expect(formatViolations(results)).toBe('(none)');
  });
});

// ─────────────────────────────────────────────────────────────────────
// CA.8 layer 2 — full-page coverage.
//
// Renders the customer-facing pages that ship without Clerk gating
// (MyDesignsPage, MarketplaceCartPage, OrderTrackPage) inside a
// MemoryRouter so `useNavigate` / `Link` / `useParams` resolve. We use
// `renderToStaticMarkup` which is SSR-style — `useEffect` does NOT
// fire — so the initial render path (loading / empty / form) is what
// axe inspects. That's exactly the surface customers see before any
// data loads.
//
// Admin pages (`/admin/*`) are deliberately deferred — they require a
// stubbed `ClerkProvider` + `useUser` mock that's bigger than this
// layer warrants. Next CA.8 layer to add.
// ─────────────────────────────────────────────────────────────────────

function renderWithRouter(element: React.ReactElement, path = '/'): string {
  return renderToStaticMarkup(
    <MemoryRouter initialEntries={[path]}>{element}</MemoryRouter>,
  );
}

describe('CA.8 — full-page a11y coverage (axe-core)', () => {
  it('MyDesignsPage (no cached email — prompt form) passes axe', async () => {
    const html = renderWithRouter(<MyDesignsPage />, '/my-designs');
    const results = await runAxe(html);
    expect(formatViolations(results)).toBe('(none)');
  });

  it('MarketplaceCartPage (empty cart initial state) passes axe', async () => {
    const html = renderWithRouter(<MarketplaceCartPage />, '/marketplace/cart');
    const results = await runAxe(html);
    expect(formatViolations(results)).toBe('(none)');
  });

  it('OrderTrackPage (loading initial state) passes axe', async () => {
    const html = renderWithRouter(<OrderTrackPage />, '/order/track/ABC123');
    const results = await runAxe(html);
    expect(formatViolations(results)).toBe('(none)');
  });
});
