-- V4 W0.D.9 — supplier_rating refresh watermark (per ETL §06.2).
--
-- Pairs with W0.D.2's products.supplier_rating column. Adds the
-- timestamp column that the refresh-supplier-rating cron at slot
-- 05:10 UTC uses to scan products in batches of LIMIT 1000 per
-- tick. Partial index on the watermark column (NULLS FIRST, only
-- live rows) makes the per-batch scan an index walk with an early
-- stop at the 7-day cutoff.
--
-- Rollback sibling: 0011_supplier_rating_backfill_rollback.sql.
-- Branch-then-prod drill: PPW-Second-Brain/06-Roadmap/v4/NEON-BRANCH-WORKFLOW.md.
-- No literal BEGIN/COMMIT per ME §03.1 (Neon HTTP auto-wraps).

-- ─────────────────────────────────────────────────────────────────────
-- 1. Watermark column (nullable; NULL = "never refreshed, run me first").
-- ─────────────────────────────────────────────────────────────────────
ALTER TABLE products ADD COLUMN IF NOT EXISTS supplier_rating_refreshed_at TIMESTAMPTZ;

-- ─────────────────────────────────────────────────────────────────────
-- 2. Partial watermark index: NULLs first, only live rows.
--    Supports `ORDER BY supplier_rating_refreshed_at NULLS FIRST LIMIT 1000`
--    as an index scan; the partial WHERE clause keeps the index tight
--    against the catalog's lifetime soft-deletion growth.
-- ─────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS products_supplier_rating_watermark_idx
  ON products (supplier_rating_refreshed_at NULLS FIRST)
  WHERE retired_at IS NULL;
