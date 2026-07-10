# Wellness Designer — Marketplace Backend Architecture & Split-Payout Rail

**Author:** Cowork (for Vic Bhatoolaul / PPWellness)
**Date:** 2026-07-10
**Repo:** `ppw-designer-2d` (the Designer)
**Status:** Architecture + research only. No code built, no signups, no spend.
**Purpose:** Give Claude Code an implementation-ready spec for an Amazon-heavy,
multi-merchant marketplace where one customer makes a **single payment** that is
**split-paid out to many merchants** (minus PPW commission), plus an Amazon-style
self-serve product-listing flow — and pick the **payout rail** that actually works
from Mauritius now that Stripe Connect and PayPal are off the table.

---

## 0. Decision summary (read this first)

**Model (decided by Vic):** One cart → many merchants → **one** customer charge →
PPW captures → **split payout** to each merchant, PPW keeps commission. Payout
**speed to merchants matters**. A second listing path (merchant lists a product,
Amazon-style) sits alongside the 2D room-designer path.

**Rail recommendation (Part B):** **MIPS 1BMV (“1 Basket Multi-Vendor”)** as the
primary rail. It is a 100% Mauritian gateway whose marketplace product does the
exact thing required — routes one basket containing products from multiple vendors
and **credits each vendor in real time**, auto-settling the marketplace’s (PPW’s)
fee, *with no marketplace licence required*. Nothing else on the market is this
close a fit for a MU-based platform paying mostly-local merchants.

- **Primary:** MIPS 1BMV — real-time split settlement, MU-native, card + MauCAS QR + MCB Juice acceptance.
- **Fallback / hybrid (build-your-own-split):** **Peach Payments** (collections in MU via MCB MCP account, settle in USD/MUR) **+ Peach Payouts API** to disburse each merchant slice. Use if MIPS 1BMV commercial terms or onboarding stall.
- **Manual backstop (already half-built in repo):** capture via any single rail → write `payout_queue` rows → disburse with **MCB Bulk Payment** (batch file) on a hold cycle. This is what the current codebase already scaffolds.
- **Ruled out:** Stripe Connect (no MU), PayPal split/Marketplaces (restricted MU), Paystack (no MU), Flutterwave payout-subaccounts (NGN-only), pure MoR like Paddle/Lemon Squeezy (they pay **one** account, cannot split to sub-merchants).

**Backend headline (Part A):** ~70% of the data model already exists in this repo
(`merchants`, `products`, `orders`, `order_items`, `payout_queue`,
`order_item_events`, capture scale-locks, cart-split logic, disburse cron
scaffold). The **net-new** work is: a proper **payout ledger** (double-entry, not
just a queue), **per-merchant commission**, a **self-serve listing write API**, and
**one rail adapter** behind the already-existing `disburseViaRail()` seam.

---

# PART A — Backend Architecture Spec

## A1. What already exists in this repo (do not rebuild)

Source of truth: `api/_db/schema.ts` (Drizzle) + `api/_db/migrations/*.sql`.

