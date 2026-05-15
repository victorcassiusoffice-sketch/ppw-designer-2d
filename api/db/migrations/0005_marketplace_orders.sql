-- OMS Phase 4 — marketplace order_items + payout tracking.
--
-- Extends the orders table (from 0002_payment_rails.sql) with per-supplier
-- line items so a single customer payment can be split across N suppliers.
--
-- Payout strategy: customer pays full amount via existing PayPal Standard
-- (or future MIPS / MCB Juice / PayPal Marketplaces). Per-supplier amounts
-- are written to payout_queue (already exists from 0003_admin_portal.sql)
-- for disbursement. PayPal Marketplaces partner setup is deferred — manual
-- payout pattern works at low volume.
--
-- Idempotent.

CREATE TABLE IF NOT EXISTS order_items (
    id BIGSERIAL PRIMARY KEY,
    order_id BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    merchant_id BIGINT NOT NULL REFERENCES merchants(id) ON DELETE RESTRICT,
    supplier_id BIGINT REFERENCES suppliers(id) ON DELETE SET NULL,
    product_id BIGINT REFERENCES products(id) ON DELETE SET NULL,
    sku VARCHAR(80) NOT NULL,
    name VARCHAR(200) NOT NULL,
    quantity INTEGER NOT NULL,
    unit_price_minor INTEGER NOT NULL,
    line_total_minor INTEGER NOT NULL,
    currency VARCHAR(3) NOT NULL,
    payout_status payout_status NOT NULL DEFAULT 'queued',
    payout_id BIGINT REFERENCES payout_queue(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS order_items_order_idx ON order_items(order_id);
CREATE INDEX IF NOT EXISTS order_items_merchant_idx ON order_items(merchant_id, payout_status);
CREATE INDEX IF NOT EXISTS order_items_supplier_idx ON order_items(supplier_id);
CREATE INDEX IF NOT EXISTS order_items_payout_idx ON order_items(payout_id);
