-- Rollback for 0026_designer_referrals.sql.
-- See _template_rollback.sql header for the operator-invoked drill workflow.

DROP INDEX IF EXISTS designer_referrals_design_idx;
DROP INDEX IF EXISTS designer_referrals_merchant_created_idx;
DROP TABLE IF EXISTS designer_referrals;
