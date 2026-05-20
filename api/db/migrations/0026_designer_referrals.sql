-- M7 (RELENTLESS_GOAL 2026-05-19) — Pattern C attribution layer.
--
-- Captures the outbound click from the PPW designer to a merchant's
-- external storefront (k1-sport.com for the pilot) so Vic can run the
-- monthly Pattern C reconciliation: download CSV → email K1 → K1
-- cross-references against their Airsquare order export → pays PPW 5%.
--
-- One row per outbound click. ref_code is the unique opaque token we
-- embed in the URL query string AND surface in the customer-facing
-- "Open in K1 shop" CTA. K1's order export must echo it back for the
-- monthly reconciliation to work (verified during DT-K1-MOU-SIGN).
--
-- product_* + price_* columns are denormalised on purpose — products.json
-- is the source for the customer-facing catalogue today and we want the
-- referral row to be self-contained for accounting even if the catalog
-- entry changes later. Schema is idempotent so re-running this migration
-- against an already-applied DB is a no-op.
--
-- Rollback: 0026_designer_referrals_rollback.sql.

CREATE TABLE IF NOT EXISTS designer_referrals (
  id BIGSERIAL PRIMARY KEY,
  ref_code VARCHAR(80) NOT NULL UNIQUE,
  design_id VARCHAR(80),
  session_id VARCHAR(80),
  merchant_slug VARCHAR(120) NOT NULL,
  product_id VARCHAR(120),
  product_sku VARCHAR(120),
  product_name VARCHAR(255),
  product_price_minor INTEGER,
  product_currency VARCHAR(8),
  outbound_url TEXT NOT NULL,
  ip_hash VARCHAR(80),
  user_agent VARCHAR(255),
  utm_source VARCHAR(80),
  utm_medium VARCHAR(80),
  utm_campaign VARCHAR(80),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS designer_referrals_merchant_created_idx
  ON designer_referrals(merchant_slug, created_at);

CREATE INDEX IF NOT EXISTS designer_referrals_design_idx
  ON designer_referrals(design_id);
