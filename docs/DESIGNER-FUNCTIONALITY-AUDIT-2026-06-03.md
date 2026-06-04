# Wellness Room Designer — Exhaustive Functionality Audit + Prioritized Gateway Backlog

**Repo:** `ppw-designer-2d` · **Live:** https://designer.ppwellness.co
**Audit date:** 2026-06-03 · **Live prod commit:** `86125f9` (verified, cache-busted healthcheck; matches local `main`)
**Mode:** Audit + plan only. No code changed, no deploy. This is the backlog a future build /goal executes.

---

## 0. TOP-LINE STATUS

The Designer is a **mature, broad OMS** (Order Management System) bolted onto a **Konva 2D room-design canvas**. Frontend, backend, DB, payments, auth, merchant + admin + customer surfaces all exist and largely build/test clean. The gap is **not "does it exist"** — it's **"is it production-trustworthy and finished end-to-end."**

| Signal | Result |
|---|---|
| Production render (live) | ✅ Mounts clean — `#root` has children, 2 canvases, correct title, **zero console errors** on load |
| `npm run build` | ✅ Clean (tsc + vite). Babylon chunk = **6.46 MB raw / 1.43 MB gzip** (lazy) |
| `npm run test` (vitest) | ✅ **1353/1353 pass** across 126 files |
| Live API gateways | ⚠️ Mostly live; **2 confirmed prod bugs** (capture PDF 500; all-placeholder product images) |
| Synthetic click-through (customer place/select) | ⛔ Not reliably testable via CDP (HTML5-DnD + Konva) — needs real-device pass |
| Vercel function cap | ⚠️ **12/12 — zero headroom.** Any new `api/*.ts` file = build failure |
| Sentry (live) | ⚠️ `javascript-react` project: **0 events/30d**; server-side 500s **not captured** (observability blind spot). 3 alert rules exist (§9) |
| Backlog tracker | ✅ 36 rows → isolated Neon `ops.designer_audit_tasks` (seeder + SQL + CSV + brain mirror). Live rows pending creds (§10) |

**Two hard live bugs found this pass:**
1. **`/api/capture/reference-page.pdf` AND `…-v2.pdf` return HTTP 500** (`FUNCTION_INVOCATION_FAILED`). The merchant cannot print the calibration sheet → the **entire phone-capture onboarding path is broken in production.**
2. **All 19 live API products use `placehold.co` placeholder images** (zero real imagery). The catalog looks unfinished to any customer or to K1.

**Headline recommendation:** The next build /goal should (a) fix the two live bugs, (b) execute the **3D-viewer removal** (Section 7 — biggest single simplification, ~1.4 MB gzip + whole engine surface gone), then (c) close the customer edit-loop and merchant-capture gaps. Detailed priority order in Section 6.

---

## 1. METHODOLOGY & EVIDENCE

- **Intended functionality** pulled from PPW Second Brain: `architecture/api-deploy-topology.md` (authoritative), `REPO-REGISTRY.md`, `00-TECH-STACK-MAP.md`, `sims-parity/master/MASTER-BUILD-PLAN.md` + `MASTER-DATA-FLOW.md` + `VIC-INTEGRATION-DECISIONS.md`, `wellness-designer-user-testing-dept/_INDEX.md`, `user-testing/customer-ui-report-2026-05-31.md`, `_handoff/designer-ship-to-live-2026-05-31.md`.
- **Codebase** mapped exhaustively (frontend surfaces, backend gateways, DB migrations, 3D code) via direct read.
- **Live verification:** cache-busted healthcheck, browser render check (root mount + console), and direct `curl` probes of the live API gateways.
- **Render-verification lesson applied:** "build green" alone is not "works." Confirmed the live app actually mounts in a real browser with zero console errors.

**Limitation (flag for next pass):** Synthetic drag-to-place and click-to-select on the Konva canvas are **not reliably drivable** via CDP automation (documented limitation — HTML5 native DnD + Konva hit-testing). The placement/edit-loop behaviour and the known re-select blocker fix (`c526471`) are covered by **passing unit tests** (`customer-ui-fixes-2026-05-31.test.ts`) but still warrant a **real-device click-through** (iPhone + desktop) as the next verification pass.

---

## 2. ARCHITECTURE AT A GLANCE

