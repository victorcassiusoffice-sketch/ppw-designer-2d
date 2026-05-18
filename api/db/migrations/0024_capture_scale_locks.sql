-- Sims-Parity DT-01 — capture scale-lock foundation.
--
-- Creates the audit-trail table that anchors every merchant product photo
-- to a HMAC-signed pixels-per-mm measurement minted via the 90-second
-- phone capture flow (CAP.08 → P2 plug-point in MASTER-DATA-FLOW.md).
--
-- Tables:
--   product_capture_scale_locks  — one row per accepted capture session.
--                                  Lives forever (audit). VC-2 invalidation
--                                  is a soft state via invalidated_at +
--                                  invalidation_reason — the row is never
--                                  deleted (HARD STOP: no permanent delete).
--
-- products column additions:
--   photo_alpha_clean       — gates GL1.04 (behind-item) vs GL1.04b
--                             (synthetic offset-below) shadow paths in
--                             the Konva renderer (V-GAME-INT-1).
--   capture_scale_lock_id   — FK to the active (non-invalidated) lock for
--                             this product. NULL = legacy / pre-capture row.
--                             SET NULL on lock delete (locks are never hard
--                             deleted in practice; the FK action is defensive).
--
-- VC-2 columns (auto-applied 2026-05-18):
--   invalidated_at          — TIMESTAMPTZ NULL. Filled when merchant edits
--                             dimensions_mm without re-running capture.
--                             DT-09 write-path enforces silent-edit refusal.
--   invalidation_reason     — short tag (e.g. 'merchant_dim_edit').
--
-- silhouette_bbox_px is stored JSONB-nullable on the lock row so the
-- Konva render path (DT-11 GL1.01b crop) can read it via FK without
-- denormalising onto products. Optional because v1 corner-tap may emit
-- a rough bbox; v2 auto-pose always emits a precise one (§2 MASTER-DATA-FLOW).
--
-- Conventions:
--   • Idempotent — every CREATE / ADD uses IF NOT EXISTS guards.
--   • No literal BEGIN/COMMIT (Neon HTTP driver auto-wraps each statement
--     per ME §03.1).
--   • gen_random_uuid() is built-in on Postgres ≥ 13 (Neon = 15+).
--   • All FKs to merchants(id) use BIGINT to match the existing convention
--     in 0004_product_catalog.sql even though merchants.id is SERIAL —
--     Postgres permits BIGINT → INTEGER PK references.
--
-- Rollback sibling: 0024_capture_scale_locks_rollback.sql.
-- Branch-then-prod drill: PPW-Second-Brain/06-Roadmap/v4/NEON-BRANCH-WORKFLOW.md.

-- ─────────────────────────────────────────────────────────────────────
-- 1. Capture path enum (the three progressive capture pipelines).
-- ─────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'capture_path') THEN
    CREATE TYPE capture_path AS ENUM (
      'a4-corner-tap',
      'aruco',
      'webxr-plane'
    );
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────
-- 2. product_capture_scale_locks — the audit row per accepted capture.
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS product_capture_scale_locks (
  scale_lock_id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id             BIGINT NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  path                    capture_path NOT NULL,
  pixels_per_mm           NUMERIC(10, 4) NOT NULL,
  rms_calibration_error   NUMERIC(10, 4) NOT NULL,
  hmac_signature          VARCHAR(128) NOT NULL,
  silhouette_bbox_px      JSONB,
  captured_at             TIMESTAMPTZ NOT NULL,
  invalidated_at          TIMESTAMPTZ,
  invalidation_reason     VARCHAR(80),
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Bounds — pixelsPerMm ∈ [0.3, 30] and rmsError ≤ 8 px (CapturePacket §2).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'pcsl_pixels_per_mm_bounds'
  ) THEN
    ALTER TABLE product_capture_scale_locks
      ADD CONSTRAINT pcsl_pixels_per_mm_bounds
      CHECK (pixels_per_mm >= 0.3 AND pixels_per_mm <= 30);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'pcsl_rms_bounds'
  ) THEN
    ALTER TABLE product_capture_scale_locks
      ADD CONSTRAINT pcsl_rms_bounds
      CHECK (rms_calibration_error >= 0 AND rms_calibration_error <= 8);
  END IF;

  -- invalidation_reason must accompany invalidated_at (and vice versa).
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'pcsl_invalidation_paired'
  ) THEN
    ALTER TABLE product_capture_scale_locks
      ADD CONSTRAINT pcsl_invalidation_paired
      CHECK (
        (invalidated_at IS NULL AND invalidation_reason IS NULL)
        OR
        (invalidated_at IS NOT NULL AND invalidation_reason IS NOT NULL)
      );
  END IF;
END $$;

-- Per-merchant lookup (Vic admin audit + DT-09 dim-edit guard).
CREATE INDEX IF NOT EXISTS pcsl_merchant_idx
  ON product_capture_scale_locks (merchant_id, created_at DESC);

-- Active-lock scan: rapid filter to non-invalidated rows per merchant.
CREATE INDEX IF NOT EXISTS pcsl_active_idx
  ON product_capture_scale_locks (merchant_id)
  WHERE invalidated_at IS NULL;

-- ─────────────────────────────────────────────────────────────────────
-- 3. products column additions — photo_alpha_clean + capture_scale_lock_id.
-- ─────────────────────────────────────────────────────────────────────
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS photo_alpha_clean BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS capture_scale_lock_id UUID;

-- FK with SET NULL on parent delete (defensive; locks are not hard-deleted).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'products_capture_scale_lock_fk'
  ) THEN
    ALTER TABLE products
      ADD CONSTRAINT products_capture_scale_lock_fk
      FOREIGN KEY (capture_scale_lock_id)
      REFERENCES product_capture_scale_locks(scale_lock_id)
      ON DELETE SET NULL;
  END IF;
END $$;

-- Partial index — only rows that actually have a lock attached.
CREATE INDEX IF NOT EXISTS products_capture_scale_lock_idx
  ON products (capture_scale_lock_id)
  WHERE capture_scale_lock_id IS NOT NULL;
