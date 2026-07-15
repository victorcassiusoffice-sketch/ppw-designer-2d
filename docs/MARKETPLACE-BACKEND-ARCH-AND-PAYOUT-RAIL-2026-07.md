# Wellness Designer — Marketplace Backend Architecture & Split-Payout Rail

**Author:** Cowork (for Vic Bhatoolaul / PPWellness)
**Date:** 2026-07-10 · **REVISED 2026-07-15** (see revision note)
**Repo:** `ppw-designer-2d` (the Designer)
**Status:** Architecture + research only. No code built, no signups, no spend.

> ### ⚠️ REVISION NOTE — 2026-07-15 (read this)
> **MIPS 1BMV is OFF the table.** MCB/MIPS have now confirmed **in writing**
> (Sabrina Laval-Venkatachellum, official): *"The bank does not hold the necessary
> licence to support marketplace solutions with automatic split settlements between
> independent merchants."* The prior lead recommendation (§0 + Part B v1) is **dead**.
> Part B has been fully re-written below (see **Part B — REVISED**). MIPS **Essential**
> (single-merchant gateway) still works for PPW's *own* collection — that turns out to
> be central to the new recommendation. The §0 summary below reflects the revised call.
**Purpose:** Give Claude Code an implementation-ready spec for an Amazon-heavy,
multi-merchant marketplace where one customer makes a **single payment** that is
**split-paid out to many merchants** (minus PPW commission), plus an Amazon-style
self-serve product-listing flow — and pick the **payout rail** that actually works
from Mauritius now that Stripe Connect and PayPal are off the table.

---

## 0. Decision summary (read this first) — REVISED 2026-07-15

**Model (decided by Vic):** One cart → many merchants → **one** customer charge →
PPW captures → money reaches each merchant, PPW keeps commission. Payout **speed to
merchants matters**. A second listing path (merchant lists a product, Amazon-style)
sits alongside the 2D room-designer path.

**The real blocker (reframed):** It is **not** that PPW needs its own licence. The
standard safe structure is *"a licensed provider holds and splits the funds, so the
platform stays out of regulatory scope."* The problem is that **no licensed provider
in Mauritius will do that split to independent merchants**: MCB/MIPS have confirmed
they lack the licence; **Peach's marketplace/aggregation product is South-Africa-only**
(in MU it does *direct* single-merchant settlement + a Payouts API); Rapyd only
*disburses* into MU (bank transfer) and is heavy. So provider-side split has no MU
executor. **The workable paths therefore avoid regulated split-settlement entirely.**

**Re-ranked recommendation (Part B — REVISED):**

1. **★ PRIMARY — "PPW-as-Principal" (Reseller / Seller-of-Record).** PPW collects the
   **full** basket through its **own single-merchant gateway** (MIPS **Essential** —
   already confirmed working — or Peach MU direct). PPW is the seller; merchants are
   its **suppliers**, paid by **bulk bank transfer** (MCB Bulk Payment, already
   scaffolded in-repo) or **Peach Payouts API**. No regulated split, no marketplace
   licence — PPW is moving *its own* money to *its own* suppliers. Keeps the
   one-basket/one-payment Amazon UX. **⚠ Legal/tax checks flagged in Part B §B5.**
2. **★ FAST PARALLEL / FALLBACK — Referral-commission model.** Merchants run their
   **own** checkout and collect their **own** money; PPW earns a tracked attribution
   commission (`designer_referrals` table **already exists** in-repo). Zero payment
   licence, zero VAT-on-gross, fastest to launch — but breaks the single-payment UX
   (customer pays each merchant / clicks out). Good bridge while §1's structuring is
   confirmed with a lawyer.
3. **SCALE-LATER — Offshore split infra** (Mangopay / Rapyd / Payoneer / ConnectPay)
   with PPW as a foreign-structured entity. Real split/sub-accounts, but built for
   EU/global; needs an offshore entity, KYB, cross-border FX to pay MU merchants.
   Only if §1/§2 prove insufficient at scale.
