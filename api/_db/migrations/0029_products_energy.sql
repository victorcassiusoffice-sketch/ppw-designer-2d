-- Eco / solar (2026-09-04) — merchant-product ENERGY columns.
--
-- The Designer's energy readout needs, per product, the rated power DRAW
-- (an appliance), or the PV rating / battery capacity / inverter output (solar
-- gear). Merchants put these on their product page; the scrape
-- (`scripts/scrape-energy-specs.ts` → `src/lib/energySpecs.ts`) reads them
-- off the page text and the merchant form lets them be typed. All nullable →
-- additive, no signup / product-insert regression.
--
-- ⚠ MIGRATION-GATED like 0027: the API only SELECTs / INSERTs these columns
-- when `ENERGY_DB_COLUMNS=1` is set in the Vercel env, so a deploy against a
-- not-yet-migrated Neon branch cannot raise 42703 and empty the catalog.
-- Apply this on Neon (single branch — see README), then set the flag.
-- Rollback sibling: 0029_products_energy_rollback.sql.

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS power_w            INTEGER,
  ADD COLUMN IF NOT EXISTS duty_hours_per_day NUMERIC(4,1),
  ADD COLUMN IF NOT EXISTS pv_wp              INTEGER,
  ADD COLUMN IF NOT EXISTS battery_wh         INTEGER,
  ADD COLUMN IF NOT EXISTS inverter_w         INTEGER,
  ADD COLUMN IF NOT EXISTS energy_role        VARCHAR(16);

-- Sanity bounds: nothing negative, nothing absurd, hours within a day.
ALTER TABLE products
  ADD CONSTRAINT products_power_w_bounds CHECK (power_w IS NULL OR (power_w >= 0 AND power_w <= 100000)),
  ADD CONSTRAINT products_duty_hours_bounds CHECK (duty_hours_per_day IS NULL OR (duty_hours_per_day >= 0 AND duty_hours_per_day <= 24)),
  ADD CONSTRAINT products_pv_wp_bounds CHECK (pv_wp IS NULL OR (pv_wp >= 0 AND pv_wp <= 5000)),
  ADD CONSTRAINT products_battery_wh_bounds CHECK (battery_wh IS NULL OR (battery_wh >= 0 AND battery_wh <= 1000000)),
  ADD CONSTRAINT products_inverter_w_bounds CHECK (inverter_w IS NULL OR (inverter_w >= 0 AND inverter_w <= 1000000)),
  ADD CONSTRAINT products_energy_role_values CHECK (energy_role IS NULL OR energy_role IN ('consumer', 'generator', 'storage', 'inverter', 'none'));
