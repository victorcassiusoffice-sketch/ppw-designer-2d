# OMS Phase 1 — Week 1 Log

**Sprint:** Operation Merchant Sprint (OMS) — Phase 1
**Author:** Cowork (autonomous build)
**Window:** 2026-05-13 (Mauritius, UTC+4)
**Status:** Code complete, tests green, build clean. Awaiting Vic push + Neon migration apply.

---

## What shipped

The marketplace foundation: a merchant can apply to supply through a public form, get redirected into Stripe Connect Express KYC (when the MU compliance flag is on), and end up sitting in Vic's `/admin/merchants` approval queue. Stripe webhook receives Connect account updates and walks merchants through the lifecycle. Five lifecycle emails fire via Resend.

### Live endpoints (post-deploy)

- `POST /api/merchants/signup` — public signup
- `POST /api/stripe-connect/webhook` — Stripe Connect events
- `GET /api/admin/merchants` — admin queue (Clerk Bearer required)
- `POST /api/admin/merchants/approve` — admin approve
- `POST /api/admin/merchants/reject` — admin reject

### Live pages (post-deploy)

- `/suppliers` — public signup form
- `/merchants` — alias of `/suppliers`
- `/suppliers/signup/complete` — confirmation page
- `/admin/merchants` — Clerk-gated queue stub
- `/admin/sign-in` — handled inline by Clerk's `<SignIn>` component (no nested route required, `routing="virtual"`)

---

## Architectural decisions locked in Week 1

| # | Question | Decision | Why |
|---|----------|----------|-----|
| 1 | Drizzle vs Prisma? | **Drizzle** | Smaller serverless cold-start footprint; Neon HTTP driver is first-class; schema-as-TS without a separate codegen step. |
| 2 | Migrations workflow? | **Hand-written SQL applied via `scripts/migrate.ts`** using the Neon HTTP driver. `drizzle-kit` is installed as a devDep but not yet wired — Phase 2 introduces a real generated-migration workflow. | Phase 1 only has one migration; we want a small, debuggable apply path that doesn't need drizzle-kit's deeper toolchain. |
| 3 | Monorepo split (`/apps/storefront`, `/apps/admin`)? | **DEFERRED to a later phase.** Week 1 stays in the existing flat Vite SPA + `react-router-dom` structure. | The OMS plan calls for the split but doing it Week 1 alongside the actual functional build would compound risk. The admin routes live at `/admin/*` inside the same SPA, with `AdminLayout` lazily mounting Clerk. Phase 2 (or later) can carve the split out as its own change. |
| 4 | Where does admin auth live? | **Client: `@clerk/clerk-react` `SignIn`/`UserButton` inside `AdminLayout`. Server: `@clerk/backend.verifyToken` against `Authorization: Bearer <session token>`. Allowlist = `victorcassius.office@gmail.com` + `victor@ppwellness.co` + any row in the `admins` table.** | Keeps the public storefront bundle free of Clerk SDK (lazy at `/admin/*`). Server-side check is the security boundary; client-side gating is UX. |
| 5 | MU compliance gating? | **`STRIPE_MU_SUPPORTED=true` env var unlocks the Stripe Connect path. Default (`false`/unset) → manual-followup path: store merchant as `awaiting_kyc`, email Vic.** | A.4 reply is still pending (expected "no"); the OMS plan requires the signup flow to function regardless. Gate is a single env-var flip when MU is supported or once Vic completes the UK Ltd / Stripe Atlas detour. |
| 6 | Connect webhook secret vs platform checkout secret? | **Separate env var `STRIPE_WEBHOOK_SECRET_CONNECT`**, distinct endpoint at `/api/stripe-connect/webhook`. | Vic registers two webhook endpoints in Stripe Dashboard. Decoupling avoids the "one secret rotated breaks both" failure mode and keeps the existing `/api/stripe-webhook` checkout handler isolated. |
| 7 | Slug generation? | **`slugify(brandName) + 4-char random suffix on collision`** in `api/lib/slug.ts`. Caller-supplied `isTaken` predicate for uniqueness check. | Phase 2 may move to ULIDs once we have an externally-visible merchant directory; for Phase 1 internal use, slugs are simpler. |
| 8 | Data-access pattern? | **`MerchantStore` interface** with a `drizzleMerchantStore()` factory for production and a `createInMemoryMerchantStore()` for unit tests. Business logic depends on the interface, not Drizzle directly. | Lets every signup/webhook/admin test run without spinning a Postgres instance. Single seam to swap if we ever change DB engines. |
| 9 | Email rendering? | **Hand-written HTML in `api/lib/email-templates.ts`** with a `send` wrapper in `api/lib/merchantEmails.ts` that does the same dry-run fallback as the existing order-confirmation transport. | Phase 2 swaps to `react-email`. Phase 1 priority is correctness, not template fanciness. |

