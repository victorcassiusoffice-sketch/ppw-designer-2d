-- OMS Phase 3 — product catalog + suppliers.
--
-- Creates: product_status enum, supplier_status enum, suppliers table,
-- products table, supplier_products table.
--
-- Safe to run repeatedly: every CREATE uses IF NOT EXISTS guards and
-- every enum creation is wrapped in DO ... EXCEPTION blocks.
--
-- Depends on: 0001_initial_merchants.sql (merchants table).

DO $$ BEGIN
    CREATE TYPE product_status AS ENUM (
        'draft',
        'active',
        'archived',
        'out_of_stock'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE supplier_status AS ENUM (
        'pending',
        'active',
        'suspended'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS suppliers (
    id BIGSERIAL PRIMARY KEY,
    merchant_id BIGINT NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
    name VARCHAR(200) NOT NULL,
    contact_email VARCHAR(320) NOT NULL,
    contact_phone VARCHAR(40),
    country VARCHAR(2) NOT NULL,
    status supplier_status NOT NULL DEFAULT 'pending',
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS suppliers_merchant_name_idx ON suppliers(merchant_id, name);
CREATE INDEX IF NOT EXISTS suppliers_merchant_idx ON suppliers(merchant_id);

CREATE TABLE IF NOT EXISTS products (
    id BIGSERIAL PRIMARY KEY,
    merchant_id BIGINT NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
    sku VARCHAR(80) NOT NULL,
    name VARCHAR(200) NOT NULL,
    category VARCHAR(80) NOT NULL,
    description TEXT,
    width_mm INTEGER,
    depth_mm INTEGER,
    height_mm INTEGER,
    weight_g INTEGER,
    price_minor INTEGER NOT NULL,
    currency VARCHAR(3) NOT NULL,
    image_url VARCHAR(500),
    status product_status NOT NULL DEFAULT 'draft',
    region VARCHAR(40),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS products_merchant_sku_idx ON products(merchant_id, sku);
CREATE INDEX IF NOT EXISTS products_merchant_status_idx ON products(merchant_id, status);
CREATE INDEX IF NOT EXISTS products_category_status_idx ON products(category, status);

CREATE TABLE IF NOT EXISTS supplier_products (
    id BIGSERIAL PRIMARY KEY,
    supplier_id BIGINT NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
    product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    supplier_sku VARCHAR(80),
    cost_minor INTEGER NOT NULL,
    cost_currency VARCHAR(3) NOT NULL,
    lead_time_days INTEGER NOT NULL DEFAULT 7,
    primary_supplier BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS supplier_products_supplier_product_idx ON supplier_products(supplier_id, product_id);
CREATE INDEX IF NOT EXISTS supplier_products_product_idx ON supplier_products(product_id);
