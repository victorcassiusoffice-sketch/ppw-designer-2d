-- OMS Wave 1.5 — agent session persistence.
-- Adds agent_sessions + agent_messages with cost tracking columns so
-- merchants can resume chats across pages and admins can see per-merchant
-- LLM cost in the dashboard.
-- Idempotent.

DO $$ BEGIN
  CREATE TYPE agent_model AS ENUM ('gemini-flash', 'claude-sonnet');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS agent_sessions (
  id BIGSERIAL PRIMARY KEY,
  merchant_id BIGINT NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  topic VARCHAR(200) NOT NULL DEFAULT 'onboarding',
  status VARCHAR(40) NOT NULL DEFAULT 'active',
  -- aggregated cost across messages, in micro-dollars (1e-6 USD) for
  -- pennies precision without floats.
  total_cost_micro_usd BIGINT NOT NULL DEFAULT 0,
  gemini_cost_micro_usd BIGINT NOT NULL DEFAULT 0,
  sonnet_cost_micro_usd BIGINT NOT NULL DEFAULT 0,
  total_input_tokens BIGINT NOT NULL DEFAULT 0,
  total_output_tokens BIGINT NOT NULL DEFAULT 0,
  message_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS agent_sessions_merchant_idx ON agent_sessions(merchant_id, created_at);
CREATE INDEX IF NOT EXISTS agent_sessions_status_idx ON agent_sessions(status);

CREATE TABLE IF NOT EXISTS agent_messages (
  id BIGSERIAL PRIMARY KEY,
  session_id BIGINT NOT NULL REFERENCES agent_sessions(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL CHECK (role IN ('system', 'user', 'assistant')),
  content TEXT NOT NULL,
  model_used agent_model,
  input_tokens INTEGER,
  output_tokens INTEGER,
  cost_micro_usd BIGINT,
  fallback_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS agent_messages_session_idx ON agent_messages(session_id, created_at);
