-- Studio presentation access gate (2026-10-05).
-- Additive and independent of merchant authentication and customer data.
-- Neon is shared by previews and production: namespaced record keys keep their
-- access attempts and opaque, hashed session tokens independent.
-- This migration is also lazily applied by server/accessStorage.ts only after
-- a gate request finds this dedicated table absent. No CREATE DATABASE is used.
BEGIN;
SET LOCAL lock_timeout = '3s';
SELECT pg_advisory_xact_lock(21231005);
CREATE TABLE IF NOT EXISTS public.studio_access_records (
  record_key varchar(512) PRIMARY KEY,
  record_value text NOT NULL,
  expires_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS studio_access_records_expiry_idx
  ON public.studio_access_records (expires_at);
COMMIT;
