# BACKEND FUNCTIONING REPORT — PPW Designer / Merchant

> Phase 7 of `BACKEND-RUN-ORDER-2026-06-11` — the acceptance gate. Generated on the
> integration branch `feat/designer-backend-acceptance-2026-06-11`, which merges the
> P4 + P5 + P6 feature branches (feature→feature; **never main**) so the whole backend
> can be proven to compose. No production deploy, no live DB write, no money path
> activated — every commercial/physical item is recorded as GATE-2.

## TOP-LINE VERDICT: **BACKEND FUNCTIONING: YES**

Every backend gateway in the acceptance matrix asserts PASS in a headless test. The only
open items are **GATE-2** (Vic-owned: gateway approvals, live keys, real-device click-through)
and one **dark-by-design** item (coupon redemption increment, gate G-6) — none of which a
headless runner can or should satisfy. Per the run-order, this YES is the trigger to begin
the **front-end tweak phase** (PDP UI, GATE-V visual pass, Playwright journeys — C4.3/C4.6).

## Evidence base

- `npm run build` — clean (tsc --noEmit + vite), 0 errors.
- `npx vitest run` — **1514 / 1515 pass** across 145 files. The single red is a **pre-existing,
  network-dependent front-end flake** unrelated to the backend: `src/lib/__tests__/fx.test.ts >
  fetchFxSnapshot > "falls back when fetch is unavailable"` calls `fetchFxSnapshot(undefined)`, whose
  fallback path makes a **real live FX HTTP call** that times out (5s) in this sandboxed/offline runner.
  It is in `src/`, touches `src/lib/fx.ts` (never modified by P4–P7), and passed green in the earlier
  P4/P5/P6 full-suite runs. **All 14 consolidated acceptance tests + every backend-gateway test pass.**
- **Vercel function count: 11 top-level `api/*.ts` + 1 nested (`stripe-connect/webhook.ts`) = 12/12** — cap held; zero new functions across P4–P7.
- Render-verified: `#root` childElementCount > 0, document.title correct, **zero console errors**.

## Acceptance matrix

| # | Gateway | Verdict | Evidence (test) |
|---|---|---|---|
| 1 | **Health** — `/api/healthcheck` 200 + `sentryConfigured` | ✅ PASS | `backend-acceptance.test.ts` ACCEPTANCE 1 (handler 200, `ok:true`, boolean flag) |
| 2 | **Catalog + search** (P4) — sort/relevance/suggest | ✅ PASS | `backend-acceptance.test.ts` ACCEPTANCE 2 · `products.test.ts` · `products-search.test.ts` |
| 3 | **Reviews** (P4) — submit→pending, verified-purchase, published-only list, aggregate, moderation | ✅ PASS | `backend-acceptance.test.ts` ACCEPTANCE 3 (full lifecycle) · `reviews.test.ts` |
| 4 | **Cart split-quote + coupon** (P6) — split, discount, empty-cart guard, expired→error | ✅ PASS | `backend-acceptance.test.ts` ACCEPTANCE 4 · `coupons.test.ts` · `cart-split.test.ts` |
| 5 | **Orders + fulfilment** — timeline transitions, aggregate, webhook HMAC + dedupe | ✅ PASS | `backend-acceptance.test.ts` ACCEPTANCE 5 · `order-status.test.ts` · `webhookDedupe.test.ts` · `webhook-replay.test.ts` |
| 6 | **Merchant onboarding** (P5) — KYC-lite transition, go-live checklist, bulk CSV validate/preview | ✅ PASS | `backend-acceptance.test.ts` ACCEPTANCE 6 · `merchant-onboarding.test.ts` · `merchant-bulk-upload.test.ts` |
| 7 | **Payouts** (P5) — ledger read over `payout_queue`, 5% lines, Connect→KYC mapping | ✅ PASS | `backend-acceptance.test.ts` ACCEPTANCE 7 · `payout-ledger.test.ts` · `stripeConnectWebhook.test.ts` |
| 8 | **Commission ledger** (P6) — 5% lines + reconcile pending→reconciled | ✅ PASS | `backend-acceptance.test.ts` ACCEPTANCE 8 · `commission-ledger.test.ts` |
| 9 | **Admin** — Clerk gate 401 unauth; lists + audit-log | ✅ PASS | `backend-acceptance.test.ts` ACCEPTANCE 9 · `adminAuth.test.ts` · `admin-router.test.ts` · `admin-*-list.test.ts` |
| 10 | **Agent** — `/api/agent-chat` health + `openrouterConfigured` (model mocked) | ✅ PASS | `agent.test.ts` (mocked transport; no live OpenRouter call) |
| 11 | **Observability** — thrown server error → `captureServerError`/Sentry; no-DSN no-op | ✅ PASS | `backend-acceptance.test.ts` ACCEPTANCE 11 · `captureServerError.test.ts` · `sentry.test.ts` |
| 12 | **Cron** — CRON_SECRET-gated jobs run headlessly | ✅ PASS | `refresh-supplier-rating.test.ts` · `reconcile-email-sends.test.ts` |
| 13 | **Invariants** — ≤12 functions, migrations additive+reversible, money tables untouched | ✅ PASS | `backend-acceptance.test.ts` ACCEPTANCE 13 (fs-asserted fn count + rollback + no money-table ALTER) |

