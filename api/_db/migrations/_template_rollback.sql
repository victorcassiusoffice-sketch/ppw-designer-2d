-- _template_rollback.sql — copy this file next to a new migration as
-- `<NNNN>_<slug>_rollback.sql` and fill in the inverse statements.
-- See `PPW-Second-Brain/06-Roadmap/v4/NEON-BRANCH-WORKFLOW.md` (V4 W0.D.3)
-- for the branch-then-prod drill this file plugs into.
--
-- IMPORTANT:
--   1. scripts/migrate.ts (W0.D.1) skips any file ending in `_rollback.sql`.
--      Rollbacks are operator-invoked via `psql -f`, NOT auto-applied.
--   2. The schema_migrations tracker is NOT touched by a rollback. After
--      rolling back, delete the row manually before re-applying a fix:
--        DELETE FROM schema_migrations WHERE version = '<NNNN>_<slug>';
--   3. This file is a TEMPLATE, not a migration. Do not edit in place —
--      copy it.
--
-- Coverage rules (from NEON-BRANCH-WORKFLOW.md):
--   * DROP every object the forward migration CREATEd.
--   * For ALTER … ADD COLUMN, DROP the column (data loss accepted on a
--     branch — this is a drill file, not a prod recovery tool).
--   * For CHECK constraints added NOT VALID + later VALIDATED, drop the
--     constraint by name.
--   * For VIEWS replaced via CREATE OR REPLACE, re-issue the prior body
--     here so the rollback restores the earlier shape.

BEGIN;

-- ─────────────────────────────────────────────────────────────────────
-- 1. Drop indexes added by the forward migration (idempotent).
-- ─────────────────────────────────────────────────────────────────────
-- DROP INDEX IF EXISTS <index_name>;

-- ─────────────────────────────────────────────────────────────────────
-- 2. Drop CHECK / FOREIGN KEY constraints added by the forward migration.
--    Use the constraint NAME the forward migration assigned.
-- ─────────────────────────────────────────────────────────────────────
-- ALTER TABLE <table> DROP CONSTRAINT IF EXISTS <constraint_name>;

-- ─────────────────────────────────────────────────────────────────────
-- 3. Drop or restore VIEWS the forward migration created / replaced.
-- ─────────────────────────────────────────────────────────────────────
-- DROP VIEW IF EXISTS <view_name>;
-- -- If the forward migration REPLACED an earlier body, re-issue it:
-- -- CREATE OR REPLACE VIEW <view_name> AS SELECT … ;

-- ─────────────────────────────────────────────────────────────────────
-- 4. Drop columns the forward migration added.
--    Use `DROP COLUMN IF EXISTS … CASCADE` if dependent objects exist.
-- ─────────────────────────────────────────────────────────────────────
-- ALTER TABLE <table> DROP COLUMN IF EXISTS <column_name>;

-- ─────────────────────────────────────────────────────────────────────
-- 5. Drop tables the forward migration created (LAST — order matters
--    when foreign keys reference these tables).
-- ─────────────────────────────────────────────────────────────────────
-- DROP TABLE IF EXISTS <table_name>;

-- ─────────────────────────────────────────────────────────────────────
-- 6. Drop ENUM types the forward migration created.
-- ─────────────────────────────────────────────────────────────────────
-- DROP TYPE IF EXISTS <enum_name>;

COMMIT;

-- ─────────────────────────────────────────────────────────────────────
-- Post-rollback bookkeeping (run as a separate statement after COMMIT):
--
--   DELETE FROM schema_migrations WHERE version = '<NNNN>_<slug>';
--
-- This frees up `migrate.ts` to re-apply the fixed forward migration
-- on its next run.
-- ─────────────────────────────────────────────────────────────────────
