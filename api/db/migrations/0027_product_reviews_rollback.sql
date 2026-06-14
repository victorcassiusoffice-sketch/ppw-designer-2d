-- Rollback for 0027_product_reviews.sql.
-- See _template_rollback.sql header for the operator-invoked drill workflow.

DROP INDEX IF EXISTS product_reviews_email_hash_idx;
DROP INDEX IF EXISTS product_reviews_product_status_idx;
-- Constraint drops with the table, but name it explicitly for partial-rollback safety.
ALTER TABLE IF EXISTS product_reviews DROP CONSTRAINT IF EXISTS product_reviews_rating_bounds;
DROP TABLE IF EXISTS product_reviews;
-- Drop the ENUM LAST (after the column that references it is gone).
DROP TYPE IF EXISTS review_status;

DELETE FROM schema_migrations WHERE version = '0027_product_reviews';