| Concern | Table / module (existing) | Notes |
|---|---|---|
| Merchants + lifecycle | `merchants` (enum `pending_signup → awaiting_kyc → kyc_complete → pending_admin_approval → approved / rejected / suspended`) | Has `webhook_secret`, `stripe_connect_account_id` (legacy), `country` default `MU`. |
| Merchant KYC docs | `merchant_documents` | doc types: distributor_agreement, invoice, business_registration, other. |
| Admins | `admins` (Clerk) | super_admin / reviewer. |
| Products / listings | `products` | Has `width_mm/depth_mm/height_mm`, `weight_g`, `price_minor`, `currency`, `image_url`, `eco_cert_level`, `in_stock_qty`, `supplier_rating`, status enum. |
| Top-down 2D scale | `product_capture_scale_locks` | HMAC-signed `pixels_per_mm` + RMS error + silhouette bbox per product photo — **this is the real-dimensions-for-scale mechanism** the listing flow needs. |
| Suppliers / fulfilment source | `suppliers`, `supplier_products` (m:n, cost + lead time) | Per-merchant fulfilment records. |
| Orders (multi-rail) | `orders` (enum rails: stripe, paypal, **mips, mcb_juice, bank_transfer**) | `payment_status: pending→authorised→captured→failed→refunded→partially_refunded`. |
| Order lines per merchant | `order_items` (FK order, merchant, supplier, product; `payout_status`, `payout_id`) | **This is the per-merchant split slice.** |
| Fulfilment events | `order_item_events` (confirmed/shipped/in_transit/delivered/returned/failed + tracking/carrier) | Per-line lifecycle. |
| Payout queue | `payout_queue` (merchant, amount_minor, currency, rail, status queued→processing→sent→failed, scheduled_for, external_payout_id) | 14-day hold, per-order rows. |
| Cart split logic | `api/_lib/cart/split.ts` (`splitCartByMerchant`) | Pure function; single-currency guard; per-merchant buckets. |
| Cart quote (preview) | `POST /api/cart-quote` | Read-only per-merchant breakdown before checkout. |
| Payout recorder | `api/_lib/payouts/recordPayoutsForOrder.ts` | On capture: sum per-merchant, apply commission (default **5%**), insert `payout_queue` at now+14d. |
| Disburse worker | `api/_lib/cron/disbursePayouts.ts` | **Dry-run by default; `disburseViaRail()` is the empty seam for the rail adapter.** This is where Part B plugs in. |
| Webhook idempotency | `webhook_events` (unique source+event_id) + `webhookDedupe.ts` / `webhookVerify.ts` | Reusable for the MIPS webhook. |
| Audit | `audit_log` | Every admin mutation. |
| Designer save / leads / referrals | `designs`, `leads`, `designer_referrals` | Designer path + Pattern-C attribution. |

**Reused primitives for anything new:** `withApi.ts` (handler wrapper), `idempotency.ts`,
`rateLimit.ts`, `merchantSession.ts`, `sentry.ts`, `scripts/migrate.ts` (checksum’d
migrations in `schema_migrations`).

## A2. Net-new work (what Claude Code must add)

1. **Payout ledger (double-entry)** — `payout_ledger` + `payout_batches`. The
   current `payout_queue` answers “what disbursement is scheduled”; it does **not**
   answer “what is owed vs paid vs held vs refunded per merchant, auditable”. Add a
   ledger so every cent has a debit/credit trail. Keep `payout_queue` as the
   *scheduling/execution* table that references ledger entries.
2. **Per-merchant commission** — `merchants.commission_pct` (nullable; fall back to
   platform default 5%). `recordPayoutsForOrder` already accepts a `commissionRate`
   override — wire it to read this column.
3. **Self-serve listing write API** — `POST /api/merchants/:slug/products` (+ image
   upload + scale-lock link). Read path (`/api/products`) already exists.
4. **One rail adapter** — implement `disburseViaRail()` for the chosen rail (MIPS
   1BMV real-time makes most of this near-trivial; see A7 / Part B).
5. **Merchant payout account** — `merchant_payout_accounts` (rail + external
   sub-merchant/vendor id + bank/Juice handle + verification status). Needed so a
   payout knows *where* to send money on the chosen rail.
6. **Marketplace-native charge path** — a `POST /api/checkout` that creates the
   `orders` + `order_items` rows and initiates the split charge with the rail
   (replacing/adjoining the legacy Stripe `create-checkout-session.ts`).

## A3. Core data model (target state)

Minor units (integer cents) throughout; currency is ISO-4217; default `MUR`.

### merchants (exists — extend)
Add:
```
commission_pct        numeric(5,4)  NULL   -- e.g. 0.0500; NULL → platform default
payout_hold_days      integer       NOT NULL DEFAULT 14
default_payout_rail   payment_rail  NULL   -- 'mips' | 'peach' | 'mcb_juice' | 'bank_transfer'
onboarding_state      varchar(40)          -- mirrors rail sub-merchant onboarding (see A7)
```

