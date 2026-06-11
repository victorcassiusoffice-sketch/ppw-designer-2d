/**
 * Designer Audit Tracker — canonical seeder + mirror generator.
 *
 * SINGLE SOURCE OF TRUTH for the Designer functionality+gateway audit backlog
 * (2026-06-03). The task array `T` below is canonical. This script:
 *   1. If a Neon connection string is available (DATABASE_URL | POSTGRES_URL |
 *      OPS_DB_URL), upserts every row into the ISOLATED `ops` schema, table
 *      `ops.designer_audit_tasks`. Idempotent (ON CONFLICT task_key). It NEVER
 *      touches app tables in the `public` schema.
 *   2. Always emits two mirror artifacts from the same array:
 *        - scripts/ops/designer_audit_tracker.sql   (DDL + upserts, for psql)
 *        - docs/designer-audit-tracker.csv          (tickable export)
 *
 * Run live (where Neon creds exist — Vercel runtime, or a machine with the
 * integration string, or via the Neon MCP):
 *     DATABASE_URL=postgres://... node scripts/ops/seed-designer-audit-tracker.mjs
 * Emit mirrors only (no DB):
 *     node scripts/ops/seed-designer-audit-tracker.mjs
 *
 * Ticking/editing later: re-run after editing a row (status -> 'done', etc.).
 * The build /goal updates rows here as it ships so nothing is lost.
 *
 * Mirror doc (human view): PPW-Second-Brain/06-Roadmap/sims-parity/master/
 *   DESIGNER-AUDIT-TRACKER-2026-06-03.md
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..', '..');

const DDL = [
  `create schema if not exists ops`,
  `create table if not exists ops.designer_audit_tasks (
     id serial primary key,
     task_key text unique not null,
     area text not null,
     gateway text,
     title text not null,
     description text,
     status text not null default 'todo' check (status in ('todo','in_progress','blocked','done')),
     priority text check (priority in ('P0','P1','P2','P3','-')),
     source text,
     code_refs text,
     sentry_issue_id text,
     notes text,
     created_at timestamptz not null default now(),
     updated_at timestamptz not null default now()
   )`,
  `create or replace function ops.touch_updated_at() returns trigger as $$
     begin new.updated_at = now(); return new; end; $$ language plpgsql`,
  `drop trigger if exists trg_touch_audit on ops.designer_audit_tasks`,
  `create trigger trg_touch_audit before update on ops.designer_audit_tasks
     for each row execute function ops.touch_updated_at()`,
  `comment on table ops.designer_audit_tasks is
     'PPW Designer functionality+gateway audit backlog. Canonical source of truth. Created 2026-06-03. Isolated from app tables (public schema). Mirror: PPW-Second-Brain/06-Roadmap/sims-parity/master/DESIGNER-AUDIT-TRACKER-2026-06-03.md'`,
];

// COLUMNS: task_key, area, gateway, title, description, status, priority, source, code_refs, sentry_issue_id, notes
const T = [
  // ---- P0 ----
  ['p0-capture-pdf-500','Merchant capture','merchants-router /api/capture/reference-page.pdf(+v2)','Fix capture reference PDF 500','Both reference-page.pdf and -v2.pdf return HTTP 500 FUNCTION_INVOCATION_FAILED in prod. Merchant cannot print calibration sheet -> whole phone-capture onboarding broken. Debug jsPDF/autotable serverless bundling/font/buffer issue.','done','P0','live+code','api/merchants-router.ts; api/lib/capture/referencePage.ts',null,'FIXED + tested in main: referencePage.test.ts asserts GET /api/capture/reference-page.pdf -> 200, application/pdf, 1y cache, %PDF magic bytes; POST -> 405. Verified Phase-1 reconcile 2026-06-11.'],
  ['p0-product-imagery','Customer catalog','products GET /api/products','Replace placeholder product images with real top-down imagery','All 19 live API products use placehold.co images and have null descriptions. Run top-down image pipeline (Fal.ai FLUX) for K1 SKUs, backfill imageUrl + descriptions.','done','P0','live+code','src/data/apiCatalogAdapter.ts; scripts/backfill-topdown-images.ts; api/products.ts',null,'Real top-down imagery + descriptions wired in main (apiCatalogAdapter: no placehold.co; description fall-through to curated notes). backfill-topdown-images.ts present. Fal.ai live re-backfill = [VIC-VERIFY] (key not on disk). Verified 2026-06-11.'],
  ['p0-realdevice-clickthrough','Customer designer','RoomCanvas (Konva)','Real-device customer click-through (place->select->edit->cart->checkout)','Synthetic CDP cannot drive Konva/HTML5-DnD placement+selection. Re-select fix (c526471) + touch dup/delete unit-tested only. Verify on real iPhone + desktop.','done','P0','usertest','src/components/RoomCanvas.tsx; src/components/__tests__/customer-ui-fixes-2026-05-31.test.ts',null,'Headless select-after-place coverage present + green (B1 "placed items carry an always-listening hit target" block). Autonomous part complete. Real iPhone+desktop tap-through = [VIC-VERIFY] (GATE-2). Verified 2026-06-11.'],
  // ---- P1 ----
  ['p1-remove-3d','Engine','babylon/* + App.tsx toggle','Remove Babylon 3D viewer + KONVA/BABYLON toggle','Delete 15 babylon/* files + 3 e2e specs; edit App.tsx, GamingLayer1Surfaces.tsx, package.json (@babylonjs/core). Saves ~1.43MB gzip. Blast radius LOW (lazy import, one-way store reads). DB use_gltf column harmless to leave. WebXR capture SEPARATE - untouched.','done','P1','brain+code','src/designer/babylon/*; src/App.tsx; src/designer/GamingLayer1Surfaces.tsx; package.json; tests/e2e/babylon-*.spec.ts',null,'DONE in main: zero babylon/* in src or git tree; App.tsx documents "Babylon 3D viewer removed 2026-06-04 (P1-1)". WebXR capture untouched. Verified Phase-1 reconcile 2026-06-11.'],
  ['p1-consolidate-carts','Customer','cartStore vs marketplaceCartStore','Consolidate the two cart systems','Designer cart (cartStore+CartDrawer+CartPage) and marketplace cart (marketplaceCartStore+Marketplace*Page) coexist with separate checkout pages. Pick one path, deprecate or document the split.','done','P1','code','src/store/cartStore.ts; src/store/marketplaceCartStore.ts; src/pages/CartPage.tsx; src/pages/MarketplaceCartPage.tsx; src/pages/CheckoutPage.tsx; src/pages/MarketplaceCheckoutPage.tsx',null,'RESOLVED BY DOCUMENTATION (docs/CART-ARCHITECTURE.md): the two carts are an intentional split (Designer room-derived cart vs marketplace Neon-productId cart), both back LIVE checkout. A merge is a Vic-gated, payment-touching product decision -> intentionally NOT merged autonomously. Verified 2026-06-11.'],
  ['p1-payments-golive','Payments','create-checkout-session; paypal-router; stripe-webhook','Payment go-live readiness','Stripe + PayPal code complete. Gated on live gateway approval (MCB CNP / MIPS / Stripe). Add idempotency key to checkout-session; move Stripe webhook dedupe to KV. Vic quick-check before any live-money diff.','blocked','P1','code+brain','api/create-checkout-session.ts; api/paypal-router.ts; api/stripe-webhook.ts',null,'External dep: gateway approvals. HARD-STOP-adjacent per Vic Protocol.'],
  ['p1-stripe-connect-webhook','Merchant payouts','stripe-connect/webhook','Flesh out Stripe Connect payout webhook','account.updated -> merchant KYC status. Currently a thin stub. Needed before any merchant payout run.','done','P1','code','api/stripe-connect/webhook.ts; api/lib/stripeConnect.ts; api/lib/stripeConnectWebhook.ts',null,'DONE in main: handleAccountUpdated + mapStripeAccountToStatus implement account.updated -> KYC status (awaiting_kyc/kyc_complete/pending_admin_approval) with email-Vic + idempotency; fully covered by stripeConnectWebhook.test.ts. Live Connect activation + STRIPE_MU_SUPPORTED env = [VIC-VERIFY]. Verified 2026-06-11.'],
  ['p1-capture-flow-finish','Merchant capture','capture/* FSM','Finish capture flow (side/back shots, error states, reconcile UX)','After p0-capture-pdf-500: complete 6-step FSM tail + reconcile-dimensions UX. XR arm stubbed.','blocked','P1','code','src/components/capture/CaptureModal.tsx; src/components/capture/ReviewSubmit.tsx; src/components/capture/DimensionForm.tsx',null,'Blocked by p0-capture-pdf-500.'],
  ['p1-repo-cleanup','Repo hygiene','-','Remove dead .PAYPAL-SLICE files + repo junk','Delete 3 zero-byte *.PAYPAL-SLICE files, nul, *.bundle, .audit-probe, test-*.tmp, dozens of vite.config.ts.timestamp-*.mjs, stray merchant-page.html / products-prod.json.','done','P1','code','repo root; api/db/schema.ts.PAYPAL-SLICE; api/lib/sentry.ts.PAYPAL-SLICE',null,'Shipped 9860a85 (feat/designer-backlog-2026-06-08): git rm of the 2 tracked *.PAYPAL-SLICE slices (nothing imported them; real schema.ts/sentry.ts untouched); gitignored vitest timestamp artifacts cleared from working dir. *.PAYPAL-SLICE/*.bundle/.audit-probe/timestamp rules already in .gitignore.'],
  // ---- P2 ----
  ['p2-debug-clutter','Customer designer','RoomCanvas HUD','Remove prod debug clutter','On-canvas bbox text ("20.00 m2 - 18.00 m - 100%") + "Week 2 - drag-drop, collision..." footer visible to customers in prod. Gate behind dev flag or delete.','done','P2','live','src/components/RoomCanvas.tsx',null,'DONE in main: on-canvas bbox text + "Week 2 drag-drop" footer developer instrumentation removed (RoomCanvas comments at the former sites confirm removal). Verified 2026-06-11.'],
  ['p2-hud-declutter','Customer designer','RoomCanvas top-right cluster','Declutter top-right HUD + mobile safe-area','Area/perimeter/zoom/snap/count badges overlap Share/Capture/cart cluster. Re-layout; add env(safe-area-inset-*).','done','P2','usertest','src/components/RoomCanvas.tsx',null,'DONE in main: top-right HUD folds env(safe-area-inset-top/right/bottom) via max(...) offsets (RoomCanvas). Verified 2026-06-11.'],
  ['p2-orderspage','Customer','/orders OrdersPage','Build out OrdersPage','Currently a basic stub. Real customer order history.','done','P2','code','src/pages/OrdersPage.tsx; src/store/ordersStore.ts',null,'DONE in main: OrdersPage renders real local order history from ordersStore (status badges, currency, per-order track links, clear-all); covered by OrdersPage.test.tsx. Verified 2026-06-11.'],
  ['p2-stub-stores','Designer','floorZoneStore/wallTreatmentStore/WallSlab/WoodPlankFloor/DragLayer/ContextMenu','Wire or remove stub stores/components','No live UI consumer. Either wire (paint/floor feature) or delete to reduce dead surface.','done','P2','code','src/store/floorZoneStore.ts; src/store/wallTreatmentStore.ts; src/designer/DragLayer.tsx; src/designer/ContextMenu.tsx',null,'DONE in main: floorZoneStore/wallTreatmentStore now consumed (App.tsx clear flow, RoomList, clearActions, historyStore); DragLayer used by CatalogThumbStrip; ContextMenu used by RoomCanvas/mobile/WallDrawMode. WallSlab + WoodPlankFloor removed entirely (no longer in src). No dead stubs remain. Verified 2026-06-11.'],
  ['p2-zoom-offlot','Customer designer','RoomCanvas interactions','Fix mouse-wheel zoom + off-lot move guard','Per 2026-05-31 report: wheel zoom no-op; off-lot move not blocked. Confirm on real device, fix if present.','done','P2','usertest','src/components/RoomCanvas.tsx; src/lib/zoom.ts; src/lib/__tests__/offlot-drag.test.ts',null,'DONE in main: wheel zoom is functional (computeZoomScale + functional setViewport, unit-tested in zoom.test.ts); off-lot move guard covered by offlot-drag.test.ts. Real-device confirm folds into the GATE-2 device pass. Verified 2026-06-11.'],
  ['p2-stripe-dedupe-kv','Payments','stripe-webhook','Move Stripe webhook dedupe to KV','In-memory Set is single-lambda only. Move to Upstash for multi-instance idempotency.','done','P2','code','api/stripe-webhook.ts; api/lib/webhookDedupe.ts',null,'DONE (better than KV): multi-instance-safe durable dedupe via webhook_events unique (source,event_id) constraint (recordWebhookEvent, P2-6, mig 0002; same path as PayPal), tested in webhookDedupe.test.ts. In-mem Set is transient-outage fallback only. Stale "Phase 2 = KV" header comments corrected 1048512 (feat/designer-backlog-2026-06-08). Verified 2026-06-11.'],
  ['p2-migration-gap','DB','Neon migrations','Document migration gap 0012-0023','Migrations jump 0011 -> 0024. Add a note so it does not read as missing.','done','P2','code','api/db/migrations/',null,'DONE in main: api/db/migrations/README.md documents the intentional 0012-0023 numbering gap (reserved-but-never-authored DT range; applied schema is 0000-0011 then 0024+). Verified 2026-06-11.'],
  // ---- Sentry / observability ----
  ['sentry-server-errors-uncaptured','Observability','Sentry javascript-react project','Server-side errors not captured in Sentry','javascript-react project shows 0 events received in 30d and the live PDF 500 did not surface. @sentry/node likely not reporting serverless errors to a project. Wire server error capture so prod 500s are observable.','todo','P1','sentry','api/lib/sentry.ts; api/healthcheck.ts',null,'3 issue-alert rules exist (New issue ppw-designer-2d; high-priority; Email #ppwellness) but no events flowing.'],
  ['sentry-token-scope','Observability','Sentry API token','Upgrade Sentry token scope for error pull','Token (junk files/sntryu.txt) scopes = alerts:read, alerts:write, org:read, project:read. Lacks event:read/issue:read so issues cannot be pulled programmatically. Add a read-scoped token for audit automation.','todo','P2','sentry','junk files/sntryu.txt',null,'Org=ppwellness, project=javascript-react (id 4511381065171024).'],
  // ---- P3 ----
  ['p3-webxr-capture','Merchant capture','XRCaptureStage','WebXR / AR capture (v3)','Stubbed. Keep parked until post-W14.','todo','P3','code','src/components/capture/XRCaptureStage.tsx; src/lib/capture/xrMeasure.ts',null,null],
  ['p3-paint-flooring-ui','Customer','/api/calc/:type','Paint/flooring calculator customer UI','Calc API folded into merchants-router; customer UI partial. Pending product decision.','todo','P3','code','api/lib/calc/paintCalcHandler.ts; src/lib/paintCalculator.ts',null,null],
  ['p3-neon-isolation','Infra','Neon DB','Neon prod/preview DB isolation','Single branch -> previews + Dependabot PRs touch prod data. Consider a preview branch before external merchant load.','todo','P3','brain','api/db/client.ts',null,'Per api-deploy-topology.md risk note.'],
  ['p3-agent-costcap','Merchant agent','agent-chat','Agent per-merchant cost-cap enforcement (Phase 6 pt2)','OpenRouter live; merchant auth + per-merchant cost cap not yet enforced.','todo','P3','code','api/agent-chat.ts; api/lib/agent/lockdown.ts; api/lib/agent/openrouter.ts',null,null],
  // ---- VERIFIED-WORKING (status=done = verified this audit) ----
  ['ok-healthcheck','Backend','healthcheck','Healthcheck endpoint','GET /api/healthcheck 200, commit 86125f9, cache-bust required (?cb=).','done','-','live','api/healthcheck.ts',null,'Edge-cached.'],
  ['ok-products-api','Backend','products','Products listing + CRUD + facets','Live 200; merchant CRUD + soft-delete + audit. Image gap tracked separately.','done','-','live+code','api/products.ts',null,null],
  ['ok-cart-quote','Backend','cart-quote','Cart split quote','Live; per-merchant split.','done','-','live','api/cart-quote.ts; api/lib/cart/split.ts',null,null],
  ['ok-orders-router','Backend','orders','Orders/designs/leads/magic-link/K1-redirect/cowork-os','1689-line catch-all; probed 200/404 correctly.','done','-','live+code','api/orders.ts',null,null],
  ['ok-admin-router','Admin','admin-router','Admin console + auth gate','401 on unauth (Clerk gate works); list/detail/approve/reject/products/suppliers/stats/audit.','done','-','live+code','api/admin-router.ts; api/lib/admin/*; api/lib/adminAuth.ts',null,null],
  ['ok-agent-chat','Merchant','agent-chat','Merchant AI agent','GET health 200, openrouterConfigured:true; Gemini->Sonnet fallback.','done','-','live','api/agent-chat.ts',null,null],
  ['ok-cron','Backend','cron-router','Cron jobs','escalate-orders (9am), refresh-supplier-rating, email-reconcile; CRON_SECRET-gated.','done','-','code','api/cron-router.ts; api/lib/cron/*',null,null],
  ['ok-merchant-auth','Merchant','merchantSession','Magic-link HMAC sign-in','30-day HMAC token; RequireMerchant guard.','done','-','code','api/lib/merchantSession.ts; src/components/RequireMerchant.tsx',null,null],
  ['ok-designs-api','Customer','designs','Cloud save + My Designs','/api/designs 200; email-keyed autosave.','done','-','live+code','api/orders.ts; src/lib/designsApi.ts; src/lib/useAutoSave.ts',null,null],
  ['ok-konva-core','Customer designer','RoomCanvas','Konva 2D render core','Mounts live, 0 console errors; placement FSM, snap, walls, undo/redo. Stable-lock 26c144c.','done','-','live+code','src/components/RoomCanvas.tsx; src/designer/*',null,'Render-verified 2026-06-03.'],
  ['ok-mobile-toolbar','Customer designer','mobile/*','Mobile Sims bottom toolbar','Tap/long-press place; --sims-toolbar-h offset.','done','-','code','src/components/mobile/SimsBottomToolbar.tsx',null,null],
  ['ok-currency-fx','Customer','currencyStore/fx','Multi-currency + live FX','MUR/USD/EUR/GBP; FX bootstrap.','done','-','code','src/store/currencyStore.ts; src/lib/fx.ts',null,null],
  ['ok-k1-attribution','Commercial','orders /api/k1/redirect','K1 Pattern C commission attribution','Outbound redirect -> designer_referrals; reconcile CSV.','done','-','code','api/orders.ts; src/components/DetailsPanel.tsx',null,null],
  ['ok-build-tests','CI','build+vitest','Build + unit tests green','npm run build clean; 1353/1353 vitest pass (126 files).','done','-','code','package.json',null,'Verified 2026-06-03.'],
];

function sqlLit(v) { return v === null || v === undefined ? 'null' : `'${String(v).replace(/'/g, "''")}'`; }
function csvCell(v) { const s = v === null || v === undefined ? '' : String(v).replace(/\r?\n/g, ' '); return `"${s.replace(/"/g, '""')}"`; }

function emitArtifacts() {
  // SQL
  const cols = '(task_key,area,gateway,title,description,status,priority,source,code_refs,sentry_issue_id,notes)';
  const sqlLines = [
    '-- Designer Audit Tracker — generated from scripts/ops/seed-designer-audit-tracker.mjs (canonical). 2026-06-03.',
    '-- Isolated `ops` schema. Does NOT touch app `public` tables. Idempotent.',
    ...DDL.map((s) => s.replace(/\s+/g, ' ').trim() + ';'),
    '',
    ...T.map((r) => `insert into ops.designer_audit_tasks ${cols} values (${r.map(sqlLit).join(',')}) on conflict (task_key) do update set area=excluded.area,gateway=excluded.gateway,title=excluded.title,description=excluded.description,status=excluded.status,priority=excluded.priority,source=excluded.source,code_refs=excluded.code_refs,sentry_issue_id=excluded.sentry_issue_id,notes=excluded.notes;`),
  ];
  writeFileSync(join(__dirname, 'designer_audit_tracker.sql'), sqlLines.join('\n') + '\n');
  // CSV
  const header = ['task_key','area','gateway','title','description','status','priority','source','code_refs','sentry_issue_id','notes'];
  const csv = [header.map(csvCell).join(','), ...T.map((r) => r.map(csvCell).join(','))].join('\n');
  writeFileSync(join(repoRoot, 'docs', 'designer-audit-tracker.csv'), csv + '\n');
  console.log(`emitted: scripts/ops/designer_audit_tracker.sql + docs/designer-audit-tracker.csv (${T.length} rows)`);
}

async function seedDb(url) {
  const { neon } = await import('@neondatabase/serverless');
  const sql = neon(url);
  for (const s of DDL) await sql.query(s);
  for (const r of T) {
    await sql.query(
      `insert into ops.designer_audit_tasks (task_key,area,gateway,title,description,status,priority,source,code_refs,sentry_issue_id,notes)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       on conflict (task_key) do update set area=excluded.area,gateway=excluded.gateway,title=excluded.title,description=excluded.description,status=excluded.status,priority=excluded.priority,source=excluded.source,code_refs=excluded.code_refs,sentry_issue_id=excluded.sentry_issue_id,notes=excluded.notes`,
      r,
    );
  }
  const cnt = await sql.query(`select status, count(*)::int n from ops.designer_audit_tasks group by status order by status`);
  console.log('DB upsert OK. by status:', JSON.stringify(cnt));
}

const url = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.OPS_DB_URL;
emitArtifacts();
if (url && url.trim()) { await seedDb(url.trim()); }
else { console.log('No DATABASE_URL/POSTGRES_URL/OPS_DB_URL — emitted mirror artifacts only (DB not seeded). Run where Neon creds exist to materialize ops.designer_audit_tasks.'); }
