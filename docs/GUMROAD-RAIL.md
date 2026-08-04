# Gumroad interim rail — marketplace checkout

> Built 2026-08-04 on `feat/phase0-money-path-2026-08-04`. Gumroad replaces
> PayPal as the LIVE direct-sale rail (the PayPal account is banned — its
> code stays in the repo, env-gated off). Binding skill:
> `PPW-Second-Brain/06-Roadmap/skills/gumroad-gateway-build.md`.
> Account: `victorix08` (`victorcassius.office@gmail.com`).

## How it works (as built)

```
Buyer → /marketplace/checkout
  → POST /api/gumroad/create-order
      • server re-prices the cart (repriceCart — client amounts advisory)
      • converts the cart total to USD minor units (indicative fallback
        rate from src/lib/fx.ts, disclosed in the response + on the page)
      • writes a PENDING orders row (rail 'gumroad', status 'pending',
        expected USD total + cart snapshot in raw_payload)
      • returns the PWYW checkout URL:
        <PRODUCT_URL>?price=<usd>&wanted=true&order_ref=<ref>&email=<buyer>
  → browser saves the orderRef to localStorage and redirects to Gumroad
Gumroad checkout (USD, PWYW price pre-filled)
  → SALE ping → POST /api/gumroad/ping   (account-level Ping URL)
      • routed by product_id (other products on the account = safe no-op)
      • sale VERIFIED server-side via GET /v2/sales/:id with
        GUMROAD_ACCESS_TOKEN (pings are unsigned = untrusted)
      • paid USD >= expected USD → order 'captured' → order_items →
        buyer email → payouts (5%/95%) → referrals (idempotent chain)
      • paid < expected (buyer lowered the PWYW price) → 'underpaid',
        NOT fulfilled — appears in admin for manual follow-up
  → buyer redirected to /order/gumroad-return → /order/track/:ref?rail=gumroad
      • "Confirming your payment…" state, polls every 5 s until captured,
        then clears the cart
Daily cron /api/cron/gumroad-reconcile
      • recovers sales whose ping never landed (matches order_ref in
        url_params via GET /v2/sales)
      • expires pending orders older than 48 h ('failed' — nothing charged)
      • needed because Gumroad NEVER pings refunds/cancellations
```

Why PWYW: Gumroad's API cannot create products or set prices
(`POST/PUT /v2/products` return 404 by design), so a pay-what-you-want
product with the exact cart total pre-filled via `?price=` is the only
dynamic-total mechanism. The buyer CAN edit the price down to the product
minimum — that is why the webhook enforces `paid >= expected` and holds
underpaid orders.

## Vic setup steps (in order — LOGIN chain is N/A, this is guest checkout)