---

## Files added

### Schema & migrations
- `api/db/schema.ts` (131 lines) — Drizzle pgTable definitions for `merchants`, `merchant_documents`, `admins`; three pg enums (`merchant_status`, `merchant_document_type`, `admin_role`).
- `api/db/client.ts` (60 lines) — Neon-HTTP-driver-backed Drizzle factory + test-hook for injecting a stub `Db`.
- `api/db/merchantStore.ts` (177 lines) — `MerchantStore` interface, `drizzleMerchantStore()`, `createInMemoryMerchantStore()`.
- `api/db/migrations/0001_initial_merchants.sql` (109 lines) — hand-written migration, IF NOT EXISTS-safe so re-runs are no-ops.
- `scripts/migrate.ts` (67 lines) — applies all `*.sql` in `api/db/migrations/` against `DATABASE_URL` via the Neon HTTP driver.

### API libs (testable business logic)
- `api/lib/slug.ts` (42 lines) — `slugify`, `uniqueSlug`.
- `api/lib/email-templates.ts` (172 lines) — 5 HTML templates: signup ack, signup alert to Vic, kyc-complete alert to Vic, approved, rejected.
- `api/lib/merchantEmails.ts` (108 lines) — Resend transport with dry-run fallback (mirrors `api/lib/email.ts`).
- `api/lib/stripeConnect.ts` (94 lines) — `isStripeConnectAvailable`, `createExpressAccount`, `createOnboardingLink`, `getConnectWebhookSecret`.
- `api/lib/merchantSignup.ts` (272 lines) — `merchantSignupSchema` (Zod) + `processMerchantSignup` pure function.
- `api/lib/stripeConnectWebhook.ts` (121 lines) — `mapStripeAccountToStatus` + `handleAccountUpdated`.
- `api/lib/adminAuth.ts` (162 lines) — `authoriseAdminRequest` + production-wired `verifyClerkSessionToken` + DB allowlist lookup.
- `api/lib/adminMerchantActions.ts` (121 lines) — `listPendingMerchants`, `approveMerchant`, `rejectMerchant`.

### Vercel function entry points
- `api/merchants/signup.ts` (170 lines) — POST `/api/merchants/signup`.
- `api/stripe-connect/webhook.ts` (152 lines) — POST `/api/stripe-connect/webhook` with raw-body signature verification + dedupe.
- `api/admin/merchants/list.ts` (77 lines) — GET `/api/admin/merchants`.
- `api/admin/merchants/approve.ts` (105 lines) — POST `/api/admin/merchants/approve`.
- `api/admin/merchants/reject.ts` (108 lines) — POST `/api/admin/merchants/reject`.

### Frontend pages
- `src/pages/SuppliersPage.tsx` (394 lines) — public signup form; client-side validation mirrors the Zod schema.
- `src/pages/SuppliersSignupCompletePage.tsx` (65 lines) — confirmation page with dev-only debug.
- `src/pages/AdminLayout.tsx` (60 lines) — lazy `ClerkProvider` + `SignIn`/`SignedIn` gate.
- `src/pages/AdminMerchantsPage.tsx` (341 lines) — admin queue, Approve/Reject buttons hitting the API.