| Layer | Tech | Notes |
|---|---|---|
| Canvas engine (live) | **Konva 2D** (react-konva) | Stable-lock at commit `26c144c` (additive-only discipline) |
| Canvas engine (toggle) | **Babylon 3D** (`@babylonjs/core` 9.x) | Lazy `?engine=babylon`; toggle live at canvas bottom. **Slated for removal — §7** |
| Frontend | React 18 + Vite 5 + TS + Tailwind + Zustand | 18 stores, ~30 pages, react-router 6 |
| Backend | Vercel serverless (Hobby) | **12/12 functions**, catch-all routers |
| DB | **Neon Postgres** (`ppw-marketplace`) | Drizzle ORM. **Single branch — no prod/preview isolation** |
| Payments | **Stripe** (checkout + Connect) + **PayPal** (create/capture/webhook) | Code complete; live-gateway approval pending |
| Auth | **Clerk** (admin) + **HMAC magic-link** (merchant) + email-cache (customer) | Customer journey deliberately login-light |
| Email | **Resend** | Order/merchant/design templates + cron reconcile |
| Agent | **OpenRouter** (Gemini Flash → Claude Sonnet fallback) | Live, `openrouterConfigured:true` |
| Infra | Upstash (rate-limit + webhook dedupe), Vercel Blob (capture), Sentry | |

---

## 3. CUSTOMER SURFACE — functionality + status

| Aspect | Where | Status | Notes / evidence |
|---|---|---|---|
| Designer landing (`/`, `/designer`) | `App.tsx`, `RoomCanvas.tsx` | ✅ Works | Renders live, 0 console errors |
| Room dims (Rect L×W) + Draw polygon | `TopBar`, `RoomDrawMode` | ✅ Works | |
| Wall draw tool (50 cm snap) | `WallDrawMode`, `wallStore` | ✅ Works | |
| Multi-room property model | `propertyStore` (`designStore` facade) | ✅ Works | |
| Catalog (tabs, filter chips, search, region) | `ProductPalette`, `CatalogStrip`, `useProducts`, `apiCatalogAdapter` | ✅ Works | UI shows "41 of 41" (API 19 + bundled seed merge) |
| **Product imagery** | catalog cards | 🟠 **Partial — all placeholders** | Live API: **19/19 `placehold.co`**, descriptions null. Top-down image pipeline not applied |
| Place item (desktop drag / mobile tap) | `RoomCanvas`, `useDragToPlace`, `placementIntentStore` | ✅ Works (per tests) | ⛔ not synthetically verified live |
| Grid snap 0.5 m / 0.25 m | `useGridSnap`, `designerUIStore` | ✅ Works | |
| Select / re-select placed item | `RoomCanvas`, `PlacedItem` | ✅ Fixed `c526471` | Was the C2/D3 "frozen room" blocker; unit-tested. **Real-device confirm pending** |
| Rotate / duplicate / delete | keyboard + `FloatingCluster` (mobile) | ✅ Works | Touch dup/delete added `c526471` |
| Undo / redo (50-step unified) | `historyStore`, `useBuildHistory` | ✅ Works | |
| Mobile Sims bottom toolbar | `mobile/SimsBottomToolbar`, `MobileProductPopup` | ✅ Works | `--sims-toolbar-h` overlay offset |
| Cost readout + currency (MUR/USD/EUR/GBP) | `cartStore`, `currencyStore`, `fx.ts` | ✅ Works | live FX bootstrap |
| Cart (designer) + drawer + mini-pill | `cartStore`, `cart/CartDrawer`, `MiniCartPill` | ✅ Works | |
| Marketplace cart (separate system) | `marketplaceCartStore`, `Marketplace*Page` | ⚠️ Works but **duplicate cart** | Two cart systems coexist (designer vs marketplace) — consolidation candidate |
| Checkout (Stripe + PayPal fallback) | `CheckoutPage`, `checkoutStore` | ✅ Code complete | Live gateway approval pending (sandbox) |
| Order success / cancel / pending / track | `Order*Page`, `OrderTrackPage` | ✅ Works | `/api/orders/:ref` live (404 on unknown) |
| Cloud save + My Designs (email-keyed) | `useAutoSave`, `designsApi`, `MyDesignsPage`, `customerIdentity` | ✅ Works | `/api/designs` live (200) |
| Request quote / lead capture | `designsApi.submitLead` → `/api/leads` | ✅ Works | |
| Share render / capture screen (PNG/PDF) | `shareImage`, `planPdf`, html2canvas | ✅ Works | |
| K1 "Buy" outbound (Pattern C commission) | `DetailsPanel` → `/api/k1/redirect` | ✅ Works | attribution to `designer_referrals` |
| Onboarding tour | (live) "STEP 1 OF 3" | ✅ Works | present on first load |
| Paint / flooring / wall-treatment | `paintCalculator`, `floorZoneStore`, `wallTreatmentStore`, `/api/calc/:type` | 🟠 Partial/stub | calc API folded into merchants-router; floor/wall-treatment stores have no live UI consumer |
| `OrdersPage` (`/orders`) | `OrdersPage` | 🟠 Stub | basic page |
| Debug clutter (HUD) | live canvas | 🟡 Issue | `"20.00 m2 - 18.00 m - 100%"` bbox text + `"Week 2 - drag-drop…"` footer visible in prod |

