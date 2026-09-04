-- Rollback for 0029_products_energy.sql. Unset ENERGY_DB_COLUMNS first.
ALTER TABLE products
  DROP CONSTRAINT IF EXISTS products_power_w_bounds,
  DROP CONSTRAINT IF EXISTS products_duty_hours_bounds,
  DROP CONSTRAINT IF EXISTS products_pv_wp_bounds,
  DROP CONSTRAINT IF EXISTS products_battery_wh_bounds,
  DROP CONSTRAINT IF EXISTS products_inverter_w_bounds,
  DROP CONSTRAINT IF EXISTS products_energy_role_values;

ALTER TABLE products
  DROP COLUMN IF EXISTS power_w,
  DROP COLUMN IF EXISTS duty_hours_per_day,
  DROP COLUMN IF EXISTS pv_wp,
  DROP COLUMN IF EXISTS battery_wh,
  DROP COLUMN IF EXISTS inverter_w,
  DROP COLUMN IF EXISTS energy_role;
