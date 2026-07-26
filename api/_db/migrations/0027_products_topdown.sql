-- WD-2D top-down pipeline (2026-07-10) — merchant-product top-down asset cols.
--
-- The Runway `gen4_image` generator + deterministic footprint normaliser
-- writes a footprint-exact transparent PNG to Vercel Blob and records it
-- HERE, without clobbering the merchant's original uploaded photo
-- (image_url). The designer/catalog prefers topdown_image_url when present.
--
-- All columns nullable / defaulted → additive, no signup / product-insert
-- regression. Run BEFORE deploying the generator wiring.
-- Rollback sibling: 0027_products_topdown_rollback.sql.

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS topdown_image_url    VARCHAR(500),
  ADD COLUMN IF NOT EXISTS topdown_status       VARCHAR(20) NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS topdown_source_url   VARCHAR(500),
  ADD COLUMN IF NOT EXISTS topdown_generated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS topdown_error        TEXT;

-- Worklist index — only rows still eligible for generation.
CREATE INDEX IF NOT EXISTS products_topdown_status_idx
  ON products (topdown_status)
  WHERE topdown_status IN ('none', 'pending', 'failed');