### merchant_payout_accounts (NET-NEW)
Where each merchant’s money is sent. One active row per (merchant, rail).
```
id                  bigserial PK
merchant_id         bigint FK merchants
rail                payment_rail            -- 'mips' | 'peach' | 'mcb_juice' | 'bank_transfer'
external_vendor_id  varchar(120)            -- MIPS vendor id / Peach recipient id
bank_name           varchar(120)
bank_account_masked varchar(40)
juice_msisdn        varchar(20)             -- MCB Juice mobile number if used
currency            varchar(3) NOT NULL DEFAULT 'MUR'
verification_status varchar(24) NOT NULL DEFAULT 'unverified' -- unverified|pending|verified|rejected
is_active           boolean NOT NULL DEFAULT true
created_at / updated_at
UNIQUE(merchant_id, rail) WHERE is_active
```

### products / listings (exists — the Amazon-style listing schema)
The `products` table **is** the listing. A “listing” = a product row owned by a
merchant, with real physical dimensions and a **top-down 2D image** whose scale is
locked by a `product_capture_scale_locks` row. Key fields for the listing flow:
```
merchant_id, sku (unique per merchant), name, category, description
width_mm, depth_mm, height_mm, weight_g       -- REAL dimensions → 2D scale on canvas
price_minor, currency, in_stock_qty
image_url                                      -- top-down PNG (alpha-clean flag: photo_alpha_clean)
capture_scale_lock_id  → product_capture_scale_locks.scale_lock_id  -- pixels_per_mm + HMAC
eco_cert_level, supplier_rating, status(draft|active|archived|out_of_stock), region
```
Listing rule: a product may go `active` only when it has `price_minor`, at least
one image, dimensions, and (for canvas placement) a valid non-invalidated
scale-lock. This gate is enforced in the write API (A6), not the DB.

### orders (exists) & order_items (exists — the split slice)
`orders` = one customer, one currency, one `total_minor`, one `payment_rail`,
one `payment_status`. `order_items` = one row per merchant×product slice, carrying
`line_total_minor`, `merchant_id`, `supplier_id`, `payout_status`, `payout_id`.
No schema change needed except an optional `commission_pct_snapshot` and
`platform_fee_minor` on `order_items` so the split is frozen at capture time:
```
platform_fee_minor      integer  NULL   -- PPW commission on this line, frozen at capture
merchant_net_minor      integer  NULL   -- line_total_minor - platform_fee_minor
commission_pct_snapshot numeric(5,4) NULL
```

### payout_ledger (NET-NEW — the “what’s owed to whom” book)
Append-only, double-entry-style. Every money event = one row; balance per merchant
is a SUM. Never UPDATE amounts — reverse with a compensating row.
```
id              bigserial PK
merchant_id     bigint FK merchants
order_id        bigint FK orders            NULL   -- null for adjustments
order_item_id   bigint FK order_items       NULL
entry_type      varchar(24)  -- 'accrual' | 'commission' | 'hold_release' | 'payout' |
                             --  'refund_clawback' | 'adjustment' | 'reversal'
direction       char(1)      -- 'C' credit merchant | 'D' debit merchant
amount_minor    integer NOT NULL
currency        varchar(3) NOT NULL
payout_batch_id bigint FK payout_batches    NULL
ref             varchar(160)                       -- ppw_order_id / rail txn id
created_at      timestamptz NOT NULL DEFAULT now()
INDEX(merchant_id, created_at), INDEX(order_id)
```
Merchant balance = `SUM(credits) - SUM(debits)` where `entry_type IN (...settled...)`.
Available-to-pay = accrued **and** past hold **and** not yet in a `payout` entry.

