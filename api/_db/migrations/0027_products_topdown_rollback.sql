-- Rollback for 0027_products_topdown.sql.
DROP INDEX IF EXISTS products_topdown_status_idx;

ALTER TABLE products
  DROP COLUMN IF EXISTS topdown_image_url,
  DROP COLUMN IF EXISTS topdown_status,
  DROP COLUMN IF EXISTS topdown_source_url,
  DROP COLUMN IF EXISTS topdown_generated_at,
  DROP COLUMN IF EXISTS topdown_error;
