# WD Rework — Analysis Pack (Vic directives 3, 4, 6)

**Date:** 2026-07-26 · **Author:** Claude (WD rework session, direct code analysis)
**Prod at time of writing:** `b9ee98b` (shop-first live, top-right decluttered, axis fix shipped)
**Style note:** short + tables on purpose. Every claim cites the file it came from.

---

## PART 1 — Money workflow: PPW acts as the shop, pays merchants individually (directive 4)

### Verdict
The model Vic described **is exactly what the code is already shaped for** — one basket,
PPW collects, merchants get paid individually later. About 70% of the plumbing exists.
What's missing: the money can come IN (PayPal path works) but can never go OUT
(the payout worker has no rail adapter — deliberately), there is no proper ledger,
and commission is a hardcoded default. No split-settlement is needed anywhere —
the Mauritius bank constraint is already respected.

### How money flows TODAY (verified in code)

| Step | What happens | Where | Status |
|---|---|---|---|
| 1. Cart | Shop cart holds DB product lines | `marketplaceCartStore` | works |
| 2. Quote | Per-merchant split preview | `POST /api/cart-quote` → `split.ts` | works |
| 3. Pay | Customer pays **PPW** (one charge) via PayPal (Stripe path exists, gated) | `MarketplaceCheckoutPage:106` → paypal-router | code-complete, sandbox |
| 4. Record | On capture: per-merchant share = subtotal × (1 − 5%), one `payout_queue` row per merchant, held 14 days | `recordPayoutsForOrder.ts:133-143` | works |
| 5. Pay merchants | Worker finds due rows… and **refuses every rail** | `disbursePayouts.ts:58-60` `rail_not_implemented` | **intentionally dead end** |

So: **PPW-as-shop is already the architecture.** Money in ✓, bookkeeping ✓, money out ✗.

### What's missing (gap list, build order)

| # | Gap | Build | Size |
|---|---|---|---|
| 1 | **Merchant payout accounts** — nowhere to store WHERE to pay a merchant (bank account/Juice number) | New table `merchant_payout_accounts` (merchant_id, rail, bank name, masked account, verification status). Spec already written in `docs/MARKETPLACE-BACKEND-ARCH…` §A3 | S |
| 2 | **Per-merchant commission** — 5% is a constant (`PPW_PAYOUT_COMMISSION_DEFAULT`), the UI elsewhere says 7% | Add `merchants.commission_pct` column; `recordPayoutsForOrder` already accepts an override (`deps.commissionRate`) — just wire it | S |
| 3 | **Payout ledger** — `payout_queue` says "what to pay", not "what is owed vs paid vs clawed back, auditable" | `payout_ledger` append-only table (spec in the arch doc §A3). Queue rows reference ledger entries | M |
| 4 | **The rail adapter** — `disburseViaRail()` is an empty seam | **MCB Bulk Payment file generator**: the adapter writes a bulk-payment CSV batch for MCB corporate upload, marks rows `processing`; a confirm step marks `sent`. No API needed — MCB bulk is file-upload | M |
| 5 | **Refund clawback** | On refund webhook: compensating ledger row; cancel queue row if still `queued` | S |
| 6 | **Freeze the split at capture** | Optional cols on `order_items`: `platform_fee_minor`, `merchant_net_minor`, `commission_pct_snapshot` | S |

Everything folds into existing tables/functions — **no new Vercel function needed**
(cron-router already hosts `disburse-payouts`).

### What Vic actually does each week (operational loop, once built)
1. Open `/admin/payouts` — see rows past their 14-day hold.
2. Click **"Build MCB batch"** → downloads the bulk-payment file.
3. Upload the file in MCB corporate internet banking, authorise it.
4. Click **"Mark batch sent"** → rows flip to `sent`, ledger updated, merchants emailed.

That's it. One file, one upload, once a week. Real-time payouts (Peach Payouts API)
can replace the file later without changing the data model.

### VAT / legal checklist (from the arch doc — confirm with the accountant, NOT legal advice)
- [ ] PPW as seller-of-record ⇒ **15% VAT on the GROSS basket**, not on commission.
- [ ] VAT registration is compulsory at **MUR 3,000,000** turnover — and turnover = gross sales, so this arrives fast.
- [ ] Confirm in writing that "collect in own name → pay own suppliers" is NOT payment intermediation under NPSA 2018.
- [ ] Merchant contracts must read as **supply/reseller** agreements, not "marketplace facilitation".
- [ ] Returns/warranty/consumer protection sit with PPW as seller — price that in.