- **Ruled out:** MIPS 1BMV / MCB split (confirmed no licence), Peach marketplace
  aggregation (SA-only), Stripe Connect (no MU), PayPal Marketplaces (restricted MU),
  Paystack (no MU), Flutterwave payout-subaccounts (NGN-only), pure MoR like
  Paddle/Lemon Squeezy (pay **one** account, can't split to independent sub-merchants).

**Backend impact:** minimal. Under §1 the existing `orders` / `order_items` /
`payout_queue` / ledger model is unchanged — the "split" simply becomes **internal
supplier settlement** (PPW→supplier) rather than **regulated split-settlement**
(buyer→independent merchant). Same tables, cleaner legal footing.

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

# PART B — REVISED: Split-Payout Rail Research & Recommendation (2026-07-15)

## B1. What changed and the reframed constraint
MCB/MIPS confirmed **in writing** they cannot support automatic split settlements
between independent merchants (no licence). Combined with the earlier exclusions,
**every provider-side split option for a MU-domiciled platform is now closed:**
- **Stripe Connect** — not available in MU. **PayPal Marketplaces** — restricted in MU.
- **MIPS 1BMV / MCB split** — confirmed **no licence** (2026-07-15).
- **Peach Payments marketplace/aggregation** — **South-Africa-only**; in MU Peach does
  *direct* single-merchant settlement + MauCAS + a **Payouts** product (disburse to any
  bank account), **not** licensed buyer→independent-merchant split.
- **Rapyd** — *disburses* into MU (bank transfer) but collection is thin and the
  contract/KYB is heavy; split is a global-entity product, not a MU-local one.

**Regulatory reframe (must-verify, not legal advice):** Mauritius has **two** regimes —
(1) **Bank of Mauritius**, under the **National Payment Systems Act 2018**, licenses
**domestic** payment service providers / payment intermediaries (the licence MCB says
it lacks for this); (2) the **FSC Payment Intermediary Services (PIS) licence**, which
is **cross-border only** (clients *outside* Mauritius) — so PIS does **not** help pay
local MU merchants. The standard "stay-out-of-scope" pattern (a licensed provider holds
& splits) has **no MU provider to execute it**. Therefore the recommendation pivots to
structures that **don't require regulated split-settlement at all.**

## B2. Provider re-verification matrix

| Provider | MU merchants? | Buyer→**independent-merchant** split in MU? | Useful role now | Verdict |
|---|---|---|---|---|
| **MIPS / MCB (1BMV)** | Yes (native) | **NO — confirmed in writing, no licence** | MIPS **Essential** single-merchant gateway for **PPW's own** collection | Split ❌ / Collection ✅ |
| **Peach Payments** | **Yes** (KE, MU, ZA) | **NO — marketplace aggregation is ZA-only**; MU = direct settlement | MU **collection** (MauCAS, cards, daily settlement) + **Payouts API** to disburse to any bank a/c | Split ❌ / Collect+Payout ✅ |
| **Rapyd** | Disburse-only into MU (bank transfer) | Split is a global sub-account product, **not MU-local**; needs entity + KYB | Cross-border payout if PPW goes offshore | Heavy / later |
| **DPO Pay** | Yes (strong MU presence) | **NO** documented marketplace split | Collection backup | Split ❌ |
| **Flutterwave** | Weak/unconfirmed MU | Split exists but **payout subaccounts NGN-only** | — | ❌ |
| **Cellulant** | Broad (35 mkts) | Enterprise; MU split undocumented, slow to stand up | — | ❌ (not fast) |
| **Paystack** | **No MU** | n/a | — | ❌ |
| **Mangopay / ConnectPay** | EU-licensed EMIs | Real split, but EU-centric; PPW would need EU/offshore entity | Scale-later infra | Later |
| **Payoneer** | Global payee network | Not a split-at-checkout tool; good for cross-border **payout** to merchants | Offshore payout leg | Later |
| **MoR (Paddle / Lemon Squeezy / PayPro)** | Global MoR | **NO** — pays **one** account; can't split to independent sub-merchants; physical-goods weak | Only if PPW sole seller of digital goods | ❌ for this model |

## B3. The three viable paths (re-ranked)

### ★ Option 1 — PPW-as-Principal (Reseller / Seller-of-Record) — RECOMMENDED
- **How:** PPW collects the **full basket** on its **own single-merchant gateway**
  (MIPS **Essential**, already confirmed working; Peach MU is a drop-in alternative).
  There is **one merchant of record — PPW.** PPW then settles each supplier
  (the "merchants") by **bulk bank transfer** (MCB Bulk Payment — already scaffolded)
  or **Peach Payouts API**.
- **Why it's legal-workable:** no buyer→independent-merchant split occurs, so **no
  marketplace/payment-intermediary licence is triggered** — PPW is simply paying its
  own suppliers. It **keeps the one-basket / one-payment Amazon UX.**
- **Backend fit:** near-perfect. `orders` / `order_items` / `payout_queue` / the new
  `payout_ledger` all stand; the "split" is re-labelled **internal supplier
  settlement**. `disburseViaRail('mcb_bulk' | 'peach_payout')` is the only adapter to
  write.
- **Speed:** supplier payout speed = your batch cadence (daily/weekly) or near-real-time
  via Peach Payouts. You control it.

### ★ Option 2 — Referral / Attribution Commission — FAST PARALLEL / FALLBACK
- **How:** merchants keep their **own** checkout and collect their **own** money; PPW
  tracks the referral and **invoices a commission** (or merchants pre-load credit).
- **Why:** **zero** payment-facilitator exposure, **zero** VAT-on-gross, fastest to
  launch, and the **`designer_referrals` table + Pattern-C attribution already exist
  in-repo.**
- **Trade-off:** breaks single-payment UX (customer pays each merchant separately or
  clicks out); commission reconciliation + trust that merchants honour tracking.
- **Use as the bridge** while Option 1's tax/legal structuring is confirmed.

### Option 3 — Offshore split infrastructure — SCALE-LATER
- Mangopay / Rapyd / ConnectPay / Payoneer do real split/sub-accounts, but assume an
  EU/global-structured entity and cross-border FX to reach MU merchants. Real cost,
  KYB, and FX. Only justified if Options 1–2 cap out at scale. (FSC PIS licence is
  cross-border-only, so it would fit an offshore-facing structure — but not paying
  local merchants.)

## B4. Recommended rollout
1. **Now:** build on **Option 1**. Confirm MIPS **Essential** (or Peach MU) collection
   for PPW as sole merchant of record; wire supplier settlement through the existing
   `payout_queue` → `disburseViaRail('mcb_bulk')`, adding **Peach Payouts API** as the
   faster disbursement adapter. All behind `PAYOUT_DISBURSE_ENABLED`.
2. **In parallel / immediately shippable:** turn on **Option 2** for any merchant who
   prefers to run their own checkout — it's already 80% built (`designer_referrals`).
3. **Defer Option 3** until volume + margin justify an offshore entity.

## B5. ⚠️ Legal / licensing / tax checks — VERIFY WITH A MU ACCOUNTANT + LAWYER
*(This is a founder's checklist, **not legal advice**. Vic must confirm each with a
qualified Mauritian professional before launch — good ammunition for the MIPS meeting.)*

For **Option 1 (PPW-as-Principal):**
1. **VAT-as-deemed-supplier:** MU law can **deem the platform the supplier for VAT**
   when it controls terms / authorises payment / controls delivery. Under Option 1 PPW
   *is* the seller, so expect to **charge 15% VAT on the GROSS basket** and let
   suppliers invoice PPW net (PPW reclaims input VAT). Confirm treatment.
2. **VAT registration threshold:** compulsory at **MUR 3,000,000** annual taxable
   turnover (lowered from MUR 6M on **1 Oct 2025**). PPW's turnover = **gross sales**,
   not commission — this threshold arrives fast. Confirm timing + registration.
3. **Not payment intermediation:** confirm that "collect in PPW's name → pay own
   suppliers" is **not** deemed unlicensed payment-intermediary activity under NPSA
   2018 (it should not be — no third-party funds are held on behalf of independent
   merchants — but get it in writing).
4. **Contracts:** merchant agreements must read as **reseller / supply** contracts
   (PPW buys/resells), **not** "marketplace facilitation" contracts.
5. **Liability shift:** as seller-of-record, **consumer protection, returns, refunds,
   warranty and product liability sit with PPW.** Price the risk; align the refund
   clawback flow (Part A §A5).
6. **Import VAT** if any supplier stock is imported in PPW's name (15% at import,
   recoverable as input credit under the local-stock model).

