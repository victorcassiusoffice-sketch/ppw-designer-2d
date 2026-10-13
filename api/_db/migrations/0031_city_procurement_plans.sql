-- Draft schedules only. No triggers, cron, supplier order or invoice sending.
-- Apply through the normal reviewed migration process, never from the browser.
CREATE TABLE IF NOT EXISTS city_procurement_plans (
  id BIGSERIAL PRIMARY KEY,
  merchant_id BIGINT NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  public_id UUID NOT NULL,
  project_id VARCHAR(100) NOT NULL,
  revision INTEGER NOT NULL DEFAULT 1 CHECK (revision > 0),
  document JSONB NOT NULL,
  last_request_id UUID NOT NULL,
  last_request_hash VARCHAR(64) NOT NULL,
  updated_by VARCHAR(320) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS city_procurement_owner_id_idx ON city_procurement_plans(merchant_id, public_id);
CREATE INDEX IF NOT EXISTS city_procurement_owner_project_idx ON city_procurement_plans(merchant_id, project_id);
