-- OMS Wave 1.4 — merchant inbound webhook HMAC.
-- Adds a shared-secret column on merchants. Provisioned per merchant
-- on approve (see admin/merchants/approve handler).
-- Idempotent.

ALTER TABLE merchants
  ADD COLUMN IF NOT EXISTS webhook_secret VARCHAR(64);

-- Index allows fast lookup of merchants by slug (already covered by
-- merchants_slug_idx). No new index needed — the webhook handler reads
-- by slug.
