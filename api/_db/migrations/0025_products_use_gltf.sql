-- Sims-Parity DT-26 — products.use_gltf feature flag (procedural-only stub).
--
-- V8=NO blocks the $1,800 external 3D artist spend. This migration
-- adds the per-SKU `use_gltf` boolean that the eventual hero-mesh
-- swap (when V8 unblocks) will key on. Default FALSE so every
-- existing product stays on the procedural box path.
--
-- Rollback sibling: 0025_products_use_gltf_rollback.sql.

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS use_gltf BOOLEAN NOT NULL DEFAULT FALSE;

-- Partial index — only rows where use_gltf=true (i.e. the hero SKUs
-- once V8 unblocks). Keeps the catalog filter index light.
CREATE INDEX IF NOT EXISTS products_use_gltf_idx
  ON products (id)
  WHERE use_gltf = TRUE;