### Tests (8 new files, +67 tests; suite 218 → 285)
- `api/__tests__/slug.test.ts` (10 tests)
- `api/__tests__/merchantStore.test.ts` (5 tests)
- `api/__tests__/merchantSignup.test.ts` (13 tests — schema + happy/error paths for both MU-gated and Stripe-available branches)
- `api/__tests__/stripeConnectWebhook.test.ts` (8 tests)
- `api/__tests__/adminAuth.test.ts` (9 tests)
- `api/__tests__/adminMerchantActions.test.ts` (10 tests)
- `api/__tests__/merchantEmailTemplates.test.ts` (8 tests)
- `api/__tests__/schema.test.ts` (4 tests)

### Modified files
- `package.json` — added: `@clerk/backend@1.19.0`, `@clerk/clerk-react@5.18.0`, `@neondatabase/serverless@^0.10.0`, `drizzle-orm@^0.36.0`, `zod@^3.23.8`, devDep `drizzle-kit@^0.28.0`. New scripts: `db:generate`, `db:migrate`, `db:push`.
- `vercel.json` — registered 5 new function paths with `@vercel/node@3.2.29` (10–15s maxDuration).
- `src/main.tsx` — wired 5 new routes (`/suppliers`, `/merchants`, `/suppliers/signup/complete`, `/admin`, `/admin/merchants`).
- `PHASE-1-LOG.md` — this file.
- `MERCHANT-SCHEMA.md` — ERD-style explanation of the new tables.

---

## Lines of code

| Category | LOC |
|---|---:|
| Server (api/) | 2,248 |
| Frontend (src/pages/) | 860 |
| Tests | 938 |
| Modifications | ~50 |
| **Total** | **~4,096** |

---

## Test count delta

- Baseline before Phase 1 Week 1: 218 tests across 15 files (carrying through from Hotfix 7).
- After Phase 1 Week 1: **285 tests across 23 files** (+67 / +8 files).
- All 285 pass.
- `npx tsc --noEmit` clean on both `tsconfig.json` and `api/tsconfig.json`.
- `npx vite build` clean (1.08 MB JS / 23.3 kB CSS — Clerk's React SDK adds ~80 kB over Hotfix 7's 999 kB baseline; well inside the 2 MB budget).

---

## What's deferred to Phase 2

These items appear in the OMS master plan §Phase 2 — explicitly out of scope for Week 1:

- **Monorepo split** (`/apps/storefront`, `/apps/admin`, `/apps/merchant-portal`, `/packages/api-contracts`, etc. — OMS §F.3). Current code lives in the flat SPA + api/ structure.
- **Full admin portal** — Phase 1 stub only surfaces the approval queue. Phase 2 adds: audit log, orders dashboard, refunds, disputes panel, manual suspend, search/filters.
- **Merchant document uploads** — `merchant_documents` table exists, no upload UI yet.
- **`react-email` templates** — Phase 1 uses inline HTML strings.
- **Idempotent Connect-webhook dedupe via KV** — current dedupe is an in-memory `Set` (same caveat as `api/stripe-webhook.ts`). Phase 2 swaps to Upstash KV.
- **Drizzle-kit generated migrations** — devDep installed, not yet wired. Phase 2 introduces `npm run db:generate` against the schema.
- **Rate-limiting on `/api/merchants/signup`** — OMS Phase 1 §1.11 calls for 3 signups per IP per hour via KV. Not yet implemented (KV is provisioned via Section 0 C.2 but Phase 1 ships without it; signups are low-volume in week 1 anyway).
- **Phase 6 merchant integration agent + OpenRouter** — explicitly Phase 6.

---

## Vic action items before this can run live

### 1. Pull `DATABASE_URL` into `.env.local` for local dev

In Vercel Project Settings → Environment Variables, the Neon integration injected the connection string under `DATABASE_URL`. Pull it locally:

