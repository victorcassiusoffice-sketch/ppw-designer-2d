-- 0028 rollback — INTENTIONALLY A NO-OP.
--
-- PostgreSQL cannot remove a value from an enum type without rebuilding
-- the type (and every column using it). The two values added by 0028
-- ('gumroad' on payment_rail, 'underpaid' on payment_status) are additive
-- and harmless when unused: no existing row is touched, no code path is
-- forced onto them.
--
-- To "roll back" the Gumroad rail operationally: unset VITE_GUMROAD_ENABLED
-- (client stops offering the rail) and unset GUMROAD_ACCESS_TOKEN /
-- GUMROAD_DESIGNER_PRODUCT_ID / GUMROAD_DESIGNER_PRODUCT_URL (server
-- endpoints answer 503). The enum values stay behind, inert.

SELECT 1; -- no-op