---

## 4. MERCHANT SURFACE — functionality + status

| Aspect | Where | Status | Notes |
|---|---|---|---|
| Merchant signup / onboarding | `MerchantOnboardingPage`, `SuppliersPage`, `/api/merchants/signup` | ✅ Works | rate-limited (Upstash) |
| Magic-link sign-in (HMAC, 30-day) | `/api/merchants/:slug/magic-link`, `merchantSession.ts`, `RequireMerchant` | ✅ Works | needs `MERCHANT_SESSION_SECRET` |
| Merchant dashboard (`/merchant/:slug`) | `MerchantDashboardPage` | ✅ Works | SPA route live (200) |
| AI agent product-add | `MerchantAgentPage`, `/api/agent-chat`, `agent/*` | ✅ Live | `openrouterConfigured:true`; intent `addMerchantProduct` |
| Add product (form) | `MerchantAddProductPage`, `/api/merchants/:slug/products` | ✅ Works | full CRUD + soft-delete + audit |
| **Phone capture: reference PDF** | `/api/capture/reference-page.pdf(+v2)`, `referencePage.ts` | ⛔ **BROKEN (500)** | `FUNCTION_INVOCATION_FAILED` live — **blocks the whole capture flow** |
| Capture modal (6-step FSM) | `capture/CaptureModal` + Camera/Corner/Dimension/Review | 🟠 Partial | UI scaffold present; gated upstream by the PDF 500; side/back + XR stubbed |
| Calibrate → scale-lock HMAC | `/api/merchants/:slug/capture/calibrate`, `calibrateHandler`, migration `0024` | ✅ Code complete | depends on `CAPTURE_LOCK_HMAC` |
| Sign blob upload | `/api/merchants/:slug/capture/sign-upload`, `signUpload.ts` | ✅ Code complete | Vercel Blob |
| Product image upload | `/api/merchants/:slug/products/upload-image`, `uploadProductImage.ts` | ✅ Code complete | |
| Fulfilment webhook (HMAC + dedupe) | `/api/merchants/:slug/order-update`, `orders.ts` | ✅ Works | per-merchant `webhookSecret`, Upstash dedupe |
| Stripe Connect payouts | `stripeConnect.ts`, `/api/stripe-connect/webhook` | 🟠 Partial/stub | account-create wired (gated `STRIPE_MU_SUPPORTED`); webhook receiver thin |

---

## 5. ADMIN + BACKEND GATEWAYS — functionality + status

### 5.1 Admin (`/admin/*`, Clerk-gated via `RequireAdmin` + `adminAuth`)

| Route / page | Status | Notes |
|---|---|---|
| Merchants list/detail + approve/reject | ✅ Works | `/api/admin/merchants*` live, returns **401 unauth** (gate works) |
| Orders / Payouts / Products / Suppliers lists | ✅ Works | `admin-router` dispatch |
| Products write + CSV import | ✅ Works | audit-logged |
| Dashboard (stats) + Audit log | ✅ Works | |

### 5.2 API gateways (12/12 Vercel functions)