### payout_batches (NET-NEW — execution grouping)
```
id              bigserial PK
rail            payment_rail
status          varchar(24)  -- 'building'|'submitted'|'settled'|'partially_failed'|'failed'
currency        varchar(3)
total_minor     integer
external_batch_id varchar(120)   -- MIPS/Peach/MCB batch reference
merchant_count  integer
submitted_at / settled_at / created_at
```
`payout_queue` (existing) becomes the per-merchant execution row that links a
ledger `payout` entry to a `payout_batch` and to the rail’s `external_payout_id`.

### webhook_events, audit_log, order_item_events — reuse as-is.

## A4. End-to-end flows

### Flow 1 — Multi-merchant cart → single checkout → split payout
```
1. Browse/Design → cart holds line items {productId, sku, qty, unitPriceMinor, currency}.
2. POST /api/cart-quote            (EXISTS) → splitCartByMerchant → per-merchant subtotals preview.
3. POST /api/checkout              (NET-NEW):
     a. Re-price server-side from products table (never trust client prices).
     b. splitCartByMerchant → validate single currency, every product has a merchant.
     c. Insert orders(payment_status='pending', payment_rail=<chosen>).
     d. Insert order_items rows (one per merchant×product), freezing
        commission_pct_snapshot, platform_fee_minor, merchant_net_minor.
     e. Initiate charge with rail:
          • MIPS 1BMV: create a basket describing each vendor slice → gateway
            splits at settlement (no post-hoc payout needed for local vendors).
          • Fallback rails: single charge to PPW; split handled in Flow 3.
     f. Return redirect/checkout URL or client token.
4. Customer pays on rail-hosted page (card / MauCAS QR / MCB Juice).
5. Rail webhook → /api/<rail>-webhook:
     a. webhook_events dedupe + signature verify (EXISTS pattern).
     b. On 'captured': orders.payment_status='captured'.
     c. recordPayoutsForOrder(ppwOrderId)  (EXISTS, extend):
          - write payout_ledger 'accrual' (credit) + 'commission' (debit) per merchant
          - insert payout_queue rows at scheduled_for = now + merchant.payout_hold_days
     d. order_item_events 'confirmed' per line; dispatch merchant + customer emails (EXISTS).
6. Fulfilment: each merchant marks shipped/delivered via
     POST /api/merchants/:slug/order-update (HMAC, EXISTS) → order_item_events.
7. Payout (Flow 3).
```

### Flow 2 — Amazon-style self-serve listing
```
1. Merchant approved (merchants.status='approved') → gets session (merchantSession.ts, EXISTS).
2. Merchant captures/upload top-down photo:
     POST /api/merchants/:slug/capture/sign-upload  (EXISTS) → signed blob URL.
     Client runs A4-corner / ArUco / WebXR scale calibration → pixels_per_mm.
     POST /api/merchants/:slug/capture/commit → product_capture_scale_locks row (HMAC).
3. Merchant creates listing:
     POST /api/merchants/:slug/products  (NET-NEW write API):
        body: {sku, name, category, description, width_mm, depth_mm, height_mm,
               weight_g, price_minor, currency, image_url, capture_scale_lock_id,
               eco_cert_level, in_stock_qty}
        → validate ownership + gate (price+image+dims+valid scale-lock)
        → insert products(status='draft').
4. Merchant publishes: PATCH .../products/:id {status:'active'} (gate re-checked).
5. Listing now appears in /api/products and is placeable on the 2D canvas at true scale.
   (Vic may build this listing UI in the Designer and hand the calls to Claude Code —
    the backend contract above is all the UI needs.)
```

