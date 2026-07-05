-- V4 W0.D.2 rollback sibling.
--
-- Operator-invoked via `psql -f` on a Neon branch ONLY. Drops every object
-- 0010_catalog_filters.sql created. After a rollback drill, run:
--   DELETE FROM schema_migrations WHERE version = '0010_catalog_filters';
-- so scripts/migrate.ts can re-apply a fixed forward migration on its next
-- run.
--
-- See PPW-Second-Brain/06-Roadmap/v4/NEON-BRANCH-WORKFLOW.md for the full
-- branch-then-prod drill.
--
-- Order: VIEW → CONSTRAINTs → INDEX → COLUMNs → ENUM type (reverse of forward).

-- 1. VIEW (must drop before any product/order column it depends on).
DROP VIEW IF EXISTS customer_identities;

-- 2. CHECK constraints (drop by name — both used IF NOT EXISTS DO blocks
--    on the forward path so duplicate-rollback is also safe).
ALTER TABLE merchants DROP CONSTRAINT IF EXISTS merchants_slug_kebab_ck;
ALTER TABLE products  DROP CONSTRAINT IF EXISTS products_supplier_rating_bounds;

-- 3. Composite catalog-filter index.
DROP INDEX IF EXISTS products_catalog_filter_idx;

-- 4. products columns (reverse-order of forward ALTER ADD COLUMNs).
ALTER TABLE products DROP COLUMN IF EXISTS supplier_rating;
ALTER TABLE products DROP COLUMN IF EXISTS retired_at;
ALTER TABLE products DROP COLUMN IF EXISTS in_stock_qty;
ALTER TABLE products DROP COLUMN IF EXISTS eco_cert_level;

-- 5. ENUM type (drops once no column references it).
DROP TYPE IF EXISTS eco_cert_level;

-- 6. Bookkeeping (run as a separate statement after the above succeed):
--      DELETE FROM schema_migrations WHERE version = '0010_catalog_filters';
