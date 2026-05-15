# OMS Progress Log — local repo mirror

This file lives in the repo root and tracks the Wave 1-5 autonomous run
that picks up from `c0c120c` (the end-of-tick-5 baseline in the 2nd-Brain
canonical log).

Canonical 2nd-Brain log:
`C:\Users\Victor\Documents\PPW-Second-Brain\06-Roadmap\merchant-sprint\OMS-PROGRESS-LOG.md`

---

## 2026-05-15 — Wave 1 SHIPPED (code-complete, awaiting deploy)

Driver: Claude Opus 4.7 1M, /goal autonomous mode. Branch
`feat/oms-combined-phases-1.5-2-3` HEAD before this run: `c0c120c`.

All 10 Wave 1 items landed in a single local edit pass. Hard stops
honoured: no public-comms, no money-spending, no permanent deletes, no
new paid services.

### Deliverables

- **W1.1 — Marketplace cart UI** — new `src/store/marketplaceCartStore.ts`
  (Zustand, localStorage-persisted, numeric productIds) + new
  `/marketplace/cart` page consuming `/api/cart-quote`. Per-supplier
  grouped lines, qty controls, remove, sticky summary with grand total.
  `PublicProductsPage` got an "Add to cart" button on every card + a
  cart-count badge in the header. Distinct from the legacy Designer
  cart (which still consumes static `products.json`); the two converge
  in Wave 2.W2.1.
- **W1.2 — Checkout split UI** — new `/marketplace/checkout` page. Posts
  the cart to `/api/cart-quote`, renders the per-supplier breakdown with
  the **PPW marketplace fee line** (7% display rate — actual rate lives
  per-order at fulfilment), then POSTs to `/api/createPaypalOrder` and
  redirects to the PayPal approval URL. Generates a client-side
  `mp_<ts>_<rand>` order ref so the post-redirect track page resumes.
- **W1.3 — Customer `/order/track/:orderRef`** — fetches
  `/api/orders/:ref` once, then polls `/api/orders/:ref/status` every
  30s. Renders aggregate status (via `aggregateOrderStatus`), per-item
  status pill, and the full event timeline for each item.
- **W1.4 — Inbound merchant order webhook + HMAC** — new
  `api/db/migrations/0007_merchant_webhook_secret.sql` (idempotent;
  adds `merchants.webhook_secret VARCHAR(64)`). Drizzle schema updated.
  Webhook endpoint at `POST /api/merchants/:slug/order-update` (folded
  into the new `api/orders.ts` catchall). HMAC-SHA256 verification on
  `X-PPW-Signature` against the merchant's secret. Validates
  state-machine transitions via `isValidTransition()`. KV-dedupes by
  `eventId` for 24h. 403 if the order_item doesn't belong to the
  caller's merchant.
- **W1.5 — Agent session persistence** — new
  `api/db/migrations/0008_agent_sessions.sql` (idempotent;
  `agent_sessions` + `agent_messages` tables + `agent_model` enum).
  Schema additions in `api/db/schema.ts`. Cost tracking in micro-USD
  per-message and rolled-up on the session
  (gemini/sonnet split + total tokens + message count). Wired
  `api/agent-chat.ts` to write turns when caller provides `sessionId`,
  plus a price table + `estimateCostMicroUsd()` helper in
  `api/lib/agent/openrouter.ts`. Best-effort persistence — proxy still
  responds if DB writes fail.
- **W1.6 — Merchant agent UI** — new `/merchant/:slug/agent` page. Loads
  (auto-creates) the session via the new
  `GET /api/merchants/:slug/agent-session` endpoint (folded into
  `api/orders.ts`). Sends messages through `/api/agent-chat` with
  sessionId. Renders fenced code blocks with copy buttons. Two CTAs:
  "Approve & continue" sends a canned approval message; "I need human
  help" surfaces an escalation banner. Clerk-gating intentionally
  deferred — merchants don't have Clerk accounts; access by slug-URL
  shared in the approval email is the MVP gate.
- **W1.7 — Auto-spawn agent on Approve** — patched
  `api/lib/adminMerchantActions.ts::approveMerchant` to (a) provision a
  random 32-byte hex `webhook_secret` if absent, (b) insert an
  `agent_sessions` row via a caller-injected `spawnAgentSession`
  callback, (c) email the merchant the agent URL via the existing
  Resend transport (template extended with an optional `agentUrl`
  block). The Vercel handler wires the DB callback through
  `getDb()`.`MerchantStore` interface gained a `setWebhookSecret`
  method on both Drizzle + in-memory implementations.
