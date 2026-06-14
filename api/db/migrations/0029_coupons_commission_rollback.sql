-- Rollback for 0029_coupons_commission.sql.
-- See _template_rollback.sql header for the operator-invoked drill workflow.

DROP INDEX IF EXISTS commission_ledger_status_idx;
DROP INDEX IF EXISTS coupons_merchant_idx;
DROP TABLE IF EXISTS commission_ledger;
DROP TABLE IF EXISTS coupons;
-- Drop the ENUMs LAST (after the columns that reference them are gone).
DROP TYPE IF EXISTS commission_status;
DROP TYPE IF EXISTS coupon_type;

DELETE FROM schema_migrations WHERE version = '0029_coupons_commission';