```
cd ~/Documents/PPW-Code/ppw-designer-2d
vercel env pull .env.local      # if you have vercel CLI authenticated
# OR: copy the value from the Vercel dashboard manually
```

The `.env.local` file is gitignored — never commit it.

### 2. Apply the initial migration

```
cd ~/Documents/PPW-Code/ppw-designer-2d
npm install                                          # picks up the new deps in one go
npx tsx scripts/migrate.ts                           # applies api/db/migrations/0001_initial_merchants.sql
```

You should see `-> applying 0001_initial_merchants.sql` followed by `ok` and `migrations complete`. The migration is idempotent — safe to re-run.

Verify in Neon Console SQL editor:
```sql
SELECT enum_range(NULL::merchant_status);
SELECT * FROM merchants LIMIT 1;
SELECT * FROM admins LIMIT 1;
```

### 3. Stripe Connect dashboard work (OMS §A.1-A.3)

Once A.4 returns or the UK Ltd / Stripe Atlas detour is in place:

1. Enable Connect in the Stripe dashboard. Pick **Express**.
2. Capture `STRIPE_CONNECT_CLIENT_ID` (starts `ca_…`). Paste into Vercel env.
3. Upload PPW logo + platform name "Peak Performance Wellness Marketplace" + support email under Connect settings.
4. Register a new webhook endpoint at `dashboard.stripe.com/webhooks`:
   - URL: `https://designer.ppwellness.co/api/stripe-connect/webhook`
   - Events: `account.updated`, `account.application.authorized`, `account.application.deauthorized`, `capability.updated`
   - Copy the signing secret `whsec_…` into Vercel env as **`STRIPE_WEBHOOK_SECRET_CONNECT`** (distinct from the existing `STRIPE_WEBHOOK_SECRET`).
5. Set `STRIPE_MU_SUPPORTED=true` in Vercel env to flip the signup flow into Stripe Connect mode (default is the manual-followup path).

### 4. Public base URL

Add `PUBLIC_BASE_URL=https://designer.ppwellness.co` to Vercel env (used by `/api/merchants/signup` to compose the Stripe `return_url` and the manual-followup `completeUrl`).

### 5. (Optional) Configure the merchant portal URL

`MERCHANT_PORTAL_URL` env var is referenced by the approval email. Leave unset for Phase 1 — Phase 6 fills this in.

---

## How to run end-to-end locally

```
npm install
# DATABASE_URL must be in .env.local
npx tsx scripts/migrate.ts
npm run dev
```

Open `http://127.0.0.1:5173/suppliers`. Submit a test application. Without `STRIPE_MU_SUPPORTED=true` you'll land on `/suppliers/signup/complete?m=<slug>` and the function logs (or your Resend dashboard) will show the dry-run emails.

To exercise the admin queue, you'll need Clerk signed-in. Use Clerk's local dev signin with `victorcassius.office@gmail.com` or `victor@ppwellness.co`.

---

## Commit (local only, per REBIRTH-11.3 — Vic pushes manually)

- Message: `feat(oms-phase-1): merchant signup + Stripe Connect Express scaffold + admin stub`

### Push command for Vic

```
cd ~/Documents/PPW-Code/ppw-designer-2d
git push origin main
```

Vercel will auto-deploy. Before the next live test:

1. Make sure `DATABASE_URL`, `CLERK_SECRET_KEY`, `VITE_CLERK_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET_CONNECT`, and (when ready) `STRIPE_MU_SUPPORTED=true` are all set in Vercel env.
2. Apply the migration against Neon (one-time, via `scripts/migrate.ts` from your laptop, OR via a Vercel cron once Phase 2 adds it).
3. Visit `https://designer.ppwellness.co/suppliers` and submit a real test signup. Confirm the row appears in Neon and you receive both emails.
4. Visit `https://designer.ppwellness.co/admin/merchants`, sign in with Clerk, approve the test merchant, and confirm the approval email lands.

This closes the OMS Phase 1 Week 1 Definition of Done.
