-- designer_audit_tasks_seed.sql
-- Source of truth mirror: Designer Functionality + Gateway Audit (2026-06-03)
-- Generated from docs/designer-audit-tracker.csv (36 rows: P0x3, P1x6, P2x7, Sentry x2, P3x4, working/done x14)
-- Target: Neon `ppw-marketplace`, schema `ops`. Additive + isolated; zero risk to app `public` tables.
-- Idempotent: re-runnable via ON CONFLICT (id) upsert.

CREATE TABLE IF NOT EXISTS designer_audit_tasks (
    id              TEXT PRIMARY KEY,
    area            TEXT,
    gateway         TEXT,
    title           TEXT,
    description     TEXT,
    status          TEXT,           -- todo | in_progress | blocked | done
    priority        TEXT,           -- P0 | P1 | P2 | P3 | -
    source          TEXT,           -- code | sentry | brain | usertest | live (and combos)
    code_refs       TEXT,
    sentry_issue_id TEXT,
    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO designer_audit_tasks
    (id, area, gateway, title, description, status, priority, source, code_refs, sentry_issue_id, notes)
VALUES
-- ===== P0 — broken in prod / blocks a core journey =====
('p0-capture-pdf-500','Merchant capture','merchants-router /api/capture/reference-page.pdf(+v2)','Fix capture reference PDF 500','Both reference-page.pdf and -v2.pdf return HTTP 500 FUNCTION_INVOCATION_FAILED in prod. Merchant cannot print calibration sheet -> whole phone-capture onboarding broken. Debug jsPDF/autotable serverless bundling/font/buffer issue.','todo','P0','live+code','api/merchants-router.ts; api/lib/capture/referencePage.ts','','Confirmed live 2026-06-03 curl. Not visible in Sentry (server errors uncaptured).'),
('p0-product-imagery','Customer catalog','products GET /api/products','Replace placeholder product images with real top-down imagery','All 19 live API products use placehold.co images and have null descriptions. Run top-down image pipeline (Fal.ai FLUX) for K1 SKUs, backfill imageUrl + descriptions.','todo','P0','live+code','src/data/apiCatalogAdapter.ts; scripts/backfill-topdown-images.ts; api/products.ts','','Catalog reads as unfinished to K1 + customers.'),
('p0-realdevice-clickthrough','Customer designer','RoomCanvas (Konva)','Real-device customer click-through (place->select->edit->cart->checkout)','Synthetic CDP cannot drive Konva/HTML5-DnD placement+selection. Re-select fix (c526471) + touch dup/delete unit-tested only. Verify on real iPhone + desktop.','todo','P0','usertest','src/components/RoomCanvas.tsx; src/components/__tests__/customer-ui-fixes-2026-05-31.test.ts','','Documented CDP limitation; needs human/real-device pass.'),

-- ===== P1 — finish core journey / remove dead weight =====
('p1-remove-3d','Engine','babylon/* + App.tsx toggle','Remove Babylon 3D viewer + KONVA/BABYLON toggle','Delete 15 babylon/* files + 3 e2e specs; edit App.tsx, GamingLayer1Surfaces.tsx, package.json (@babylonjs/core). Saves ~1.43MB gzip. Blast radius LOW (lazy import, one-way store reads). DB use_gltf column harmless to leave. WebXR capture SEPARATE - untouched.','todo','P1','brain+code','src/designer/babylon/*; src/App.tsx; src/designer/GamingLayer1Surfaces.tsx; package.json; tests/e2e/babylon-*.spec.ts','','Full plan: audit report section 7.'),
('p1-consolidate-carts','Customer','cartStore vs marketplaceCartStore','Consolidate the two cart systems','Designer cart (cartStore+CartDrawer+CartPage) and marketplace cart (marketplaceCartStore+Marketplace*Page) coexist with separate checkout pages. Pick one path, deprecate or document the split.','todo','P1','code','src/store/cartStore.ts; src/store/marketplaceCartStore.ts; src/pages/CartPage.tsx; src/pages/MarketplaceCartPage.tsx; src/pages/CheckoutPage.tsx; src/pages/MarketplaceCheckoutPage.tsx','',''),
('p1-payments-golive','Payments','create-checkout-session; paypal-router; stripe-webhook','Payment go-live readiness','Stripe + PayPal code complete. Gated on live gateway approval (MCB CNP / MIPS / Stripe). Add idempotency key to checkout-session; move Stripe webhook dedupe to KV. Vic quick-check before any live-money diff.','blocked','P1','code+brain','api/create-checkout-session.ts; api/paypal-router.ts; api/stripe-webhook.ts','','External dep: gateway approvals. HARD-STOP-adjacent per Vic Protocol.'),
('p1-stripe-connect-webhook','Merchant payouts','stripe-connect/webhook','Flesh out Stripe Connect payout webhook','account.updated -> merchant KYC status. Currently a thin stub. Needed before any merchant payout run.','todo','P1','code','api/stripe-connect/webhook.ts; api/lib/stripeConnect.ts; api/lib/stripeConnectWebhook.ts','','Gated by STRIPE_MU_SUPPORTED env.'),
('p1-capture-flow-finish','Merchant capture','capture/* FSM','Finish capture flow (side/back shots, error states, reconcile UX)','After p0-capture-pdf-500: complete 6-step FSM tail + reconcile-dimensions UX. XR arm stubbed.','blocked','P1','code','src/components/capture/CaptureModal.tsx; src/components/capture/ReviewSubmit.tsx; src/components/capture/DimensionForm.tsx','','Blocked by p0-capture-pdf-500.'),
('p1-repo-cleanup','Repo hygiene','-','Remove dead .PAYPAL-SLICE files + repo junk','Delete 3 zero-byte *.PAYPAL-SLICE files, nul, *.bundle, .audit-probe, test-*.tmp, dozens of vite.config.ts.timestamp-*.mjs, stray merchant-page.html / products-prod.json.','todo','P1','code','repo root; src/pages/CheckoutPage.tsx.PAYPAL-SLICE; src/store/checkoutStore.ts.PAYPAL-SLICE','',''),

-- ===== P2 — polish / trust =====
('p2-debug-clutter','Customer designer','RoomCanvas HUD','Remove prod debug clutter','On-canvas bbox text (20.00 m2 - 18.00 m - 100%) + "Week 2 - drag-drop, collision..." footer visible to customers in prod. Gate behind dev flag or delete.','todo','P2','live','src/components/RoomCanvas.tsx','','Observed live 2026-06-03.'),
('p2-hud-declutter','Customer designer','RoomCanvas top-right cluster','Declutter top-right HUD + mobile safe-area','Area/perimeter/zoom/snap/count badges overlap Share/Capture/cart cluster. Re-layout; add env(safe-area-inset-*).','todo','P2','usertest','src/components/RoomCanvas.tsx','','From 2026-05-31 user-testing report.'),
('p2-orderspage','Customer','/orders OrdersPage','Build out OrdersPage','Currently a basic stub. Real customer order history.','todo','P2','code','src/pages/OrdersPage.tsx; src/store/ordersStore.ts','',''),
('p2-stub-stores','Designer','floorZoneStore/wallTreatmentStore/WallSlab/WoodPlankFloor/DragLayer/ContextMenu','Wire or remove stub stores/components','No live UI consumer. Either wire (paint/floor feature) or delete to reduce dead surface.','todo','P2','code','src/store/floorZoneStore.ts; src/store/wallTreatmentStore.ts; src/designer/WallSlab.tsx; src/designer/WoodPlankFloor.tsx; src/designer/DragLayer.tsx; src/designer/ContextMenu.tsx','',''),
('p2-zoom-offlot','Customer designer','RoomCanvas interactions','Fix mouse-wheel zoom + off-lot move guard','Per 2026-05-31 report: wheel zoom no-op; off-lot move not blocked. Confirm on real device, fix if present.','todo','P2','usertest','src/components/RoomCanvas.tsx; src/lib/zoom.ts; src/lib/__tests__/offlot-drag.test.ts','',''),
('p2-stripe-dedupe-kv','Payments','stripe-webhook','Move Stripe webhook dedupe to KV','In-memory Set is single-lambda only. Move to Upstash for multi-instance idempotency.','todo','P2','code','api/stripe-webhook.ts; api/lib/webhookDedupe.ts','',''),
('p2-migration-gap','DB','Neon migrations','Document migration gap 0012-0023','Migrations jump 0011 -> 0024. Add a note so it does not read as missing.','todo','P2','code','api/db/migrations/','',''),

-- ===== Observability / Sentry findings =====
('sentry-server-errors-uncaptured','Observability','Sentry javascript-react project','Server-side errors not captured in Sentry','javascript-react project shows 0 events received in 30d and the live PDF 500 did not surface. @sentry/node likely not reporting serverless errors to a project. Wire server error capture so prod 500s are observable.','todo','P1','sentry','api/lib/sentry.ts; api/healthcheck.ts','','3 issue-alert rules exist (New issue ppw-designer-2d; high-priority; Email #ppwellness) but no events flowing.'),
('sentry-token-scope','Observability','Sentry API token','Upgrade Sentry token scope for error pull','Token (junk files/sntryu.txt) scopes = alerts:read, alerts:write, org:read, project:read. Lacks event:read/issue:read so issues cannot be pulled programmatically. Add a read-scoped token for audit automation.','todo','P2','sentry','junk files/sntryu.txt','','Org=ppwellness, project=javascript-react (id 4511381065171024).'),

-- ===== P3 — future / parked =====
('p3-webxr-capture','Merchant capture','XRCaptureStage','WebXR / AR capture (v3)','Stubbed. Keep parked until post-W14.','todo','P3','code','src/components/capture/XRCaptureStage.tsx; src/lib/capture/xrMeasure.ts','',''),
('p3-paint-flooring-ui','Customer','/api/calc/:type','Paint/flooring calculator customer UI','Calc API folded into merchants-router; customer UI partial. Pending product decision.','todo','P3','code','api/lib/calc/paintCalcHandler.ts; src/lib/paintCalculator.ts','',''),
('p3-neon-isolation','Infra','Neon DB','Neon prod/preview DB isolation','Single branch -> previews + Dependabot PRs touch prod data. Consider a preview branch before external merchant load.','todo','P3','brain','api/db/client.ts','','Per api-deploy-topology.md risk note.'),
('p3-agent-costcap','Merchant agent','agent-chat','Agent per-merchant cost-cap enforcement (Phase 6 pt2)','OpenRouter live; merchant auth + per-merchant cost cap not yet enforced.','todo','P3','code','api/agent-chat.ts; api/lib/agent/lockdown.ts; api/lib/agent/openrouter.ts','',''),

-- ===== Verified working this audit (status = done) — the rest of the map =====
('ok-healthcheck','Backend','healthcheck','Healthcheck endpoint','GET /api/healthcheck 200, commit 86125f9, cache-bust required (?cb=).','done','-','live','api/healthcheck.ts','','Edge-cached.'),
('ok-products-api','Backend','products','Products listing + CRUD + facets','Live 200; merchant CRUD + soft-delete + audit. Image gap tracked separately.','done','-','live+code','api/products.ts','',''),
('ok-cart-quote','Backend','cart-quote','Cart split quote','Live; per-merchant split.','done','-','live','api/cart-quote.ts; api/lib/cart/split.ts','',''),
('ok-orders-router','Backend','orders','Orders/designs/leads/magic-link/K1-redirect/cowork-os','1689-line catch-all; probed 200/404 correctly.','done','-','live+code','api/orders.ts','',''),
('ok-admin-router','Admin','admin-router','Admin console + auth gate','401 on unauth (Clerk gate works); list/detail/approve/reject/products/suppliers/stats/audit.','done','-','live+code','api/admin-router.ts; api/lib/admin/*; api/lib/adminAuth.ts','',''),
('ok-agent-chat','Merchant','agent-chat','Merchant AI agent','GET health 200, openrouterConfigured:true; Gemini->Sonnet fallback.','done','-','live','api/agent-chat.ts','',''),
('ok-cron','Backend','cron-router','Cron jobs','escalate-orders (9am), refresh-supplier-rating, email-reconcile; CRON_SECRET-gated.','done','-','code','api/cron-router.ts; api/lib/cron/*','',''),
('ok-merchant-auth','Merchant','merchantSession','Magic-link HMAC sign-in','30-day HMAC token; RequireMerchant guard.','done','-','code','api/lib/merchantSession.ts; src/components/RequireMerchant.tsx','',''),
('ok-designs-api','Customer','designs','Cloud save + My Designs','/api/designs 200; email-keyed autosave.','done','-','live+code','api/orders.ts; src/lib/designsApi.ts; src/lib/useAutoSave.ts','',''),
('ok-konva-core','Customer designer','RoomCanvas','Konva 2D render core','Mounts live, 0 console errors; placement FSM, snap, walls, undo/redo. Stable-lock 26c144c.','done','-','live+code','src/components/RoomCanvas.tsx; src/designer/*','','Render-verified 2026-06-03.'),
('ok-mobile-toolbar','Customer designer','mobile/*','Mobile Sims bottom toolbar','Tap/long-press place; --sims-toolbar-h offset.','done','-','code','src/components/mobile/SimsBottomToolbar.tsx','',''),
('ok-currency-fx','Customer','currencyStore/fx','Multi-currency + live FX','MUR/USD/EUR/GBP; FX bootstrap.','done','-','code','src/store/currencyStore.ts; src/lib/fx.ts','',''),
('ok-k1-attribution','Commercial','orders /api/k1/redirect','K1 Pattern C commission attribution','Outbound redirect -> designer_referrals; reconcile CSV.','done','-','code','api/orders.ts; src/components/DetailsPanel.tsx','',''),
('ok-build-tests','CI','build+vitest','Build + unit tests green','npm run build clean; 1353/1353 vitest pass (126 files).','done','-','code','package.json','','Verified 2026-06-03.')
ON CONFLICT (id) DO UPDATE SET
    area            = EXCLUDED.area,
    gateway         = EXCLUDED.gateway,
    title           = EXCLUDED.title,
    description     = EXCLUDED.description,
    status          = EXCLUDED.status,
    priority        = EXCLUDED.priority,
    source          = EXCLUDED.source,
    code_refs       = EXCLUDED.code_refs,
    sentry_issue_id = EXCLUDED.sentry_issue_id,
    notes           = EXCLUDED.notes,
    updated_at      = now();
