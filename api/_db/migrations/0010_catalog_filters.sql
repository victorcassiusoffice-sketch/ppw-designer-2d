-- V4 W0.D.2 — catalog filters foundation (DA §02 + ME §03 refinements).
--
-- Lands the catalog-filter columns the M9.B.5 merchant page + the
-- W0.5.B.7 customer catalog sidebar both consume:
--   eco_cert_level   ENUM 4-tier (none / self-declared / third-party-claimed
--                    / verified-certified) per V4-DA-1 CLOSED.
--   in_stock_qty     non-negative integer, default 0 (cuts out-of-stock from
--                    the catalog filter index entirely via partial index).
--   retired_at       nullable timestamptz (soft-delete pattern per DA §02.3 —
--                    M9.B.4 DELETE writes here; M9.B.4 partial-unique-SKU
--                    follow-up will allow reuse of retired SKUs).
--   supplier_rating  nullable INT 1-5 (denormalised from merchants for index
--                    efficiency; W0.D.9 incremental backfill cron will refill
--                    on a watermark; CHECK NOT VALID for now so existing rows
--                    survive — VALIDATE happens once backfill completes).
--
-- Plus the composite partial catalog-filter index DA §02.1 specified:
--   (status, eco_cert_level, supplier_rating DESC NULLS LAST, price_minor)
--   WHERE in_stock_qty > 0 AND retired_at IS NULL.
-- B-tree equality precedes range; predicates moved into the partial WHERE
-- so the index stays tight (no out-of-stock + no retired rows).
--
-- Plus the merchants.slug regex tightening per V4-DA-2 + ME §03.4 — added
-- as CHECK ... NOT VALID so the ~12 stale test merchants with non-conformant
-- slugs don't block the migration. A follow-up will VALIDATE after slugs
-- are cleaned.
--
-- Plus the customer_identities VIEW per DA §02.2 — defers V4-TL-1 customers
-- table indefinitely by surfacing email-keyed identity directly from orders.
-- CREATE OR REPLACE per ME §03.3 so re-runs on a fresh branch are safe.
--
-- No literal BEGIN/COMMIT per ME §03.1 (Neon HTTP driver auto-wraps each
-- statement). Every statement uses IF NOT EXISTS / DO $$ IF NOT EXISTS / OR
-- REPLACE so the whole file is re-runnable on a branch.
--
-- Rollback sibling: 0010_catalog_filters_rollback.sql (operator-invoked via
--                   psql -f, NOT auto-applied by scripts/migrate.ts thanks
--                   to the W0.D.3 isApplicableMigration filter).
-- Branch-then-prod drill: PPW-Second-Brain/06-Roadmap/v4/NEON-BRANCH-WORKFLOW.md.

-- ─────────────────────────────────────────────────────────────────────
-- 1. eco_cert_level ENUM (V4-DA-1 CLOSED).
-- ─────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'eco_cert_level') THEN
    CREATE TYPE eco_cert_level AS ENUM (
      'none',
      'self-declared',
      'third-party-claimed',
      'verified-certified'
    );
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────
-- 2. products column additions (all additive, all idempotent).
-- ─────────────────────────────────────────────────────────────────────
ALTER TABLE products ADD COLUMN IF NOT EXISTS eco_cert_level eco_cert_level NOT NULL DEFAULT 'none';
ALTER TABLE products ADD COLUMN IF NOT EXISTS in_stock_qty   INTEGER         NOT NULL DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS retired_at     TIMESTAMPTZ;
ALTER TABLE products ADD COLUMN IF NOT EXISTS supplier_rating INTEGER;

-- ─────────────────────────────────────────────────────────────────────
-- 3. supplier_rating bounds (1-5 inclusive; NULL allowed; NOT VALID so
--    pre-existing rows with NULL pass without scanning).
-- ─────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'products_supplier_rating_bounds'
  ) THEN
    ALTER TABLE products
      ADD CONSTRAINT products_supplier_rating_bounds
      CHECK (supplier_rating IS NULL OR supplier_rating BETWEEN 1 AND 5) NOT VALID;
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────
-- 4. Composite partial catalog-filter index.
-- ─────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS products_catalog_filter_idx
  ON products (status, eco_cert_level, supplier_rating DESC NULLS LAST, price_minor)
  WHERE in_stock_qty > 0 AND retired_at IS NULL;

-- ─────────────────────────────────────────────────────────────────────
-- 5. merchants.slug kebab-case CHECK (NOT VALID; cleanup + VALIDATE later).
-- ─────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'merchants_slug_kebab_ck'
  ) THEN
    ALTER TABLE merchants
      ADD CONSTRAINT merchants_slug_kebab_ck
      CHECK (slug ~ '^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$') NOT VALID;
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────
-- 6. customer_identities VIEW (defers V4-TL-1 customers table per DA §02.2).
--    Email-keyed identity from orders — analytics / CRM read here instead
--    of from a dedicated customers table.
-- ─────────────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW customer_identities AS
SELECT
  customer_email                              AS email,
  MIN(created_at)                             AS first_seen_at,
  MAX(created_at)                             AS last_seen_at,
  COUNT(*)::INT                               AS order_count,
  COALESCE(SUM(total_minor), 0)::BIGINT       AS total_spent_minor,
  MODE() WITHIN GROUP (ORDER BY currency)     AS preferred_currency
FROM orders
WHERE customer_email IS NOT NULL AND customer_email <> ''
GROUP BY customer_email;