| Function | Folds | Status (live probe) |
|---|---|---|
| `healthcheck.ts` | — | ✅ 200, commit `86125f9` |
| `products.ts` | public + merchant CRUD + facets | ✅ 200 (19 products, all placeholder imgs) |
| `cart-quote.ts` | per-merchant split | ✅ 200 (validates empty cart) |
| `create-checkout-session.ts` | Stripe checkout | ✅ 204 on OPTIONS (CORS) |
| `stripe-webhook.ts` | checkout.completed + payment_failed | ✅ Code complete (in-mem dedupe — KV upgrade noted) |
| `stripe-connect/webhook.ts` | Connect account status | 🟠 Stub |
| `paypal-router.ts` | create/capture/webhook | ✅ Code complete (multi-currency) |
| `merchants-router.ts` | signup, capture×4, upload, **calc** | ⛔ capture-PDF route 500; rest OK |
| `orders.ts` (1689 lines) | orders, designs, leads, magic-link, agent-session, K1 redirect, commission reconcile, cowork-os feeds | ✅ Works (probed 200/404 correctly) |
| `admin-router.ts` | admin console | ✅ Works (401 gate) |
| `agent-chat.ts` | merchant AI | ✅ Live, OpenRouter configured |
| `cron-router.ts` | escalate-orders (9am), refresh-supplier-rating, email-reconcile | ✅ Works (CRON_SECRET-gated) |

### 5.3 Database (Neon, Drizzle) — tables

`merchants`, `merchant_documents`, `admins`, `orders`, `order_items`, `order_item_events`, `webhook_events`, `payout_queue`, `audit_log`, `products`, `suppliers`, `supplier_products`, `product_capture_scale_locks`, `agent_sessions`, `agent_messages`, `designs`, `leads`, `designer_referrals`.

- **Migration gap 0012–0023** (jumps 0011 → 0024). Cosmetic/historical, but worth a documented note so a future dev doesn't think migrations are missing.
- **`use_gltf` column (0025)** is frontend-3D-only — harmless to leave after 3D removal (see §7).
- **DO-NOT-BREAK (money/order path):** `orders`, `order_items`, `products`, `suppliers`, `payout_queue`, `webhook_events`.

### 5.4 Cross-cutting infra
Rate-limit (Upstash, fails-open), webhook idempotency (in-mem for Stripe → KV upgrade recommended; KV for merchant), Sentry (DSN-gated), Vercel Blob (capture/upload). **Env vars** inventory: see Appendix B.

---

## 6. PRIORITIZED BACKLOG

Priority key: **P0** = broken in prod / blocks core journey · **P1** = finish core journey or remove dead weight · **P2** = polish / trust · **P3** = future / nice-to-have.

### P0 — Broken in production / blocks a core journey

| # | Item | Status | What's needed to make it fully functional |
|---|---|---|---|
| P0-1 | **Capture reference PDF 500** (`/api/capture/reference-page.pdf` + `-v2`) | ⛔ Broken live | Debug `referencePage.ts` in serverless runtime (likely jsPDF/autotable bundling or font/buffer issue under Vercel Node). Add a runtime smoke test + Sentry alert. **Unblocks merchant capture onboarding end-to-end.** |
| P0-2 | **Real product imagery** (19/19 placeholders live) | 🟠 Partial | Run the top-down product-image conversion pipeline (Fal.ai FLUX per Brand/Media skill) for K1 SKUs; backfill `imageUrl`; fill null `description`s. Catalog currently reads as unfinished to K1 + customers. |
| P0-3 | **Real-device customer click-through** (place→select→edit→cart→checkout) on iPhone + desktop | ⛔ Unverified | Manual/real-device pass to confirm the `c526471` re-select fix + touch dup/delete + checkout actually work for a human. Synthetic CDP cannot prove this. |

### P1 — Finish core journey / remove dead weight

