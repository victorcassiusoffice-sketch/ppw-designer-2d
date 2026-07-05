-- OMS Phase 1 — initial marketplace schema.
--
-- Tables: merchants, merchant_documents, admins.
-- Enums: merchant_status, merchant_document_type, admin_role.
--
-- Hand-written to keep the Phase 1 install footprint small (no
-- drizzle-kit `generate` step at install time). The Drizzle schema in
-- api/db/schema.ts is the source of truth for typing; this SQL is the
-- canonical apply-order. They MUST stay in sync — Phase 2 introduces a
-- generated-migration workflow.
--
-- Safe to run repeatedly: every CREATE uses IF NOT EXISTS guards.

DO $$ BEGIN
    CREATE TYPE merchant_status AS ENUM (
        'pending_signup',
        'awaiting_kyc',
        'kyc_complete',
        'pending_admin_approval',
        'approved',
        'rejected',
        'suspended'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE merchant_document_type AS ENUM (
        'distributor_agreement',
        'invoice',
        'business_registration',
        'other'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE admin_role AS ENUM (
        'super_admin',
        'reviewer'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS merchants (
    id SERIAL PRIMARY KEY,
    slug VARCHAR(80) NOT NULL,
    business_name VARCHAR(200) NOT NULL,
    brand_name VARCHAR(200) NOT NULL,
    contact_name VARCHAR(200) NOT NULL,
    contact_email VARCHAR(320) NOT NULL,
    contact_phone VARCHAR(40) NOT NULL,
    country VARCHAR(4) NOT NULL DEFAULT 'MU',
    website VARCHAR(500),
    product_categories TEXT NOT NULL,
    estimated_monthly_volume VARCHAR(80),
    referral_notes TEXT,
    stripe_connect_account_id VARCHAR(80),
    status merchant_status NOT NULL DEFAULT 'pending_signup',
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    approved_at TIMESTAMPTZ,
    approved_by VARCHAR(320),
    rejected_at TIMESTAMPTZ,
    rejected_reason TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS merchants_slug_idx ON merchants(slug);
CREATE INDEX IF NOT EXISTS merchants_contact_email_idx ON merchants(contact_email);
CREATE INDEX IF NOT EXISTS merchants_status_idx ON merchants(status);
CREATE INDEX IF NOT EXISTS merchants_stripe_acct_idx ON merchants(stripe_connect_account_id);

CREATE TABLE IF NOT EXISTS merchant_documents (
    id SERIAL PRIMARY KEY,
    merchant_id INTEGER NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
    doc_type merchant_document_type NOT NULL,
    blob_url VARCHAR(1000) NOT NULL,
    uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS merchant_documents_merchant_idx ON merchant_documents(merchant_id);

CREATE TABLE IF NOT EXISTS admins (
    id SERIAL PRIMARY KEY,
    clerk_user_id VARCHAR(80) NOT NULL,
    email VARCHAR(320) NOT NULL,
    role admin_role NOT NULL DEFAULT 'reviewer',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS admins_clerk_user_id_idx ON admins(clerk_user_id);
CREATE UNIQUE INDEX IF NOT EXISTS admins_email_idx ON admins(email);

-- Auto-update `updated_at` on merchants whenever a row changes.
CREATE OR REPLACE FUNCTION touch_updated_at() RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS merchants_touch_updated_at ON merchants;
CREATE TRIGGER merchants_touch_updated_at
BEFORE UPDATE ON merchants
FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