---

## PART 2 — Merchant onboarding credit calculator (directive 3B)

### Verdict
Buildable now, mostly from existing parts. The agent stack already has the exact
accounting primitive needed (micro-USD budget counters with caps —
`api/_lib/agent/lockdown.ts:100-190`). The one number that does not exist anywhere
is **what an OpenArt credit costs Vic in dollars** — the whole price formula hangs
off that one config value.

### Merchant flow (what the merchant sees)
1. On the dashboard: **"Get your products designed"** card.
2. Enters their website. Adds category links, one per line, each with an item count:
   - `k1.com/treadmills` — 12 items
   - `k1.com/tables` — 8 items
3. Live quote updates as they type: *"20 products ≈ Rs X — includes product data
   extraction + a to-scale designer image per product."*
4. Pays (via the same PPW rail) → credits land on their account → onboarding runs
   → products appear as drafts for their review.

### The price formula (explicit, all inputs named)

```
per_product_cost_usd =
    EXTRACT_COST_USD          # scrape + LLM extraction of name/price/dims per item
                              #   (OpenRouter; agent stack already meters this in micro-USD)
  + IMAGES_PER_PRODUCT        # default 1 top-down
    × (1 + RETRY_ALLOWANCE)   # default 0.5 — half the items need one re-roll (observed)
    × IMAGE_CREDITS           # 40 (nano-banana-pro image2image, proven quality tier)
    × CREDIT_USD              # ⚠ VIC INPUT — USD per OpenArt credit (plan price ÷ credits)

quote_usd  = Σ over links ( items × per_product_cost_usd ) × (1 + PPW_MARGIN)
quote_mur  = quote_usd × FX_USD_MUR
```

Worked example (once CREDIT_USD is known): 20 items, 1 image each + 50% retry
allowance = 30 generations = 1,200 OpenArt credits + 20 extractions + margin.

**Vic inputs needed:** `CREDIT_USD` (from the Advanced-plan price), `PPW_MARGIN`
(suggest 30–50%), `RETRY_ALLOWANCE` confirm.

### Credit account (schema — mirrors the payout patterns)

```
merchant_credit_accounts   merchant_id PK, balance_credits int, updated_at
merchant_credit_ledger     id, merchant_id, delta_credits (+topup/−debit/+refund),
                           reason ('topup'|'image_generated'|'extract'|'refund_failed_asset'),
                           ref (order id / product sku / generation id), created_at
```
Append-only ledger, balance = SUM — same discipline as the payout ledger.
Debit on successful asset only; failed generation auto-refunds.

### Where it lives
- **UI:** new card + page under the existing merchant dashboard (`/merchant/:slug/onboarding-quote`).
- **API:** fold into `merchants-router.ts` (quote calc + link submission) — no new function.
- **Fulfilment:** the quote's link list becomes a batch job for the proven top-down
  pipeline (extract → generate → normalize → catalog draft). Runs out-of-band
  (session/script) exactly like today's batch — the 553MB lambda lesson means this
  must NEVER run inside a Vercel function.

---

## PART 3 — UX audit: client + merchant journeys (directive 6)

### Verdict
The shop-first switch fixed the biggest confusion (shop is now the front door).
The next three highest-value fixes are: **brand-style the shop** (it's raw grey
developer styling next to a polished navy/gold designer), **bridge the two carts**
(a customer who uses both modes sees two different carts with no explanation), and
**give products trust signals** (no merchant name, no delivery info, no returns line).

### Client journey friction (ranked)

