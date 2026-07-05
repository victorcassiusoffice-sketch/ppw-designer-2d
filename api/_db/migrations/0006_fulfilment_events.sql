-- OMS Phase 5 — order fulfilment events.
--
-- Tracks per-order_item shipping status updates from suppliers. The
-- order's overall status is derived from the worst-case across its items
-- (helper in api/lib/order-status.ts).
--
-- Idempotent.

DO $$ BEGIN
    CREATE TYPE order_event_type AS ENUM (
        'confirmed',
        'shipped',
        'in_transit',
        'delivered',
        'returned',
        'failed'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS order_item_events (
    id BIGSERIAL PRIMARY KEY,
    order_item_id BIGINT NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
    event_type order_event_type NOT NULL,
    tracking_number VARCHAR(120),
    carrier VARCHAR(80),
    note TEXT,
    payload JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS order_item_events_item_idx ON order_item_events(order_item_id, created_at DESC);
CREATE INDEX IF NOT EXISTS order_item_events_type_idx ON order_item_events(event_type);
