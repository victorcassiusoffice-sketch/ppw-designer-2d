-- V4 W0.D.9 rollback sibling.
-- Operator-invoked via `psql -f` per the W0.D.3 drill.
-- See PPW-Second-Brain/06-Roadmap/v4/NEON-BRANCH-WORKFLOW.md.

-- 1. Drop the partial watermark index first.
DROP INDEX IF EXISTS products_supplier_rating_watermark_idx;

-- 2. Drop the watermark column.
ALTER TABLE products DROP COLUMN IF EXISTS supplier_rating_refreshed_at;

-- 3. Bookkeeping (run as a separate statement after the above succeed):
--      DELETE FROM schema_migrations WHERE version = '0011_supplier_rating_backfill';
