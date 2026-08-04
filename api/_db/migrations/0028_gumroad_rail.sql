-- Gumroad interim rail (2026-08-04) — enum extensions for the marketplace
-- Gumroad checkout (PayPal account banned; Gumroad is the live direct-sale
-- rail until MCB/MIPS lands).
--
--   payment_rail   + 'gumroad'    → orders created by /api/gumroad/create-order
--   payment_status + 'underpaid'  → PWYW floor risk: the buyer edited the
--                                   pre-filled USD price below the expected
--                                   order total. Order is NOT fulfilled.
--
-- NOTE: ALTER TYPE ... ADD VALUE cannot run inside an explicit transaction
-- block on some drivers — run these two statements standalone (Neon SQL
-- editor runs them fine one by one). Enum values cannot be dropped; the
-- rollback sibling documents that this migration is roll-FORWARD only.
-- Run BEFORE deploying the Gumroad rail; until applied the create-order
-- endpoint answers 503 "gumroad rail not migrated".

ALTER TYPE payment_rail ADD VALUE IF NOT EXISTS 'gumroad';
ALTER TYPE payment_status ADD VALUE IF NOT EXISTS 'underpaid';