### Flow 3 — Payout (split disbursement)
```
MIPS 1BMV (primary): local vendor slices are already settled in real time at
  purchase → payout_queue rows for those slices are opened and immediately closed
  as 'sent' by the settlement webhook; ledger writes a 'payout' entry referencing
  the MIPS txn. Near-zero manual disbursement.

Fallback (Peach / MCB bulk): cron /api/cron/disburse-payouts (EXISTS, scaffold):
  1. findDuePayouts()  → status='queued' AND scheduled_for<=now (EXISTS).
  2. Group by rail+currency → open payout_batch.
  3. disburseViaRail(row) (EXISTS seam, NET-NEW body):
        Peach → Payouts API call per recipient (merchant_payout_accounts).
        MCB   → append to bulk-payment batch file for corporate upload.
  4. On success: payout_queue.status='sent', external_payout_id set;
        payout_ledger 'payout' debit; order_items.payout_status='sent'.
  5. On fail: status='failed'; ledger untouched; Sentry + admin alert.
  Guarded by PAYOUT_DISBURSE_ENABLED flag (EXISTS) — dry-run until a rail is live.
```

### Flow 4 — Merchant onboarding hooks
```
signup (EXISTS) → KYC docs → admin approve (EXISTS) →
  NET-NEW on approve: create rail sub-merchant/vendor (MIPS vendor id / Peach recipient)
  → store in merchant_payout_accounts (verification_status='pending')
  → rail webhook flips 'verified' → merchant eligible for live payouts.
```

## A5. Refunds & edge cases (must be specified for Claude Code)
- **Refund after payout accrued but before disbursed:** write ledger
  `refund_clawback` debit; cancel matching `payout_queue` row if still `queued`.
- **Refund after disbursed:** ledger `refund_clawback` debit → merchant carries a
  negative balance, netted against next accrual (or invoiced if it persists).
- **Partial refund:** clawback only the refunded line’s `merchant_net_minor` share.
- **Mixed currency per merchant:** already blocked upstream in `split.ts`; keep the
  guard, one payout currency per merchant per order.
- **Rounding:** commission computed per line with `Math.round`; the platform keeps
  the rounding remainder (document it — never short the merchant).

## A6. Endpoints (contract)

| Method + path | Status | Purpose |
|---|---|---|
| `POST /api/cart-quote` | EXISTS | Per-merchant split preview. |
| `POST /api/checkout` | NET-NEW | Create order+lines, initiate split charge. |
| `POST /api/mips-webhook` | NET-NEW | Capture + real-time settlement events (dedupe+verify). |
| `POST /api/paypal-webhook` / `stripe-webhook` | EXISTS (legacy) | Keep for any legacy rail; not primary. |
| `GET  /api/products` (+ `/merchants/:slug/products`) | EXISTS | Public + merchant catalog read. |
| `POST /api/merchants/:slug/products` | NET-NEW | Create listing (draft). |
| `PATCH /api/merchants/:slug/products/:id` | NET-NEW | Edit / publish (status gate). |
| `POST /api/merchants/:slug/capture/sign-upload` | EXISTS | Signed image upload. |
| `POST /api/merchants/:slug/capture/commit` | EXISTS | Create scale-lock. |
| `POST /api/merchants/:slug/order-update` | EXISTS | Merchant fulfilment (HMAC). |
| `POST /api/merchants/signup` | EXISTS | Onboarding. |
| `GET  /api/admin/payouts` | EXISTS | Admin payout viewer (extend to ledger). |
| `POST /api/cron/disburse-payouts` | EXISTS (scaffold) | Batch disburse via rail adapter. |
| `GET  /api/admin/merchants/:id/ledger` | NET-NEW | Per-merchant owed/paid/held view. |

## A7. State machines

**Merchant:** `pending_signup → awaiting_kyc → kyc_complete → pending_admin_approval
→ approved → (suspended)`; `rejected` terminal. (EXISTS.)
Payout-account sub-state: `unverified → pending → verified / rejected`.

**Order (payment):** `pending → authorised → captured → (refunded | partially_refunded)`;
`failed` terminal. (EXISTS enum.)

**Order line (payout_status):** `queued → processing → sent`; `failed` retryable. (EXISTS.)

**Payout ledger balance (derived, per merchant):**
`accrued (held) → available (past hold) → paid`; `clawed_back` reduces any stage.

**Payout batch:** `building → submitted → settled | partially_failed | failed`.

---

# PART B — Split-Payout Rail Research & Recommendation