1. **Account floor** (once, skill §2): payout method = MCB bank (MUR, SWIFT
   `MCBLMUMU`), NOT PayPal; Stripe identity verification complete (payouts
   don't release while pending); note the $100 MUR payout minimum.
2. **Create the product** — type: **Digital product** (NOT membership; this
   is a one-off order). Name: `PPW Designer Order`. Permalink: set a human
   one, e.g. `/l/ppw-designer-order`.
3. **Pricing** — turn **pay-what-you-want ON** with **minimum = $1**.
   (This product is the exception to the skill's PWYW-off rule — PWYW *is*
   the dynamic-total mechanism here.) Re-check PWYW stays ON after any
   later price edit.
4. **Redirect after purchase** — set the custom redirect URL to
   `https://designer.ppwellness.co/order/gumroad-return`.
5. **Licence keys OFF** (no paste field in the app — keys would be a
   support ticket per sale, skill §4).
6. **Discover OFF** — Share → Category → clear it. A category left on
   "Other" silently costs 30% flat instead of 10% + 50¢ (skill §5.4).
   Check this on every save.
7. **Refund policy** — set explicitly (PPW default: no refunds for
   marketplace orders; the default 30-day money-back guarantee is NOT
   intended). Physical fulfilment is by the merchant.
8. **Read the product id** from the labelled block in the product editor
   ("Use your product ID to verify licenses through the API") — never
   guess it from page base64 (skill §5.9).
9. **Vercel env vars** (project `ppw-designer-2d`, production):
   - `GUMROAD_ACCESS_TOKEN` — Settings → Advanced → Applications → create
     app → Generate access token. Vic copies it into Vercel himself;
     agents never write live credentials to disk.
   - `GUMROAD_DESIGNER_PRODUCT_ID` — from step 8.
   - `GUMROAD_DESIGNER_PRODUCT_URL` — e.g.
     `https://victorix08.gumroad.com/l/ppw-designer-order`.
   - `VITE_GUMROAD_ENABLED=true` — flips the checkout page to the Gumroad
     rail (client-side; needs a redeploy to take effect).
10. **Apply migration 0028** in the Neon dashboard
    (`api/_db/migrations/0028_gumroad_rail.sql` — adds enum values
    `payment_rail='gumroad'`, `payment_status='underpaid'`). Until applied,
    create-order answers 503 "gumroad rail not migrated".
11. **Deploy**, then verify the webhook route is live:
    `curl -s -X POST https://designer.ppwellness.co/api/gumroad/ping` →
    must answer JSON (400/503), NOT 404.
12. **Ping URL** — Settings → Advanced → Ping. **Record the existing value
    first** (skill §2). ONE Ping URL per account: if another PPW app
    already owns it, that backend must forward Designer pings instead.
    If free, set it to `https://designer.ppwellness.co/api/gumroad/ping`.
    Use "Send test ping" to smoke it. NEVER set the Ping URL before step 11
    passes (pings against a backend without the route 404 silently).

### Do-not-publish-until checklist (skill §0: never publish before the unlock is live)

- [ ] Migration 0028 applied (Neon dashboard)
- [ ] All 3 `GUMROAD_*` env vars set in Vercel prod + redeployed
- [ ] `POST /api/gumroad/ping` answers JSON (not 404) on prod
- [ ] Ping URL set + "Send test ping" reaches the endpoint (Vercel logs)
- [ ] Redirect-after-purchase URL set to `/order/gumroad-return`
- [ ] Discover category cleared; PWYW ON, min $1; licence keys OFF;
      refund policy set
- [ ] `VITE_GUMROAD_ENABLED=true` set
- [ ] Re-read the publish button after every save — Gumroad can flip
      draft → live on save (skill §5.10)
- [ ] Test buy (Vic): pay the pre-filled price → order flips captured on
      /order/track within ~2 min (test sales queue NO merchant payout —
      payout_queue must stay empty); then a second test lowering the PWYW
      price → order shows 'underpaid' and is NOT fulfilled

## USD note (skill §9)

Gumroad checkout is **USD only** — buyers see an approximate local price
but are charged in USD. The checkout page and the create-order response
both disclose that the MUR→USD conversion is **indicative** (server
fallback rate, currently 1 USD = 45 MUR in `src/lib/fx.ts`). The orders
row keeps the CART currency/total for tracking + payouts; the expected
USD figure lives in `raw_payload.expectedUsdMinor`. Do not promise exact
MUR totals on the Gumroad leg.

## Fees (skill §8)

10% + $0.50 Gumroad + 2.9% + $0.30 processing ≈ `gross × 0.871 − $0.80`.
Discover sales are 30% flat — keep Discover OFF. Payout: MUR only, $100
minimum, 7-day hold, Tuesday payout day.

## Operational notes

- **Refunds/cancellations are never pinged.** The daily
  `/api/cron/gumroad-reconcile` (09:30 UTC) recovers lost pings and
  expires abandoned pending orders after 48 h. Refunds after capture are
  visible only via `GET /v2/sales/:id` (`refunded` flag) — manual for now.
- **Underpaid orders** (`payment_status='underpaid'`): buyer edited the
  PWYW price below the cart total. Not fulfilled, no payouts recorded.
  Resolution is manual: refund in Gumroad, or invoice the difference.
- **Test sales** (Vic buying his own product, $0 actually collected)
  capture normally (`testSale: true` in `raw_payload`), record
  order_items and send the buyer email — so the smoke test verifies the
  chain end-to-end — but **merchant payouts and referral commissions are
  SKIPPED**: no `payout_queue` row is created for money that was never
  collected.
- **Rail rollback**: unset `VITE_GUMROAD_ENABLED` (client) and the
  `GUMROAD_*` vars (server → 503). Enum values from 0028 stay behind,
  inert (see the rollback file).
