/**
 * CA.8 layer 3 — admin pages axe-core coverage.
 *
 * Renders the admin pages (Orders / Dashboard / Payouts / Products) inside a
 * MemoryRouter with `@clerk/clerk-react` stubbed via `vi.mock`. The stub
 * exposes a no-op `useAuth` (token: null, isLoaded: true) and a minimal
 * `UserButton` so the SSR-style render reaches the page chrome (header +
 * nav + initial "Loading…" body). `renderToStaticMarkup` skips `useEffect`,
 * so the fetch never fires and axe inspects the deterministic initial DOM.
 *
 * Lives in a separate file from `a11y.test.tsx` so the module-level Clerk
 * mock cannot bleed into the customer-page tests (which render without
 * Clerk and would otherwise pick up the stub).
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi } from 'vitest';

vi.mock('@clerk/clerk-react', () => ({
  useAuth: () => ({
    getToken: async () => null,
    isLoaded: true,
    isSignedIn: false,
    userId: null,
    sessionId: null,
    actor: null,
    orgId: null,
    orgRole: null,
    orgSlug: null,
    signOut: async () => undefined,
  }),
  useUser: () => ({
    isLoaded: true,
    isSignedIn: false,
    user: null,
  }),
  UserButton: ({ afterSignOutUrl }: { afterSignOutUrl?: string }) => (
    <button type="button" aria-label="Account menu" data-after-sign-out={afterSignOutUrl}>
      Account
    </button>
  ),
  SignIn: () => <div role="region" aria-label="Sign in" />,
  SignedIn: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SignedOut: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  ClerkProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  RedirectToSignIn: () => null,
}));

import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import axe from 'axe-core';
import OrdersListPage from '../../pages/admin/OrdersListPage';
import DashboardPage from '../../pages/admin/DashboardPage';
import PayoutsListPage from '../../pages/admin/PayoutsListPage';
import ProductsListPage from '../../pages/admin/ProductsListPage';
import MerchantsListPage from '../../pages/admin/MerchantsListPage';

async function runAxe(html: string): Promise<axe.AxeResults> {
  document.documentElement.lang = 'en';
  document.body.innerHTML = `<main>${html}</main>`;
  return axe.run(document.body, {
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

function renderWithRouter(element: React.ReactElement, path: string): string {
  return renderToStaticMarkup(
    <MemoryRouter initialEntries={[path]}>{element}</MemoryRouter>,
  );
}

describe('CA.8 layer 3 — admin page a11y coverage (axe-core)', () => {
  it('OrdersListPage (loading initial state) passes axe', async () => {
    const html = renderWithRouter(<OrdersListPage />, '/admin/orders');
    const results = await runAxe(html);
    expect(formatViolations(results)).toBe('(none)');
  });

  it('DashboardPage (loading initial state) passes axe', async () => {
    const html = renderWithRouter(<DashboardPage />, '/admin/dashboard');
    const results = await runAxe(html);
    expect(formatViolations(results)).toBe('(none)');
  });

  it('PayoutsListPage (loading initial state) passes axe', async () => {
    const html = renderWithRouter(<PayoutsListPage />, '/admin/payouts');
    const results = await runAxe(html);
    expect(formatViolations(results)).toBe('(none)');
  });

  it('ProductsListPage (loading initial state) passes axe', async () => {
    const html = renderWithRouter(<ProductsListPage />, '/admin/products');
    const results = await runAxe(html);
    expect(formatViolations(results)).toBe('(none)');
  });

  it('MerchantsListPage (loading initial state) passes axe', async () => {
    const html = renderWithRouter(<MerchantsListPage />, '/admin/merchants');
    const results = await runAxe(html);
    expect(formatViolations(results)).toBe('(none)');
  });
});
