-- Rollback for 0028_merchant_onboarding.sql.
-- See _template_rollback.sql header for the operator-invoked drill workflow.

ALTER TABLE IF EXISTS merchants DROP COLUMN IF EXISTS go_live_at;
ALTER TABLE IF EXISTS merchants DROP COLUMN IF EXISTS payout_method;
ALTER TABLE IF EXISTS merchants DROP COLUMN IF EXISTS kyc_status;
ALTER TABLE IF EXISTS merchants DROP COLUMN IF EXISTS onboarding_step;
-- Drop the ENUM LAST (after the column that references it is gone).
DROP TYPE IF EXISTS merchant_kyc_status;

DELETE FROM schema_migrations WHERE version = '0028_merchant_onboarding';
