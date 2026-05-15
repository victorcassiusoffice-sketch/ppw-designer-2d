-- OMS Phase 1.5 - payment rails + webhook events.
--
-- Adds the multi-rail order ledger and the cross-rail webhook
-- idempotency table. Drizzle schema in api/db/schema.ts is the source
-- of truth for typing; this SQL is the canonical apply-order.
--
-- Safe to run repeatedly: every CREATE uses IF NOT EXISTS guards and
-- every enum creation is wrapped in DO ... EXCEPTION blocks.

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

DO $$ BEGIN
    CREATE TYPE payment_status AS ENUM (
        'pending',
        'authorised',
        'captured',
        'failed',
        'refunded',
        'partially_refunded'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS orders (
    id BIGSERIAL PRIMARY KEY,
    ppw_order_id VARCHAR(120) NOT NULL UNIQUE,
    customer_email VARCHAR(320) NOT NULL,
    currency VARCHAR(3) NOT NULL,
    total_minor INTEGER NOT NULL,
    payment_rail payment_rail NOT NULL,
    payment_rail_order_id VARCHAR(120),
    payment_status payment_status NOT NULL DEFAULT 'pending',
    raw_payload JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS orders_customer_email_idx ON orders(customer_email);
CREATE INDEX IF NOT EXISTS orders_payment_rail_idx ON orders(payment_rail, payment_status);

CREATE TABLE IF NOT EXISTS webhook_events (
    id BIGSERIAL PRIMARY KEY,
    source VARCHAR(40) NOT NULL,
    event_id VARCHAR(120) NOT NULL,
    event_type VARCHAR(120) NOT NULL,
    received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    processed BOOLEAN NOT NULL DEFAULT false,
    processing_error TEXT,
    payload JSONB NOT NULL,
    CONSTRAINT webhook_events_source_event_unique UNIQUE (source, event_id)
);

CREATE INDEX IF NOT EXISTS webhook_events_unprocessed_idx ON webhook_events(processed, received_at);
