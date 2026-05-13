# Merchant schema — OMS Phase 1

Drizzle ORM, Postgres backend (Neon HTTP driver). Three tables:

```
                            ┌──────────────────────┐
                            │       admins         │
                            │----------------------│
                            │ id (PK)              │
                            │ clerk_user_id (UNIQ) │
                            │ email (UNIQ)         │
                            │ role  enum admin_role│
                            │ created_at           │
                            └──────────────────────┘

   ┌─────────────────────────────────────┐         ┌──────────────────────────────┐
   │             merchants               │ 1     n │    merchant_documents        │
   │-------------------------------------│◄────────│------------------------------│
   │ id (PK)                             │         │ id (PK)                      │
   │ slug (UNIQ)                         │         │ merchant_id  FK → merchants  │
   │ business_name                       │         │ doc_type enum merchant_document_type
   │ brand_name                          │         │ blob_url                     │
   │ contact_name                        │         │ uploaded_at                  │
   │ contact_email                       │         └──────────────────────────────┘
   │ contact_phone                       │
   │ country (ISO-2)                     │
   │ website                             │
   │ product_categories (CSV — Phase 2 →jsonb)
   │ estimated_monthly_volume            │
   │ referral_notes                      │
   │ stripe_connect_account_id           │
   │ status  enum merchant_status        │
   │ notes                               │
   │ created_at                          │
   │ updated_at  (trigger auto-touches)  │
   │ approved_at, approved_by            │
   │ rejected_at, rejected_reason        │
   └─────────────────────────────────────┘
```

## Enums

### `merchant_status`

Lifecycle from signup to live/terminal. Linear under normal flow; admin actions can short-circuit to `rejected` or `suspended` at any point.

```
pending_signup           initial insert; row exists but no Stripe call has happened yet
        │
        ▼
awaiting_kyc             EITHER: Stripe Connect Express account created, merchant
                         redirected to Stripe-hosted KYC
                         OR (MU-gated fallback): Stripe call skipped, manual followup
                         required. The merchant.notes column carries the reason.
        │
        ▼
kyc_complete             Stripe webhook reports `details_submitted=true` but
                         `charges_enabled=false`. Stripe wants more info from
                         the merchant before clearing them. We wait.
        │
        ▼
pending_admin_approval   Stripe webhook reports `charges_enabled=true`. Merchant
                         is sitting in Vic's /admin/merchants queue.
        │
        ├──► approved    Vic clicked Approve. approved_at + approved_by populated.
        │                Merchant emailed welcome.
        │
        └──► rejected    Vic clicked Reject with a reason. rejected_at +
                         rejected_reason populated. Merchant emailed the reason.

(any state) ──► suspended   Manual admin action (Phase 2: also via review auto-suspend).
```

### `merchant_document_type`

`distributor_agreement | invoice | business_registration | other`. Phase 1 ships the table + enum but doesn't yet provide an upload UI. Phase 2 adds the Blob upload step required by OMS §8.2 (fraud layer 3).

### `admin_role`

`super_admin | reviewer`. Phase 1 only distinguishes for future use; both roles can approve/reject in the current admin stub. The `admins` table is an additional allowlist beyond the hard-coded `victorcassius.office@gmail.com` + `victor@ppwellness.co` allowlist in `api/lib/adminAuth.ts`.

## Indexes

- `merchants_slug_idx` (UNIQUE) — slug lookup powers the future /suppliers/{slug} URLs.
- `merchants_contact_email_idx` — used to surface a friendly 409 on duplicate signup.
- `merchants_status_idx` — used by the admin queue (status IN ('pending_admin_approval')).
- `merchants_stripe_acct_idx` — used by the Stripe Connect webhook to look up the merchant for an inbound `account.updated` event.
- `merchant_documents_merchant_idx` — FK navigation.
- `admins_clerk_user_id_idx` (UNIQUE) — auth lookup.
- `admins_email_idx` (UNIQUE) — guards against duplicate admin rows with the same email.

## Triggers

- `merchants_touch_updated_at` — BEFORE UPDATE, sets `updated_at = NOW()`. The Drizzle `updateStatus` doesn't pass an `updatedAt` value; the trigger handles it.

## Why CSV not jsonb for `product_categories`?

Phase 1 keeps the columns close to the Drizzle migration to minimise the chance of a divergence. Postgres `text[]` would also work but Drizzle's array-type support is mildly opinionated and changes between releases. CSV is good enough for the Week 1 scope (read in `api/admin/merchants/list.ts` via `.split(',')`). Phase 2 migration `0002_*` will swap to jsonb once we have the broader catalog schema and want to do `WHERE category ?| array['ice_baths']`-style queries.

## Why no `email_log` / `audit_log` yet?

OMS Phase 2 §2.2 introduces the `audit_log` table for admin actions. Phase 1 logs to the function console only — good enough to debug the few test-merchant flows we'll see in week 1, but every merchant action must move into `audit_log` by Phase 2 §2.5 (approve action explicitly writes audit log).

## Why no `merchant_endpoints` yet?

OMS Phase 3 §3.2 introduces the `merchant_endpoints` table for the 4-endpoint API contract (products, inventory, shipping, order-confirm). Phase 1 has no inventory ingestion path yet.

## Forward references

- The `stripe_connect_account_id` column will be referenced by Phase 4 `orders` / `order_items` for payout routing.
- The `merchants.status='suspended'` value is used by Phase 8's review-auto-suspend cron (3 bad reviews → suspend, OMS §8.6).
