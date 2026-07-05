-- OMS Wave 2.6 + 2.7 — Designer save/load + lead capture.
-- Idempotent.

CREATE TABLE IF NOT EXISTS designs (
  id BIGSERIAL PRIMARY KEY,
  user_id VARCHAR(80),
  customer_email VARCHAR(320),
  name VARCHAR(200) NOT NULL DEFAULT 'Untitled design',
  property JSONB NOT NULL,
  cart JSONB,
  status VARCHAR(40) NOT NULL DEFAULT 'draft',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS designs_user_idx ON designs(user_id, created_at);
CREATE INDEX IF NOT EXISTS designs_email_idx ON designs(customer_email, created_at);

CREATE TABLE IF NOT EXISTS leads (
  id BIGSERIAL PRIMARY KEY,
  customer_email VARCHAR(320) NOT NULL,
  customer_name VARCHAR(200),
  customer_phone VARCHAR(40),
  design_id BIGINT REFERENCES designs(id) ON DELETE SET NULL,
  property JSONB,
  cart_quote JSONB,
  message TEXT,
  source VARCHAR(80) NOT NULL DEFAULT 'designer',
  status VARCHAR(40) NOT NULL DEFAULT 'new',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS leads_email_idx ON leads(customer_email, created_at);
CREATE INDEX IF NOT EXISTS leads_status_idx ON leads(status, created_at);
