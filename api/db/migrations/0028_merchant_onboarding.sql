-- Phase 5 (BACKEND-RUN-ORDER-2026-06-11) — merchant self-serve onboarding state.
--
-- The "merchant live in ~1 hour" scale lever (C5). Adds onboarding-state
-- columns to the existing `merchants` table so a new merchant's progress
-- (step, KYC-lite status, chosen payout method, go-live timestamp) is
-- machine-trackable. KYC-lite = business name + contact + payout method
-- captured (no document-heavy flow).
--
-- Additive + reversible (Neon single-branch = every write hits prod):
--   - All new columns are nullable or defaulted; no existing data rewritten.
--   - TYPE creation guarded by a DO $$ IF NOT EXISTS block (re-run safe).
--   - `payout_queue` shape is NOT touched (Phase 5 reads it, never migrates it).
--   - No money/order/attribution table altered.
-- Rollback: 0028_merchant_onboarding_rollback.sql.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'merchant_kyc_status') THEN
    CREATE TYPE merchant_kyc_status AS ENUM ('none', 'lite_submitted', 'verified');
  END IF;
END
$$;

ALTER TABLE merchants ADD COLUMN IF NOT EXISTS onboarding_step INTEGER NOT NULL DEFAULT 0;
ALTER TABLE merchants ADD COLUMN IF NOT EXISTS kyc_status merchant_kyc_status NOT NULL DEFAULT 'none';
ALTER TABLE merchants ADD COLUMN IF NOT EXISTS payout_method VARCHAR(40);
ALTER TABLE merchants ADD COLUMN IF NOT EXISTS go_live_at TIMESTAMP WITH TIME ZONE;
