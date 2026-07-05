-- Sims-Parity DT-26 rollback. Operator-invoked via `psql -f`.

BEGIN;

DROP INDEX IF EXISTS products_use_gltf_idx;
ALTER TABLE products DROP COLUMN IF EXISTS use_gltf;

COMMIT;

-- Post-rollback bookkeeping:
--   DELETE FROM schema_migrations WHERE version = '0025_products_use_gltf';
