-- Phase 6 (BACKEND-RUN-ORDER-2026-06-11) — coupon/promo engine +
-- Pattern-C commission ledger.
--
-- `coupons`: promotions the cart-quote can validate + apply (percent or
-- fixed, platform-wide or merchant-scoped). The real K1 Pattern-C code is
-- a Vic-issued row at GATE-2 — this migration only provides the engine's
-- storage. Redemption is incremented by a completed order, never by a
-- quote (the redemptions column starts at 0).
--
-- `commission_ledger`: persists reconciliation state over the existing
-- designer_referrals click-attribution rows (no order link required) so a
-- referral's 5% commission line can transition pending → reconciled. The
-- /admin/k1-commission read-model computes lines from designer_referrals
-- and overlays this table's status by ref_code.
--
-- Additive + reversible (Neon single-branch = every write hits prod):
--   - ENUMs guarded by DO $$ IF NOT EXISTS blocks (re-run safe).
--   - Tables + indexes created idempotently (IF NOT EXISTS guards).
--   - NO change to orders / order_items / payout_queue / designer_referrals
--     shape, and the ?ref=ppw attribution mechanic is untouched.
-- Rollback: 0029_coupons_commission_rollback.sql.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'coupon_type') THEN
    CREATE TYPE coupon_type AS ENUM ('percent', 'fixed');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'commission_status') THEN
    CREATE TYPE commission_status AS ENUM ('pending', 'reconciled');
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS coupons (
  id BIGSERIAL PRIMARY KEY,
  code VARCHAR(60) NOT NULL UNIQUE,
  merchant_id BIGINT REFERENCES merchants(id) ON DELETE CASCADE,
  type coupon_type NOT NULL,
  value INTEGER NOT NULL,
  currency VARCHAR(3),
  min_subtotal INTEGER,
  starts_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE,
  max_redemptions INTEGER,
  redemptions INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS coupons_merchant_idx ON coupons(merchant_id);

CREATE TABLE IF NOT EXISTS commission_ledger (
  id BIGSERIAL PRIMARY KEY,
  ref_code VARCHAR(80) NOT NULL UNIQUE,
  order_id BIGINT REFERENCES orders(id) ON DELETE SET NULL,
  merchant_slug VARCHAR(120) NOT NULL,
  gross_minor INTEGER NOT NULL,
  commission_minor INTEGER NOT NULL,
  currency VARCHAR(8),
  status commission_status NOT NULL DEFAULT 'pending',
  reconciled_at TIMESTAMP WITH TIME ZONE,
  note TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS commission_ledger_status_idx ON commission_ledger(status, merchant_slug);
