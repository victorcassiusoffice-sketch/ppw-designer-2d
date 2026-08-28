import React, { lazy, Suspense } from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import * as Sentry from '@sentry/react';
import App from './App';
import { bootstrapFx } from './store/currencyStore';
import './index.css';

// Route-level code splitting (designer-loop 2026-07-05): the designer (App)
// is the primary customer surface and stays eager; every other page loads
// on navigation. This keeps Clerk (admin-only) and jsPDF (order-success
// only) out of the main chunk entirely.
const CartPage = lazy(() => import('./pages/CartPage'));
const CheckoutPage = lazy(() => import('./pages/CheckoutPage'));
const OrderSuccessPage = lazy(() => import('./pages/OrderSuccessPage'));
const OrderCancelledPage = lazy(() => import('./pages/OrderCancelledPage'));
const OrderPendingPage = lazy(() => import('./pages/OrderPendingPage'));
const OrdersPage = lazy(() => import('./pages/OrdersPage'));
const SuppliersPage = lazy(() => import('./pages/SuppliersPage'));
const SuppliersSignupCompletePage = lazy(() => import('./pages/SuppliersSignupCompletePage'));
const AdminLayout = lazy(() => import('./pages/AdminLayout'));
const AdminMerchantsPage = lazy(() => import('./pages/AdminMerchantsPage'));
const RequireAdmin = lazy(() => import('./admin/RequireAdmin'));
const MerchantsListPage = lazy(() => import('./pages/admin/MerchantsListPage'));
const MerchantDetailPage = lazy(() => import('./pages/admin/MerchantDetailPage'));
const OrdersListPage = lazy(() => import('./pages/admin/OrdersListPage'));
const PayoutsListPage = lazy(() => import('./pages/admin/PayoutsListPage'));
const ProductsListPage = lazy(() => import('./pages/admin/ProductsListPage'));
const SuppliersListPage = lazy(() => import('./pages/admin/SuppliersListPage'));
const DashboardPage = lazy(() => import('./pages/admin/DashboardPage'));
const AuditLogPage = lazy(() => import('./pages/admin/AuditLogPage'));
const PublicProductsPage = lazy(() => import('./pages/PublicProductsPage'));
const ProductDetailPage = lazy(() => import('./pages/ProductDetailPage'));
const MarketplaceCartPage = lazy(() => import('./pages/MarketplaceCartPage'));
const MarketplaceCheckoutPage = lazy(() => import('./pages/MarketplaceCheckoutPage'));
const OrderTrackPage = lazy(() => import('./pages/OrderTrackPage'));
const GumroadReturnPage = lazy(() => import('./pages/GumroadReturnPage'));
const MerchantAgentPage = lazy(() => import('./pages/MerchantAgentPage'));
const MerchantDashboardPage = lazy(() => import('./pages/MerchantDashboardPage'));
const MerchantOnboardingPage = lazy(() => import('./pages/MerchantOnboardingPage'));
const MerchantAddProductPage = lazy(() => import('./pages/MerchantAddProductPage'));
const RequireMerchant = lazy(() => import('./components/RequireMerchant'));
const MyDesignsPage = lazy(() => import('./pages/MyDesignsPage'));

/** Full-screen fallback shown while a lazy route chunk downloads. */
function RouteFallback(): JSX.Element {
  return (
    <div className="flex h-screen w-screen items-center justify-center bg-ppw-sand">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-ppw-ink border-t-transparent" />
    </div>
  );
}

// Fire-and-forget FX bootstrap - refreshes the live rate snapshot if
// the cached one is stale.
bootstrapFx();

// VITE_TEST_HOOKS (preview only) — expose window.__designer for Playwright
// device-emulation verification. __TEST_HOOKS__ is a build-time literal
// (vite.config define): false in production → this whole block + the
// dynamic import are dead-code-eliminated, so testHooks never ships.
if (__TEST_HOOKS__) {
  import('./lib/testHooks')
    .then((m) => m.installTestHooks())
    .catch(() => {
      /* preview-only convenience; ignore load failures */
    });
}

// DEV-ONLY — expose window.__ppwGeom, the canvas's live world→screen transform,
// so e2e specs derive click coordinates from GEOMETRY rather than by pixel-
// scanning for gold. Once floor materials and door symbols land, a colour scan
// can latch onto the wrong pixel and fail silently (specs still green, wrong
// coordinate frame). `import.meta.env.DEV` is a build-time literal: false in a
// production build, so this block and the module both tree-shake away. Unlike
// __TEST_HOOKS__ it needs no env var on the dev server — a forgotten flag here
// would mean silently falling back to the colour scan. Read-only API.
if (import.meta.env.DEV) {
  import('./lib/geomBridge')
    .then((m) => m.installGeomBridge())
    .catch(() => {
      /* dev-only convenience; ignore load failures */
    });
}