| # | Friction | Where | Fix size |
|---|---|---|---|
| 1 | Shop pages are unstyled grey/black inline CSS — feels like a different, unfinished site vs the branded designer | `PublicProductsPage.tsx`, `ProductDetailPage.tsx`, marketplace cart/checkout | M (coordinate with Claude Design) |
| 2 | **Two carts**: place items in the designer → cart badge N; open the shop → different cart, count 0. No copy explains it | `cartStore` vs `marketplaceCartStore` (intentional, `docs/CART-ARCHITECTURE.md`) | S bridge: show both counts + a "your room design cart" link in the shop header; full merge is a Vic decision (money path) |
| 3 | No trust signals on product pages: sold-by merchant, delivery estimate, returns policy | `ProductDetailPage.tsx` | S (needs Vic's returns/delivery copy) |
| 4 | Designer is quote-forward: coral "Request quote" is the loudest CTA; Buy/Checkout hides in the cart strip | `TopBar.tsx:506` | S (product decision: which is primary?) |
| 5 | Currency: shop shows product currency raw; designer has a currency switcher — inconsistent | shop pages vs `currencyStore` | S |
| 6 | Category filter is a free-text box you must type exactly right — should be tap chips from the live facets | `PublicProductsPage.tsx` filter inputs; API already returns facets (`include_facets`) | S |

### Merchant journey friction (ranked)

| # | Friction | Where | Fix size |
|---|---|---|---|
| 1 | Dashboard "Recent designs" + "Commission ledger" cards are hardcoded placeholder text (MUR 0) | `MerchantDashboardPage.tsx:400+` | M (wire real orders + payout_queue data — endpoint exists for admin, needs a merchant-scoped read) |
| 2 | No orders view — a merchant cannot see what they've sold | dashboard | M |
| 3 | No stock edit (price edit + delete shipped this week; stock needs `inStockQty` added to the summary API shape) | `apiCatalogAdapter.ts` | S |
| 4 | Capture/scale flow is orphaned — `CaptureModal` (6-step accurate-dimensions flow, DT-01..20 work) is mounted on NO route | `src/components/capture/*` | Decision: revive as the "scan your product" flow for the credit-calculator onboarding, or delete |
| 5 | Magic-link session quietly expires after 30 days → writes start failing with 401 and the UI doesn't say why | `merchantSession.ts` | S (catch 401 → "session expired, resend link") |

---

## PART 4 — Functionality inventory (directive 3A, verified in code 2026-07-26)

**Working end-to-end:** shop grid + keyword search + product pages + marketplace cart/checkout (PayPal sandbox) · designer place/rotate/undo/save + walls (persist since this week) + live length label · designer cart → checkout · order track/history · merchant signup → magic link → dashboard (images, price edit, delete) → add product · merchant AI agent (OpenRouter, budget-capped) · admin console (merchants/orders/payouts/products/audit) · payout recording (5%, 14-day hold) · cron: escalate-orders, supplier-rating, email-reconcile · Sentry + rate-limits + webhook dedupe.

**Broken / dead / stubbed (the fix list):**

| # | Item | State | Action |
|---|---|---|---|
| 1 | `/api/capture/reference-page.pdf` | 500 in prod since June (jsPDF under Vercel node) | Fix or retire with the capture decision (Part 3 #4) |
| 2 | `floorZoneStore` + `wallTreatmentStore` | Zero producers — dead state wired into history/clear | Delete, or build the paint/flooring picker (Sims materials — Vic decision) |
| 3 | `CaptureModal` + capture components | Orphaned (no route) | Same decision as Part 3 #4 |
| 4 | `designer_referrals` table | **Missing in prod** (migration 0026 never ran) → K1 outbound-click commission tracking silently records nothing | Run migration 0026 (Vic: Neon dashboard, or grant DB write) |
| 5 | `products.topdown_*` columns | Missing in prod (0027 never ran); code is gated safe | Optional — static pipeline works without it |
| 6 | Stripe path | Code-complete, env-gated off; MU gateway pending | Blocked external (MIPS Essential decision) |
| 7 | Paint calculator | API exists (`/api/calc/*`), no customer UI | Ties to #2 decision |
| 8 | `/api/cron/generate-topdowns` | Returns 410 **by design** (553MB lambda) | None — out-of-band batch is the design |

---

## The decision list for Vic (everything above that needs a yes)

1. **CREDIT_USD** — what does the OpenArt Advanced plan cost / how many credits? (unlocks the calculator pricing)
2. **PPW_MARGIN** on onboarding — 30%? 50%?
3. **Commission** — 5% or 7%? (code default 5, old UI copy 7)
4. **Primary CTA in the designer** — Buy or Request-quote?
5. **Returns/delivery copy** for product pages (trust signals).
6. **Capture flow** — revive as merchant "scan your product", or delete?
7. **Paint/flooring** — build the Sims materials picker, or delete the dead stores?
8. **Run migration 0026** (designer_referrals) — needed before any K1 commission is trackable. I cannot write to prod Neon; it's one paste in the Neon SQL editor.
9. **Cart merge** — bridge copy now (safe), full single-cart later (money-path change)?