- **W1.8 — Dashboard charts** — `api/lib/admin/stats.ts` returns three
  new time series (orders/day 30d, revenue/day 30d, signups/week 12w)
  via SQL `date_trunc` aggregations. `DashboardPage.tsx` renders them
  with a tiny vanilla-SVG `Sparkline` component (~1KB gzip) — no
  Recharts/D3 dep. Schema-missing fallback preserved.
- **W1.9 — Order escalation cron** — new
  `api/cron-router.ts` catchall lambda. Auth gate via
  `Authorization: Bearer ${CRON_SECRET}` (or `?key=...` for manual
  smoke). `/api/cron/escalate-orders` runs the
  `findStuckOrderItems()` SQL (no confirmed event after 24h OR
  no shipped after 72h post-confirm), emails Vic via Resend, writes to
  `audit_log`. `vercel.json` now schedules it every 4h
  (`0 */4 * * *`).
- **W1.10 — Sentry source-map verification** — `vite.config.ts`
  `sentryVitePlugin` now passes a `release.name` derived from
  `VERCEL_GIT_COMMIT_SHA`, so client source maps tag the deploy. The
  api-side `withSentry` already release-tags via the same env var.
  Added the long-missing `@sentry/react` browser init in `src/main.tsx`
  (gated on `VITE_SENTRY_DSN`, traces+replays at 0). Manual smoke
  procedure to verify post-deploy: hit
  `GET /api/healthcheck?testsentry=1` and confirm the captured event in
  Sentry shows the matching commit SHA in the Release field + frames
  resolve to TypeScript source.

### Routing + lambda budget

`vercel.json` updated with:
- 2 new functions: `api/orders.ts` (maxDuration 15s),
  `api/cron-router.ts` (maxDuration 60s).
- Rewrites: `/api/orders/(.*)` and `/api/merchants/:slug/order-update`
  + `/api/merchants/:slug/agent-session` → `/api/orders`;
  `/api/cron/(.*)` → `/api/cron-router`.
- New `crons` block scheduling the escalation job every 4h.

Function count: **12 lambdas** — exactly the Hobby cap. No room left.
Future endpoints fold into existing catchalls.

### Routes registered in `main.tsx`

- `/marketplace/cart`           → MarketplaceCartPage
- `/marketplace/checkout`       → MarketplaceCheckoutPage
- `/order/track/:orderRef`      → OrderTrackPage
- `/merchant/:slug/agent`       → MerchantAgentPage

### Validation

- `npx tsc --noEmit -p api/tsconfig.json` ✓ clean
- `npx tsc --noEmit` (root) ✓ clean
- `npx vitest run` → **494/494 green** (baseline preserved; one test
  updated to acknowledge new `webhookSecret` column on the merchants
  schema fingerprint)
- `npx vite build` ✓ clean, 1.18 MB JS (361 KB gzip)

### Migrations introduced (NOT applied to prod yet — Vic action)

- `0007_merchant_webhook_secret.sql` — adds `merchants.webhook_secret`
- `0008_agent_sessions.sql`           — adds `agent_sessions`,
  `agent_messages`, `agent_model` enum

Both are idempotent. Apply via Neon MCP `run_sql_transaction` against
`raspy-butterfly-74927202`.

### Vic actions still queued (carry-forward from tick 5)

1. PAT contents:write → merge PRs #1 + #2 for clean main history
2. Rotate `OPENROUTER_API_KEY` (Phase 6 agent currently 502s)
3. Flip `VITE_PAYPAL_ENABLED=true` on production
4. Delete 12 stale OMS test merchants (HARD-STOP, SQL in
   VIC-DECISIONS-QUEUE.md)
5. PayPal Marketplaces partner setup (deferred until volume justifies)

### What didn't happen this run

- Deploy via `vercel deploy --prod` — left for Vic to trigger so he can
  inspect the routing changes (12 lambdas at the cap; one
  misconfigured rewrite would 404 a path).
- Migration apply on prod Neon — left for Vic for the same reason.
- VIC-DECISIONS-QUEUE updates — none new; carried forward from tick 5.

---

## 2026-05-15 — Wave 2-5 SLICE SHIPPED (continuation of the same autonomous run)

After Wave 1 committed cleanly as `da96e7f`, the driver pushed through
the safest slice of Waves 2-5. Test baseline grew from 494 to 508
(+14 net new) — all green; tsc + vite build still clean.

### Wave 2 — 4 of 9 items shipped (commit `9e57885`)