// OMS Wave 1B / Wave 1.10 — Sentry browser init, gated on the DSN env.
// Release-tagged with the Vercel commit SHA so source-maps map back.
// Free-tier-safe: traces + replays off.
if (import.meta.env.VITE_SENTRY_DSN) {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN as string,
    environment:
      (import.meta.env.VITE_SENTRY_ENVIRONMENT as string | undefined) ??
      (import.meta.env.MODE as string),
    release:
      (import.meta.env.VITE_SENTRY_RELEASE as string | undefined) ??
      (import.meta.env.VITE_VERCEL_GIT_COMMIT_SHA as string | undefined),
    tracesSampleRate: 0,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,
  });
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Suspense fallback={<RouteFallback />}>
        <Routes>
        {/* WD rework 2026-07-26 (Vic directive 5): the SHOP is the front door.
            "Browse and buy" is the primary journey; the Sims-style room
            designer is an optional extra mode at /designer. */}
        <Route path="/" element={<PublicProductsPage />} />
        <Route path="/designer" element={<App />} />
        <Route path="/cart" element={<CartPage />} />
        <Route path="/checkout" element={<CheckoutPage />} />
        <Route path="/orders" element={<OrdersPage />} />
        <Route path="/order/success" element={<OrderSuccessPage />} />
        <Route path="/order/cancelled" element={<OrderCancelledPage />} />
        <Route path="/order/pending" element={<OrderPendingPage />} />

        {/* OMS Phase 1 - Merchant signup public pages */}
        <Route path="/suppliers" element={<SuppliersPage />} />
        <Route path="/merchants" element={<SuppliersPage />} />
        <Route path="/suppliers/signup/complete" element={<SuppliersSignupCompletePage />} />

        {/* OMS Phase 3 - Public storefront product listing */}
        <Route path="/products" element={<PublicProductsPage />} />
        <Route path="/products/:id" element={<ProductDetailPage />} />

        {/* OMS Wave 1 - Marketplace checkout flow */}
        <Route path="/marketplace/cart" element={<MarketplaceCartPage />} />
        <Route path="/marketplace/checkout" element={<MarketplaceCheckoutPage />} />
        <Route path="/order/track/:orderRef" element={<OrderTrackPage />} />
        {/* Gumroad interim rail — static redirect-after-purchase target */}
        <Route path="/order/gumroad-return" element={<GumroadReturnPage />} />
        <Route path="/merchants/onboard" element={<MerchantOnboardingPage />} />
        <Route path="/merchants/onboard/:slug" element={<MerchantOnboardingPage />} />
        <Route
          path="/merchant/:slug"
          element={
            <RequireMerchant>
              <MerchantDashboardPage />
            </RequireMerchant>
          }
        />
        <Route
          path="/merchant/:slug/agent"
          element={
            <RequireMerchant>
              <MerchantAgentPage />
            </RequireMerchant>
          }
        />
        <Route
          path="/merchant/:slug/products/new"
          element={
            <RequireMerchant>
              <MerchantAddProductPage />
            </RequireMerchant>
          }
        />

        {/* V3.1 M1.C.6 — cloud-save listing page (email-keyed). */}
        <Route path="/my-designs" element={<MyDesignsPage />} />

        {/* OMS Phase 1 - Admin merchants stub (Clerk-protected) */}
        {/* OMS Phase 2 - Full admin portal: merchants list/detail, orders, payouts */}
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<Navigate to="/admin/merchants" replace />} />
          {/* Phase 1 stub kept at /admin/merchants/legacy for fallback. */}
          <Route path="merchants/legacy" element={<AdminMerchantsPage />} />
          <Route
            path="merchants"
            element={
              <RequireAdmin>
                <MerchantsListPage />
              </RequireAdmin>
            }
          />
          <Route
            path="merchants/:slug"
            element={
              <RequireAdmin>
                <MerchantDetailPage />
              </RequireAdmin>
            }
          />
          <Route
            path="orders"
            element={
              <RequireAdmin>
                <OrdersListPage />
              </RequireAdmin>
            }
          />
          <Route
            path="payouts"
            element={
              <RequireAdmin>
                <PayoutsListPage />
              </RequireAdmin>
            }
          />
          <Route
            path="products"
            element={
              <RequireAdmin>
                <ProductsListPage />
              </RequireAdmin>
            }
          />
          <Route
            path="suppliers"
            element={
              <RequireAdmin>
                <SuppliersListPage />
              </RequireAdmin>
            }
          />
          <Route
            path="dashboard"
            element={
              <RequireAdmin>
                <DashboardPage />
              </RequireAdmin>
            }
          />
          <Route
            path="audit-log"
            element={
              <RequireAdmin>
                <AuditLogPage />
              </RequireAdmin>
            }
          />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  </React.StrictMode>,
);
