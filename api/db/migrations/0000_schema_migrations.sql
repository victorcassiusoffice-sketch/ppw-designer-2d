-- V4 W0.D.1 (ME §03.5 + V4-ME-1 CLOSED 2026-05-16) — Migration tracking table.
--
-- Records every applied migration by filename stem + SHA-256 checksum +
-- applied_at timestamp. scripts/migrate.ts consults this table on every
-- run and skips any version already present.
--
-- Numbered 0000 so it lexically sorts BEFORE 0001-0009 and applies first
-- on every fresh DB. On existing prod DBs that pre-date this table,
-- migrate.ts run with `BACKFILL_EXISTING=1` populates 0001-0009 (and 0000)
-- without re-executing their SQL.

CREATE TABLE IF NOT EXISTS schema_migrations (
  version    VARCHAR(40)  PRIMARY KEY,
  applied_at TIMESTAMPTZ  NOT NULL DEFAULT now(),
  checksum   VARCHAR(64)  NOT NULL
);