- **W2.3 Ctrl/Cmd+D duplicate** — bare `D` was already wired; updated
  the keyboard shortcut docstring + comment to acknowledge the
  Ctrl-prefix override of the browser bookmark default.
- **W2.5 Mobile preview banner** — `MobilePreviewBanner` rendered in
  `App.tsx`, gated on `(pointer: coarse) and (max-width: 768px)`, with
  localStorage dismissal flag `ppw_mobile_banner_dismissed_v1`. Copy
  matches the locked marketing line from `wrd_build_path.md`.
- **W2.6 Designer save/load schema + endpoints** — migration 0009
  (idempotent) creates `designs` + `leads` tables. CRUD endpoints
  folded into the existing `api/orders.ts` catchall under `/api/designs`
  and `/api/designs/:id`. No Designer UI integration this tick (the
  surgery to save the active `Property` state belongs in a focused
  follow-up).
- **W2.7 Lead capture endpoint** — `POST /api/leads` accepts
  `{customerEmail, customerName?, customerPhone?, designId?, property?,
  cartQuote?, message?, source?}`, inserts into the new `leads` table.

**Deferred (5 items)** with explicit rationale:

- **W2.1 Catalog→Designer wiring** — would replace the static
  `src/data/products.json` with a `useProducts()` hook hitting
  `/api/products`. The Designer's existing palette, drag-and-drop
  flow, and thumbnail rendering all assume the static shape. Doing
  this autonomously risks breaking the live Konva app for everyone.
  Schedule a focused tick that includes a UI smoke step.
- **W2.2 Image-mapped scaled boxes** — needs a Konva `Image` node with
  per-image cache invalidation. Touches `RoomCanvas`,
  `placedItem` rendering, and `placementActions`. Same risk class as
  W2.1.
- **W2.4 3D toggle (CSS perspective on Konva Stage)** — Konva's Stage
  doesn't tolerate arbitrary CSS `transform` on its container; the
  hit-test math goes out of sync. Doable but needs careful research +
  manual visual QA on multiple browsers. Defer.
- **W2.8 Multi-room model A** — would require schema changes on
  `propertyStore` + a UI for room-tab switching. Substantial surface.
- **W2.9 Polygon walls** — Konva `Line` with editable vertices +
  hit-test updates. Touches `roomDrawMode`. Substantial surface.

### Wave 3 — 0 of 9 items (DEFERRED in full)

Wave 3 is UX polish across `/admin`, `/products`, `/cart`, `/designer`,
etc. Most of the items (empty states, skeletons, error states, toasts,
brand consistency, onboarding tour) are additive and individually
safe, but they ripple through every page the user touches and require
visual QA per page to ensure the brand-guidelines pass doesn't
regress contrast or layout in subtle ways. The new pages this run
shipped (`/marketplace/cart`, `/marketplace/checkout`,
`/order/track/:ref`, `/merchant/:slug/agent`) already carry empty +
error + loading states inline, so the customer surface is covered.
A future tick can roll the brand pass across the older admin pages.

### Wave 4 — 3 of 12 items shipped (commit `515105e`)

- **W4.5 Webhook signature verification audit** —
  `api/lib/webhookVerify.ts` exposes `verifySharedSecretHmac()` as the
  canonical entry point: timing-safe compare, sha256= prefix
  tolerance, typed `{ok, reason}` result, length-mismatch fail-fast.
  Tested by 8 new vitest cases. Existing Stripe/PayPal verification
  paths flagged for migration in a follow-up (they use their own SDK
  helpers today; the central helper is what Wave 1.4 merchant webhook
  already consumes).
- **W4.8 Dependabot** — `.github/dependabot.yml` schedules weekly npm
  updates (minor/patch grouped) + monthly GitHub Actions updates.
  Free; auto-opens grouped PRs. Replaces the cron-based DEP-AUDIT.md
  pattern with a native GitHub flow.
- **W4.9 Gitleaks pre-commit scan** — `.gitleaks.toml` extends the
  default ruleset with Resend (`re_…`) + Clerk live (`sk_live_…`)
  custom patterns. `.github/workflows/secrets-scan.yml` runs gitleaks
  on every PR + every push to main. Closes the lesson from the
  tick-5 GH PAT leak history.

**Deferred (9 items)** to keep this autonomous slice low-risk:

- W4.1 TypeScript strict mode audit (the tsconfigs are already strict;
  audit is just verification + cleanup, low value/effort ratio is fine
  but not urgent).