| # | Item | Status | What's needed |
|---|---|---|---|
| **P1-1** | **Remove 3D (Babylon) viewer + toggle** | ▶ Top simplification | Full plan in **§7**. Deletes 15 files + 3 e2e specs, edits `App.tsx`/`GamingLayer1Surfaces.tsx`/`package.json`. **−1.43 MB gzip**, removes a whole untested-in-prod surface. **Low blast radius.** |
| P1-2 | **Consolidate the two cart systems** | ⚠️ Duplicate | Designer cart (`cartStore`) vs marketplace cart (`marketplaceCartStore`) + two checkout pages. Pick one path, deprecate the other, or document the intended split. Reduces confusion + bug surface. |
| P1-3 | **Payment go-live readiness** | 🟠 Pending external | Code complete (Stripe + PayPal). Gated on live gateway approval (MCB CNP / MIPS / Stripe). Add idempotency key to checkout-session; move Stripe webhook dedupe to KV. **Quick-check before any live-money diff per Vic Protocol.** |
| P1-4 | **Stripe Connect payout webhook** | 🟠 Stub | Flesh out `stripe-connect/webhook.ts` (account.updated → merchant KYC status) before any merchant payout runs. |
| P1-5 | **Capture flow finish** (side/back shots, error states) | 🟠 Partial | After P0-1, complete the 6-step FSM tail + reconcile-dimensions UX. |
| P1-6 | **Remove dead `.PAYPAL-SLICE` files + stale repo junk** | 🟡 Cleanup | Delete the 3 zero-byte `*.PAYPAL-SLICE` files, `nul`, `*.bundle`, `.audit-probe`, `test-*.tmp`, dozens of `vite.config.ts.timestamp-*.mjs`, stray `merchant-page.html`/`products-prod.json`. Repo root is cluttered. |

### P2 — Polish / trust

| # | Item | Status | What's needed |
|---|---|---|---|
| P2-1 | **Remove prod debug clutter** | 🟡 Issue | On-canvas `"20.00 m2 - 18.00 m - 100%"` bbox text + `"Week 2 - drag-drop, collision…"` footer are visible to customers. Gate behind a dev flag or delete. |
| P2-2 | **HUD declutter** (top-right) | 🟡 Issue | Area/perimeter/zoom/snap/count badges overlap Share/Capture/cart cluster. Re-lay-out for mobile safe-area. |
| P2-3 | **`OrdersPage` build-out** | 🟠 Stub | Real customer order history (currently basic). |
| P2-4 | **Wire or remove stub stores/components** | 🟠 Stub | `floorZoneStore`, `wallTreatmentStore`, `WallSlab`, `WoodPlankFloor`, `DragLayer`, `ContextMenu` have no live consumer — either wire (paint/floor feature) or delete. |
| P2-5 | **Mouse-wheel zoom + off-lot guard** | 🟡 Issue | Per 2026-05-31 report: wheel zoom no-op; off-lot move not blocked. Confirm on real device, fix if still present. |
| P2-6 | **Stripe webhook dedupe → KV** | 🟡 Hardening | In-memory Set is single-instance only; move to Upstash for multi-lambda safety. |
| P2-7 | **Document migration gap 0012–0023** | 🟡 Hygiene | One-line note so it doesn't read as missing migrations. |

### P3 — Future / out of current scope

| # | Item | Status |
|---|---|---|
| P3-1 | WebXR / AR capture (`XRCaptureStage`, v3) | Stub — keep parked |
| P3-2 | Paint/flooring calculator customer UI | Partial — pending product decision |
| P3-3 | Neon prod/preview DB isolation | Risk — single branch; consider a preview branch before external load |
| P3-4 | Agent per-merchant cost-cap enforcement (Phase 6 pt 2) | Partial |

---

## 7. 3D-VIEWING REMOVAL PLAN (item P1-1 — detailed)

**Goal:** remove the Babylon 3D viewer + the `KONVA 2D / BABYLON 3D` toggle entirely; keep Konva 2D only. **Do NOT remove yet — this is the plan.**

