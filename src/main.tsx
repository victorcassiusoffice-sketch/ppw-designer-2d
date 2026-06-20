import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import * as Sentry from '@sentry/react';
import App from './App';
import CartPage from './pages/CartPage';
import CheckoutPage from './pages/CheckoutPage';
import OrderSuccessPage from './pages/OrderSuccessPage';
import OrderCancelledPage from './pages/OrderCancelledPage';
import OrderPendingPage from './pages/OrderPendingPage';
import OrdersPage from './pages/OrdersPage';
import SuppliersPage from './pages/SuppliersPage';
import SuppliersSignupCompletePage from './pages/SuppliersSignupCompletePage';
import AdminLayout from './pages/AdminLayout';
import AdminMerchantsPage from './pages/AdminMerchantsPage';
import RequireAdmin from './admin/RequireAdmin';
import MerchantsListPage from './pages/admin/MerchantsListPage';
import MerchantDetailPage from './pages/admin/MerchantDetailPage';
import OrdersListPage from './pages/admin/OrdersListPage';
import PayoutsListPage from './pages/admin/PayoutsListPage';
import ProductsListPage from './pages/admin/ProductsListPage';
import SuppliersListPage from './pages/admin/SuppliersListPage';
import DashboardPage from './pages/admin/DashboardPage';
import AuditLogPage from './pages/admin/AuditLogPage';
import PublicProductsPage from './pages/PublicProductsPage';
import MarketplaceCartPage from './pages/MarketplaceCartPage';
import MarketplaceCheckoutPage from './pages/MarketplaceCheckoutPage';
import OrderTrackPage from './pages/OrderTrackPage';
import MerchantAgentPage from './pages/MerchantAgentPage';
import MerchantDashboardPage from './pages/MerchantDashboardPage';
import MerchantOnboardingPage from './pages/MerchantOnboardingPage';
import MerchantAddProductPage from './pages/MerchantAddProductPage';
import RequireMerchant from './components/RequireMerchant';
import MyDesignsPage from './pages/MyDesignsPage';
// DESIGNER-EXPANSION P4 — multi-domain picker + per-domain builder shell.
// Additive routes (`/build`, `/build/:domainId`); the wellness `/` + `/designer`
// routes are untouched.
import { DomainPicker } from './components/domain/DomainPicker';
import { DomainBuilderShell } from './components/domain/DomainBuilderShell';
import { bootstrapFx } from './store/currencyStore';
import './index.css';

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
      <Routes>
        <Route path="/" element={<App />} />
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

        {/* OMS Wave 1 - Marketplace checkout flow */}
        <Route path="/marketplace/cart" element={<MarketplaceCartPage />} />
        <Route path="/marketplace/checkout" element={<MarketplaceCheckoutPage />} />
        <Route path="/order/track/:orderRef" element={<OrderTrackPage />} />
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

        {/* DESIGNER-EXPANSION P4 — multi-domain picker + per-domain builder.
            Wellness-room enters via /designer (unchanged); airplane + car are
            gated by DomainConfig.enabled inside the shell. */}
        <Route path="/build" element={<DomainPicker />} />
        <Route path="/build/:domainId" element={<DomainBuilderShell />} />

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
    </BrowserRouter>
  </React.StrictMode>,
);