## B1. The constraint
Standard marketplace rails are unavailable to a Mauritius-domiciled platform:
- **Stripe Connect** — not available in Mauritius (no MU seller onboarding).
- **PayPal** — receiving/marketplace payouts restricted in MU; the repo’s PayPal
  slice is effectively a dead-end for split payout.

So the platform needs a rail that (a) onboards **MU merchants**, (b) does
**split / marketplace payout**, ideally (c) **fast** to merchants, at (d) sane fees
and (e) reasonable integration effort.

## B2. Provider matrix

| Provider | MU merchants? | Split / marketplace payout? | Payout speed | Fees (indicative) | Integration effort | Verdict |
|---|---|---|---|---|---|---|
| **MIPS 1BMV** (Mauritian) | **Yes — native** | **Yes — 1 basket, multi-vendor, credits each vendor in real time; auto-settles marketplace fee; no marketplace licence needed** | **Real-time at purchase** | “% per transaction, very competitive” (not public — get a quote) | Low-med: REST API (`docs.mips.mu`), Shopify/Woo/Magento/PrestaShop/Odoo plugins, sandbox+SDKs | ★ **PRIMARY** |
| **Peach Payments** | **Yes** — registers you an MCP account with **MCB**, can settle in USD or MUR | Collections yes; **Payouts API** disburses to merchants “in minutes”; split not a single turnkey product — you orchestrate | Payouts in minutes | Per-txn gateway + payout fees (quote) | Med: single API + dashboard; MauCAS QR + MCB Juice supported | ★ **FALLBACK / hybrid** |
| **MCB (Bulk Payment + MPGS gateway)** | Yes — the bank itself | No native split; **Bulk Payment** = batch file disbursement (corporate) | Batch (same/next-day domestic) | Bank tariffs | Med-high: MPGS (Mastercard) gateway for collection + manual/API bulk file for payout | Manual **backstop** (repo already models this) |
| **Rapyd** | Yes (legal entity) — Disburse supports MU **bank transfer**; collections limited (bank transfer/redirect, weak cards) | Yes — sub-accounts + rules split, global | Varies; RTP in 50+ countries (MU not RTP) | Global pricing, higher | High: global KYB, heavier contracts | Overkill for mostly-local; keep for cross-border only |
| **DPO Group (DPO Pay by Network)** | **Yes** — strong MU presence (130k+ merchants, 20+ countries) | Gateway strong; **marketplace split not a documented product**; “split payment” = customer splitting their own payment | Standard settlement | Per-txn | Med | Good collections backup; **not** a split-payout answer |
| **Flutterwave** | Unclear/weak for MU | Split payments + subaccounts exist, **but payout subaccounts are NGN-only**; MU support not confirmed | — | — | Med | **Not a fit** for MU payout |
| **Cellulant** | Broad (35 markets) | Enterprise pan-African collections/payout; MU marketplace split undocumented | Corridor-dependent | Enterprise | High (enterprise sales) | Slow to stand up; not fast path |
| **Paystack** | **No** (NG/GH/KE/ZA/CI only) | n/a | n/a | n/a | n/a | **Ruled out** |
| **MoR: Paddle / Lemon Squeezy** | They’re MoR globally | **No** — they pay out to **one** account (the platform), cannot split to N sub-merchants | — | ~5%+ | Low | Only if PPW is sole seller; **does not solve multi-merchant split** |

## B3. Why MIPS 1BMV wins
1. **It is literally the required product.** “One basket, multiple products, multiple
   vendors, credited to each vendor **in real time**” — that is Vic’s exact model,
   sold as a named feature, by a Mauritian company, for Mauritian marketplaces.
2. **Speed = instant.** Merchant payout speed was called out as important. 1BMV
   settles each vendor at the moment of purchase — nothing waits for a batch. This
   also collapses most of Flow 3 and the whole “book of debt / reconciliation”
   problem the current `payout_queue` was built to manage.
