-- Sims-Parity DT-01 rollback sibling.
-- Operator-invoked via `psql -f` per the W0.D.3 drill.
-- See PPW-Second-Brain/06-Roadmap/v4/NEON-BRANCH-WORKFLOW.md.

BEGIN;

-- ─────────────────────────────────────────────────────────────────────
-- 1. Drop partial index + FK on products before dropping columns.
-- ─────────────────────────────────────────────────────────────────────
DROP INDEX IF EXISTS products_capture_scale_lock_idx;
ALTER TABLE products DROP CONSTRAINT IF EXISTS products_capture_scale_lock_fk;

-- ─────────────────────────────────────────────────────────────────────
-- 2. Drop products columns added by the forward migration.
-- ─────────────────────────────────────────────────────────────────────
ALTER TABLE products DROP COLUMN IF EXISTS capture_scale_lock_id;
ALTER TABLE products DROP COLUMN IF EXISTS photo_alpha_clean;

-- ─────────────────────────────────────────────────────────────────────
-- 3. Drop scale-lock indexes (idempotent).
-- ─────────────────────────────────────────────────────────────────────
DROP INDEX IF EXISTS pcsl_active_idx;
DROP INDEX IF EXISTS pcsl_merchant_idx;

-- ─────────────────────────────────────────────────────────────────────
-- 4. Drop the scale-lock table.
-- ─────────────────────────────────────────────────────────────────────
DROP TABLE IF EXISTS product_capture_scale_locks;

-- ─────────────────────────────────────────────────────────────────────
-- 5. Drop the capture_path ENUM (no dependent tables remain).
-- ─────────────────────────────────────────────────────────────────────
DROP TYPE IF EXISTS capture_path;

COMMIT;

-- Post-rollback bookkeeping (run as a separate statement after COMMIT):
--   DELETE FROM schema_migrations WHERE version = '0024_capture_scale_locks';