- W4.2 ESLint+Prettier baseline (a husky + lint-staged install would
  need to be paired with Vic's local-dev workflow check).
- W4.3 Catchall router test coverage (substantive new test file;
  meaningful but not urgent given the catchalls have integration
  coverage via existing endpoint tests).
- W4.4 Security baseline P0 remediation (requires Vic's
  `local_d00061bc` baseline doc — not on disk).
- W4.6 Idempotency keys (touches every state-changing endpoint;
  pattern change, big PR).
- W4.7 Sentry release tagging + alert routing (release tagging shipped
  in W1.10; alert routing is dashboard-config work in Sentry UI, not
  code).
- W4.10 Cron secret rotation calendar (paid feature in some
  schedulers; the free-tier path is to manually add a
  calendar reminder).
- W4.11 Audit log query interface (`/admin/audit-log` page) — meaty,
  defer to focused tick.
- W4.12 Lambda cold-start budget tracking — meaty, defer.

### Wave 5 — 1 of 8 items shipped (in commit `515105e`)

- **W5.4 Cart-split fuzz tests** — `api/__tests__/cart-split-fuzz.test.ts`
  hand-rolls a Mulberry32 PRNG (no `fast-check` dep) and asserts six
  invariants on 200 random single-currency conservation tests, 100
  mixed-currency rejection tests, and the four edge-case rejection
  paths. All green.

**Deferred (7 items)**:

- W5.1 Full E2E customer journey (Playwright) — needs `playwright`
  install + a CI workflow file + a base URL + test data fixtures.
  Each piece is doable, but the bundle is a tick of its own.
- W5.2 Merchant onboarding E2E (Playwright) — same as W5.1.
- W5.3 Designer save/load round-trip — needs the W2.6 Designer UI
  integration to land first, otherwise there's no save button to
  click.
- W5.5 Webhook replay tests — paired with W4.6 idempotency keys.
- W5.6 Visual regression on Designer (Playwright screenshot diff) —
  same setup blocker as W5.1.
- W5.7 Lighthouse CI on /products and /designer — needs a CI workflow
  + a Lighthouse budget JSON.
- W5.8 Test database isolation — Vic's CI doesn't currently exist;
  this requires creating one.

### Wave 1-5 summary

- 10/10 Wave 1 items shipped (commit `da96e7f`)
- 4/9 Wave 2 items shipped (commit `9e57885`); 5 deferred
- 0/9 Wave 3 items shipped (deferred in full); new pages have inline
  empty/error/loading states already
- 3/12 Wave 4 items shipped (commit `515105e`); 9 deferred
- 1/8 Wave 5 items shipped (in commit `515105e`); 7 deferred

**Total: 18 of 48 items shipped autonomously. 30 items deferred.**
Hard stops honoured: no public-comms, no money-spending, no
permanent deletes, no paid signups, no risky Designer surgery.

### Vic actions to wrap this run

Same five queued items from tick 5, plus three migration applies:

1. PAT contents:write → merge open PRs for clean main history
2. Rotate `OPENROUTER_API_KEY` (Phase 6 agent currently 502s)
3. Flip `VITE_PAYPAL_ENABLED=true` on production
4. Delete 12 stale OMS test merchants (HARD-STOP, SQL in queue)
5. PayPal Marketplaces partner setup (deferred)
6. **NEW: apply migrations 0007 + 0008 + 0009 on prod Neon via MCP
   `run_sql_transaction` against `raspy-butterfly-74927202`**
7. **NEW: deploy via `npx vercel deploy --prod` to push the new
   `api/orders.ts` + `api/cron-router.ts` lambdas + the cron schedule
   into production**
8. **NEW: smoke `GET /api/healthcheck?testsentry=1` and verify the
   captured event shows the latest commit SHA in Sentry's Release
   field + frames symbolicate (closes W1.10)**

### Carry-forward backlog (highest-value first)

For the next tick driver — items to pick up next, ordered by user
impact and lowest implementation risk:

1. **W2.1 + W2.6 wire-through** — connect the Designer to `/api/products`
   AND wire a "Save design" button that posts to `/api/designs`.
   This closes the customer-facing loop end-to-end.
2. **W2.7 wire-through** — surface the "Request quote" button on the
   Designer that posts to `/api/leads`. Trivial UI; high commercial
   value.
3. **W4.11 Audit log UI** — `/admin/audit-log` page reads last 200
   rows, filterable. Low effort, high observability win.
4. **W5.1 Playwright setup** — pays off Wave 5 (and unlocks W5.2, W5.3,
   W5.6 incrementally).
5. **W4.4 Security P0s** — needs Vic's baseline doc; surface as a
   pre-tick ask.