**Why it's a top item:** the 3D path is a large (6.46 MB / 1.43 MB gzip) lazy bundle, is gated behind a soak that hasn't flipped (`DEFAULT_ENGINE='konva'`), is **not exercised by customers in prod**, and carries its own test/maintenance surface. Removing it is the single biggest net simplification with **low blast radius** (it's isolated behind a lazy import and reads stores one-directionally — nothing Konva depends on imports it).

### 7.1 Files to DELETE (18)
```
src/designer/babylon/Assets.ts
src/designer/babylon/BabylonRoom.tsx
src/designer/babylon/Camera.ts
src/designer/babylon/DetailCardAnchor.ts
src/designer/babylon/EngineToggle.tsx
src/designer/babylon/HeroMeshes.ts
src/designer/babylon/Materials.ts
src/designer/babylon/Placement.ts
src/designer/babylon/ProceduralProductBox.ts
src/designer/babylon/ProductMeshBuilder.ts
src/designer/babylon/Scene.ts
src/designer/babylon/Selection.ts
src/designer/babylon/Touch.ts
src/designer/babylon/defaultEngine.ts
src/designer/babylon/engineFlag.ts
tests/e2e/babylon-mirror.spec.ts
tests/e2e/babylon-budget.spec.ts
tests/e2e/p0d-babylon-place.spec.ts
```

### 7.2 Files to EDIT
- **`src/App.tsx`** — remove `isBabylonActive` import + `BabylonRoomLazy` lazy import; remove the `babylonActive` const and the `{babylonActive ? <Suspense><BabylonRoomLazy/></Suspense> : <RoomCanvas/>}` branch, leaving a plain `<RoomCanvas/>`. (Keep `lazy`/`Suspense` imports — used elsewhere.)
- **`src/designer/GamingLayer1Surfaces.tsx`** — remove `EngineToggle` import + `<EngineToggle />` render.
- **`package.json`** — remove `"@babylonjs/core"` dependency, then `npm install`.
- **`src/designer/__tests__/gamingV1Flag.test.ts`** — remove the engine-default/override describe block (imports babylon modules) OR narrow to gamingV1 tests only.
- **`tests/e2e/phase-0-acceptance.spec.ts`**, **`phase-5-journey.spec.ts`**, **`auto-dig-2026-05-25.spec.ts`** — remove the `?engine=babylon` probe blocks.

### 7.3 DB / API — leave as-is (harmless)
- `products.use_gltf` column (migration 0025) + `products_use_gltf_idx`: no API reads it after frontend removal. Leave (or run `0025_*_rollback.sql` if a clean schema is preferred).
- `mesh_url` fixture-schema field: orphaned, harmless.

### 7.4 Risk — LOW
- Babylon is behind a lazy-import boundary; no `src/**` outside `babylon/` imports it.
- Store coupling is one-directional (Babylon **reads** `designStore`/`wallStore`, never writes) — removing it leaves stores intact.
- DetailCard anchoring, selection, touch, placement all have **independent Konva implementations**; the babylon/* equivalents are isolated.
- **Capture-side WebXR (`XRCaptureStage`) is a SEPARATE feature** from the Babylon room viewer — this removal does not touch it.

### 7.5 Verify after removal
`npm run build` (confirm no `BabylonRoom-*.js` chunk, ~1.4 MB gzip smaller) → `npm run test` (all green) → live: `/?engine=babylon` should no-op to Konva → render-verify root mount + zero console errors.

---

## 8. DO-NOT-BREAK INVARIANTS (for the build /goal)
1. **Vercel 12/12 cap** — never add a new top-level `api/*.ts`; fold into a catch-all router.
2. **Konva stable-lock `26c144c`** — additive-only to render core.
3. **Money/order tables** — `orders`, `order_items`, `products`, `suppliers`, `payout_queue`, `webhook_events`.
4. **Neon single branch** — every write (even from a preview) hits prod data; gate destructive ops.
5. **Ship discipline** — merge to `main` → auto-deploy; verify with **cache-busted** `/api/healthcheck?cb=…` (edge-cached). Payment-touching diffs → Vic quick-check.

---

## Appendix A — Live probe log (2026-06-03)
```
/api/healthcheck?cb=…           200  commit=86125f9 env=production
/api/products?limit=2           200  K1 products, imageUrl=placehold.co
/api/products?limit=100         200  19 products, 19 placehold / 0 real
/api/cart-quote (POST {})        →   {"error":"Cart is empty."}
/api/admin/merchants             401  (auth gate OK)
/api/orders/NONEXISTENT          404  (OK)
/api/capture/reference-page.pdf  500  FUNCTION_INVOCATION_FAILED  ⛔
/api/capture/reference-page-v2.pdf 500 ⛔
/api/agent-chat (GET)            200  openrouterConfigured:true
/api/designs?email=…             200
/merchant/k1-sport               200  (SPA)
/api/create-checkout-session OPTIONS 204 (CORS OK)
Browser render: #root childElementCount=1, 2 canvases, 0 console errors
```

## Appendix B — Env vars referenced
`DATABASE_URL`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_WEBHOOK_SECRET_CONNECT`, `STRIPE_MU_SUPPORTED`, `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_MODE`, `VITE_PAYPAL_ENABLED`, `OPENROUTER_API_KEY`, `OPENROUTER_ORG`, `RESEND_API_KEY`, `CLERK_SECRET_KEY` (+ `VITE_CLERK_*`), `MERCHANT_SESSION_SECRET`, `CAPTURE_LOCK_HMAC`, `KV_REST_API_URL`, `KV_REST_API_TOKEN`, `CRON_SECRET`, `COWORK_OS_API_KEY`, `PPW_PUBLIC_ORIGIN`, Vercel Blob token, Sentry DSN, `VERCEL_ENV`, `VERCEL_GIT_COMMIT_SHA`, future: `FAL_AI_API_KEY`, `WORLDLABS_API_KEY`.

---

## 9. SENTRY / OBSERVABILITY (live, 2026-06-03)

Queried via the `ppwellness` Sentry org token (`alerts:read, alerts:write, org:read, project:read`). **One project exists: `javascript-react` (id `4511381065171024`).**

**Findings:**
- **Zero events received in the last 30 days** on `javascript-react`. The project has **3 active issue-alert rules** ("New issue — ppw-designer-2d" on new-issue, high-priority alerts, "Email #ppwellness" team notify) — but nothing is flowing.
- **Server-side errors are NOT captured.** The live `/api/capture/reference-page.pdf` **500** (a real prod failure) does **not** appear in Sentry. `@sentry/node` is a dependency and `api/lib/sentry.ts` exists, but serverless function errors aren't reaching a Sentry project. → **observability blind spot** (tracker `sentry-server-errors-uncaptured`, P1).
- **Token scope is insufficient for error pull.** The available token lacks `event:read`/`issue:read`, so issue/error lists can't be queried programmatically. A read-scoped token is needed for future audit automation (tracker `sentry-token-scope`, P2).

**Implication:** the only way prod 500s currently surface is the new-issue email alert — *if* events were flowing, which they aren't for server functions. Wiring server error capture is a prerequisite for trusting "no errors" as a real signal.

## 10. DURABLE DB-BACKED TRACKER (canonical backlog)

Per Vic's instruction, the backlog is persisted as a **tickable, editable database** in an **isolated `ops` schema** (the app's `public` tables are untouched).

| Artifact | Location |
|---|---|
| **DB table (canonical)** | Neon `ppw-marketplace` → schema `ops` → table **`designer_audit_tasks`** (36 rows: P0×3, P1×6, P2×7, Sentry×2, P3×4, working×14) |
| **Seeder (generator)** | `scripts/ops/seed-designer-audit-tracker.mjs` — idempotent upsert (`ON CONFLICT task_key`) + emits SQL/CSV. The `T` array is the master list. |
| **SQL mirror** | `scripts/ops/designer_audit_tracker.sql` |
| **CSV mirror** | `docs/designer-audit-tracker.csv` |
| **Brain mirror (readable)** | vault `06-Roadmap/sims-parity/master/DESIGNER-AUDIT-TRACKER-2026-06-03.md` |

**Schema:** `id, task_key (unique), area, gateway, title, description, status (todo/in_progress/blocked/done), priority (P0–P3/-), source (code/sentry/brain/usertest/live), code_refs, sentry_issue_id, notes, created_at, updated_at` (auto-touch trigger).

**Materialization note (2026-06-03):** the live DB rows were **not inserted this pass** — the host audit session had no Neon credentials. The Neon connection string is **integration-managed in Vercel** (injected at runtime as `DATABASE_URL`), is **empty in `vercel env pull`** across production/preview/development, and is absent from all local `.env`. No Neon MCP is connected. The seeder + SQL materialize the table in one command wherever creds exist:
```
DATABASE_URL=postgres://… node scripts/ops/seed-designer-audit-tracker.mjs
# or paste scripts/ops/designer_audit_tracker.sql into the Neon SQL editor
```
The schema is additive/isolated → zero risk to app tables. The build /goal ticks rows to `done` + adds new rows here as it ships, keeping nothing lost.

---
*Audit by Claude (Opus 4.8) host session, 2026-06-03→04. Vault copy: `06-Roadmap/sims-parity/master/DESIGNER-FUNCTIONALITY-AUDIT-2026-06-03.md`. Tracker mirror: `…/DESIGNER-AUDIT-TRACKER-2026-06-03.md`.*