**Gateways: 13/13 PASS · 0 BLOCKED.**

## Migration list (additive + reversible; apply to live Neon = GATE-2)

| Version | Phase | Adds | Money/order tables touched |
|---|---|---|---|
| `0027_product_reviews` | P4 | `product_reviews` table + `review_status` enum | None (FK refs to products/orders only) |
| `0028_merchant_onboarding` | P5 | `merchants` cols (`onboarding_step`, `kyc_status`, `payout_method`, `go_live_at`) + `merchant_kyc_status` enum | None (`payout_queue` shape untouched) |
| `0029_coupons_commission` | P6 | `coupons` + `commission_ledger` tables + `coupon_type`/`commission_status` enums | None (`designer_referrals` read-only) |

Each has a `*_rollback.sql` that drops cleanly in dependency-safe order and clears its `schema_migrations` row. Asserted in `migration-0027/0028/0029-*.test.ts` + acceptance invariants.

## Dark / not-activated (gate G-6 — by design, not a gap)

- **Coupon redemption increment** — `incrementRedemption()` is built + tested (atomic over-redemption guard) but **NOT wired** to any live payment/capture path. Validating a quote never consumes a redemption (idempotent). Wiring it to order completion is GATE-2.
- No live coupon issued, no funds moved, no gateway flipped.

## GATE-2 — Vic-owned (no headless runner can satisfy these)

- Merge P4–P7 → `main`; apply migrations `0027`–`0029` to live Neon; deploy.
- Gateway approvals: MCB CNP / MIPS / Stripe Connect activation (`STRIPE_MU_SUPPORTED`).
- Issue the real K1 Pattern-C coupon + confirm K1 MoU/tier (gate G-6, stale since W21).
- Real-device customer click-through (iPhone + desktop).
- First tracked Pattern-C transaction = M4 "first MUR".

## Clean GATE-2 merge order (for Vic, at the PC)

The integration branch proves all four merge without conflict against each other. Either path works:

**Option A — merge the integration branch (everything at once):**
1. `feat/designer-backend-acceptance-2026-06-11` → `main`.

**Option B — merge phases individually, in order:**
1. `feat/designer-backend-reviews-search-2026-06-11` → `main`
2. `feat/designer-backend-onboarding-payouts-2026-06-11` → `main`
3. `feat/designer-backend-coupons-ledger-2026-06-11` → `main`
4. `feat/designer-backend-acceptance-2026-06-11` → `main` (brings this report + the acceptance suite)

Then, after merge: apply migrations `0027` → `0028` → `0029` to live Neon (Vercel-managed `DATABASE_URL`), deploy, and smoke:

```
curl -s "https://designer.ppwellness.co/api/healthcheck?cb=$RANDOM"
curl -s "https://designer.ppwellness.co/api/products?sort=rating&limit=3"
curl -s "https://designer.ppwellness.co/api/products/1/reviews"
```

---
*Phase 7 acceptance — Opus 4.8, autonomous runner. Branch-only; nothing merged to main, nothing money-touching activated.*