3. **No marketplace licence needed** — MIPS explicitly removes the regulatory /
   banking blocker that makes MU banks “think twice” about marketplace accounts.
4. **Local acceptance** — cards + MauCAS QR + MCB Juice (500k+ users), which is how
   Mauritian customers actually pay.
5. **Low integration lift** — documented REST API + sandbox + existing e-commerce
   plugins; the repo’s `payment_rail` enum already includes `mips`.

**The one open question is commercial:** MIPS doesn’t publish 1BMV pricing or the
full split-API contract — both require contacting `contact@mips.mu` /
`docs.mips.mu`. That’s a Vic quick-check (a conversation, not a spend).

## B4. Recommended rollout
1. **Now (unblocks money movement fastest):** engage MIPS for 1BMV — get the API
   contract + fee quote + sandbox. Build `POST /api/checkout` (1BMV basket) +
   `POST /api/mips-webhook` + `disburseViaRail('mips')` (mostly reconciliation, since
   settlement is real-time). Keep everything behind `PAYOUT_DISBURSE_ENABLED`.
2. **In parallel (de-risk):** stand up **Peach Payments** as the fallback —
   collections via the MCB MCP account + **Payouts API** to disburse each merchant
   slice from the ledger. This is the “PPW captures, PPW splits” model and reuses
   the existing `payout_queue` → `disburseViaRail('peach')` path 1:1.
3. **Backstop (already coded):** MCB Bulk Payment file for any merchant not on a
   real-time rail — the current dry-run cron + `payout_queue` already implements the
   scheduling half.

**Net:** MIPS 1BMV for speed and native fit; Peach as the build-your-own-split
insurance; MCB bulk as the manual floor. All three slot into the **one**
`disburseViaRail()` seam the repo already exposes — so the architecture doesn’t
change if the rail choice does.

---

## Sources
- [MIPS — Home](https://mips.mu/) · [E-Commerce Solutions](https://mips.mu/e-commerce-solutions/) · [API docs](https://docs.mips.mu/)
- [MIPS News — 1 Basket-Multi-Vendor (1BMV) technology](https://news.mips.mu/2021/01/21/1-basket-multi-vendor-technology/)
- [MIPS FinTech across borders (interview)](https://mauritiusfintech.org/blog/sebastien-le-blanc-mips-fintech-across-borders/)
- [Rapyd — Disburse / Payout methods](https://docs.rapyd.net/build-with-rapyd/docs/rapyd-disburse-payout-methods) · [Mauritius country data](https://www.rapyd.net/network/country/mauritius/) · [Marketplaces](https://www.rapyd.net/solutions/industries/marketplaces/)
- [Flutterwave — Split payments with sub-accounts](https://flutterwave.com/us/support/payments/split-payments-with-sub-accounts) · [Payout subaccount (NGN-only)](https://developer.flutterwave.com/v3.0/docs/payout-subaccount)
- [DPO Pay — Mauritius online payments](https://dpogroup.com/online-payments/mauritius/) · [DPO Pay merchant docs](https://docs.dpopay.com/dpo-pay-by-network)
- [Peach Payments — Mauritius expansion](https://www.peachpayments.com/scale/peach-payments-mauritius/) · [Mauritius merchant onboarding](https://support.peachpayments.com/support/solutions/articles/47001269013-mauritius-merchant-onboarding)
- [MCB — Bulk Payment](https://mcb.mu/corporate/payment-cash/pay/bulk-payment) · [MCB Online Payment Gateway](https://mcb.mu/corporate/payment-cash/collect/e-commerce/online-payment-gateway) · [MCB × Peach partnership](https://mcbmu.sitefinity.cloud/docs/default-source/press-release-doc/mcb-partners-with-peach-payments_en.pdf)
- [Paystack — pricing / supported countries](https://paystack.com/pricing) · [Cellulant](https://www.cellulant.io/)
- [Instant Payments Mauritius (rails overview)](https://www.lightspark.com/knowledge/instant-payments-mauritius)
