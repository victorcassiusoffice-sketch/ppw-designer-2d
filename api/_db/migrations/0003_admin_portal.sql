-- OMS Phase 2 — admin portal: payout_queue + audit_log.
--
-- This migration is owned by the Phase 2 admin slice. The PayPal slice
-- (migration 0002_payment_rails.sql) owns the `orders`, `webhook_events`
-- tables and seeds the `payment_rail` enum. We guard the enum creation
-- here too so the two slices can land in either order without conflict.
--
-- Safe to run repeatedly: every CREATE uses IF NOT EXISTS guards.

DO $$ BEGIN
    CREATE TYPE payout_status AS ENUM (
        'queued',
        'processing',
        'sent',
        'failed'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- payment_rail is owned by the PayPal slice's 0002_payment_rails.sql;
-- declare it conditionally so 0003 can land before 0002 if Vic re-runs
-- migrations out of order.
DO $$ BEGIN
    CREATE TYPE payment_rail AS ENUM (
        'stripe',
        'paypal',
        'mips',
        'mcb_juice',
        'bank_transfer'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS payout_queue (
    id BIGSERIAL PRIMARY KEY,
    merchant_id BIGINT NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
    amount_minor INTEGER NOT NULL,
    currency VARCHAR(3) NOT NULL,
    rail payment_rail NOT NULL,
    status payout_status NOT NULL DEFAULT 'queued',
    scheduled_for TIMESTAMPTZ NOT NULL,
    processed_at TIMESTAMPTZ,
    external_payout_id VARCHAR(120),
    note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS payout_queue_status_idx ON payout_queue(status, scheduled_for);
CREATE INDEX IF NOT EXISTS payout_queue_merchant_idx ON payout_queue(merchant_id);

CREATE TABLE IF NOT EXISTS audit_log (
    id BIGSERIAL PRIMARY KEY,
    actor_email VARCHAR(320) NOT NULL,
    action VARCHAR(120) NOT NULL,
    target_type VARCHAR(80) NOT NULL,
    target_id VARCHAR(120) NOT NULL,
    reason TEXT,
    payload JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS audit_log_actor_idx ON audit_log(actor_email, created_at);
CREATE INDEX IF NOT EXISTS audit_log_target_idx ON audit_log(target_type, target_id);