For **Option 2 (Referral):**
7. Confirm the commission income is ordinary **service revenue** (VAT on the commission
   only) and that PPW is **not** deemed the supplier (it must **not** control
   payment/terms/delivery, or it risks being pulled back into deemed-supplier VAT).
8. Ensure no "collection on behalf of" mechanic creeps in (that would re-trigger the
   payment-intermediary question).

## B6. Questions for Vic to raise at the MIPS meeting
- Can MIPS **Essential** support PPW as **sole merchant of record** collecting full
  multi-item baskets (yes — that's just single-merchant), and what are the fees?
- Does MIPS offer a **disbursement / Payouts API** (to pay suppliers), or is MCB
  **Bulk Payment** the route?
- Get written confirmation of exactly **which licence** is missing and whether **any**
  MIPS/MCB product (present or roadmap) could ever do compliant split — so the door is
  documented as closed (or dated).
- Ask MIPS who, in the MU market, **does** hold a split-settlement licence, if anyone.

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

**Revision (2026-07-15) — regulatory / structuring / provider re-verification:**
- [Bank of Mauritius — National Payment Systems Act 2018](https://www.bom.mu/about-bank/legislations/national-payment-systems-act-2018) · [NPSA regulations public notice](https://www.bom.mu/media/media-releases/public-notice-bank-mauritius-issues-regulations-under-national-payment-systems-act-2018) · [Bowmans — NPSA key features](https://bowmanslaw.com/insights/mauritius-national-payment-systems-regulations-key-features/)
- [FSC Payment Intermediary Services (PIS) licence — cross-border only](https://renesisfinancial.com/structures-vehicles/licence/payment-intermediary-services-licence/) · [Renesis — Payment Services Licence guide 2026](https://renesisfinancial.com/structures-vehicles/licence/payment-service-licence-in-mauritius/)
- [Peach Payments — Marketplaces](https://www.peachpayments.com/industry/marketplaces/) · [Payouts (real-time to any bank account)](https://www.peachpayments.com/products/payouts/) · [Daily settlements (KE/MU/ZA; aggregation ZA-only)](https://www.peachpayments.com/scale/daily-settlements/) · [MauCAS integration](https://platformafrica.com/2025/07/14/peach-payments-integrates-maucas-to-empower-online-merchants-to-offer-a-range-of-payments-on-e-commerce-checkout/)
- [Rapyd — Disburse (MU = bank transfer)](https://docs.rapyd.net/en/rapyd-disburse.html) · [Marketplaces](https://www.rapyd.net/solutions/industries/marketplaces/)
- [Mauritius VAT — deemed-supplier / marketplace facilitator + MUR 3M threshold](https://globallawexperts.com/mauritius-vat-digital-services-2026/) · [MRA — Simplified VAT registration](https://www.mra.mu/index.php/eservices1/vat-eservices/simplified-vat-registration) · [Seller-of-Record explainer](https://passportglobal.com/blog/seller-of-record-an-easier-solution-to-international-tax-compliance-for-ecommerce)
- [Payneteasy — how marketplaces handle split payouts (structuring reference)](https://payneteasy.com/blog/how-marketplaces-handle-split-payments-and-payouts-to-sellers)
