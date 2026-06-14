-- Phase 4 (BACKEND-RUN-ORDER-2026-06-11) — verified-purchase product reviews.
--
-- Amazon-grade-but-friendlier storefront trust layer. One row per
-- customer review of a product. `verified` is set TRUE (and order_id
-- linked) only when the submitting customer_email_hash matches a real
-- order line for that product — so the catalogue never fills with the
-- fake-review swamp Amazon tolerates.
--
-- Lifecycle: new reviews land status='pending' (invisible publicly) and
-- only become visible after admin moderation flips them to 'published'
-- (or 'rejected'). Public list + aggregate endpoints read 'published'
-- only.
--
-- Additive + reversible (Neon single-branch = every write hits prod):
--   - TYPE creation guarded by a DO $$ IF NOT EXISTS block (re-run safe).
--   - Table + indexes created idempotently (IF NOT EXISTS guards).
--   - Touches NO money/order table (orders/order_items/products/suppliers/
--     payout_queue/webhook_events) beyond declaring FK references to
--     products + orders (read-only references; no column changes there).
-- Rollback: 0027_product_reviews_rollback.sql.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'review_status') THEN
    CREATE TYPE review_status AS ENUM ('pending', 'published', 'rejected');
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS product_reviews (
  id BIGSERIAL PRIMARY KEY,
  product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  order_id BIGINT REFERENCES orders(id) ON DELETE SET NULL,
  customer_email_hash VARCHAR(64) NOT NULL,
  rating INTEGER NOT NULL,
  title VARCHAR(200),
  body TEXT,
  status review_status NOT NULL DEFAULT 'pending',
  verified BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Rating bounds — added as a named constraint, NOT VALID so the migration
-- never blocks on a (here impossible) legacy row scan, matching the
-- 0010 catalog-filter convention.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'product_reviews_rating_bounds'
  ) THEN
    ALTER TABLE product_reviews
      ADD CONSTRAINT product_reviews_rating_bounds
      CHECK (rating BETWEEN 1 AND 5) NOT VALID;
  END IF;
END
$$;

-- Public read path: published reviews for one product (and the aggregate).
CREATE INDEX IF NOT EXISTS product_reviews_product_status_idx
  ON product_reviews(product_id, status);

-- Verified-purchase lookup + dedupe-by-customer support.
CREATE INDEX IF NOT EXISTS product_reviews_email_hash_idx
  ON product_reviews(customer_email_hash);
