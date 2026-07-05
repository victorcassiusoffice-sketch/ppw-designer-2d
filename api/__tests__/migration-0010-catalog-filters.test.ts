/**
 * V4 W0.D.2 — migration 0010 catalog-filters content tests.
 *
 * Asserts the SQL file declares every object the DA §02 + ME §03 refined
 * spec calls out, the rollback sibling drops the same set, and re-run
 * safety guards (IF NOT EXISTS / OR REPLACE / DO $$ blocks) are present.
 *
 * We don't actually apply the migration here — that's the operator's
 * branch-then-prod drill (NEON-BRANCH-WORKFLOW.md / W0.D.3). These tests
 * stop drift between the canonical spec and the SQL body.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIG_DIR = join(__dirname, '..', '_db', 'migrations');

function read(name: string): string {
  return readFileSync(join(MIG_DIR, name), 'utf8');
}

describe('W0.D.2 migration 0010_catalog_filters.sql', () => {
  const sql = read('0010_catalog_filters.sql');

  it('does NOT contain literal BEGIN/COMMIT (per ME §03.1 — Neon HTTP auto-wraps)', () => {
    expect(/^\s*BEGIN\s*;/m.test(sql)).toBe(false);
    expect(/^\s*COMMIT\s*;/m.test(sql)).toBe(false);
  });

  it('creates the eco_cert_level ENUM with all 4 tiers (V4-DA-1)', () => {
    expect(sql).toMatch(/CREATE\s+TYPE\s+eco_cert_level\s+AS\s+ENUM/i);
    expect(sql).toMatch(/'none'/);
    expect(sql).toMatch(/'self-declared'/);
    expect(sql).toMatch(/'third-party-claimed'/);
    expect(sql).toMatch(/'verified-certified'/);
  });

  it('guards the ENUM creation with a DO $$ IF NOT EXISTS block (re-run safety)', () => {
    expect(sql).toMatch(/IF\s+NOT\s+EXISTS\s*\(\s*SELECT\s+1\s+FROM\s+pg_type\s+WHERE\s+typname\s*=\s*'eco_cert_level'/i);
  });

  it('adds all 4 catalog-filter columns to products with idempotent ADD COLUMN IF NOT EXISTS', () => {
    for (const col of ['eco_cert_level', 'in_stock_qty', 'retired_at', 'supplier_rating']) {
      const re = new RegExp(`ALTER\\s+TABLE\\s+products\\s+ADD\\s+COLUMN\\s+IF\\s+NOT\\s+EXISTS\\s+${col}\\b`, 'i');
      expect(sql, `expected ADD COLUMN IF NOT EXISTS ${col}`).toMatch(re);
    }
  });

  it('sets correct NOT NULL + DEFAULT on eco_cert_level + in_stock_qty', () => {
    expect(sql).toMatch(/eco_cert_level\s+eco_cert_level\s+NOT\s+NULL\s+DEFAULT\s+'none'/i);
    expect(sql).toMatch(/in_stock_qty\s+INTEGER\s+NOT\s+NULL\s+DEFAULT\s+0/i);
  });

  it('adds the supplier_rating bounds CHECK as NOT VALID (DA §02.5 + ME §03.4)', () => {
    expect(sql).toMatch(/products_supplier_rating_bounds/);
    expect(sql).toMatch(/CHECK\s*\(\s*supplier_rating\s+IS\s+NULL\s+OR\s+supplier_rating\s+BETWEEN\s+1\s+AND\s+5\s*\)\s+NOT\s+VALID/i);
  });

  it('creates the composite partial catalog-filter index (DA §02.1)', () => {
    expect(sql).toMatch(/CREATE\s+INDEX\s+IF\s+NOT\s+EXISTS\s+products_catalog_filter_idx/i);
    expect(sql).toMatch(/ON\s+products\s*\(\s*status\s*,\s*eco_cert_level\s*,\s*supplier_rating\s+DESC\s+NULLS\s+LAST\s*,\s*price_minor\s*\)/i);
    expect(sql).toMatch(/WHERE\s+in_stock_qty\s*>\s*0\s+AND\s+retired_at\s+IS\s+NULL/i);
  });

  it('adds the merchants.slug kebab regex CHECK as NOT VALID (V4-DA-2 + ME §03.4)', () => {
    expect(sql).toMatch(/merchants_slug_kebab_ck/);
    expect(sql).toMatch(/slug\s+~\s+'\^\[a-z0-9\]/);
    expect(sql).toMatch(/NOT\s+VALID/i);
  });

  it('declares customer_identities as CREATE OR REPLACE VIEW (DA §02.2 + ME §03.3)', () => {
    expect(sql).toMatch(/CREATE\s+OR\s+REPLACE\s+VIEW\s+customer_identities\b/i);
    expect(sql).toMatch(/FROM\s+orders\b/i);
    expect(sql).toMatch(/GROUP\s+BY\s+customer_email/i);
  });

  it('does NOT attempt to create a customers TABLE (defers V4-TL-1 per DA §02.2)', () => {
    expect(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?customers\b/i.test(sql)).toBe(false);
  });
});

describe('W0.D.2 migration 0010_catalog_filters_rollback.sql', () => {
  const rollback = read('0010_catalog_filters_rollback.sql');

  it('drops the VIEW first (must precede column drops it depends on)', () => {
    const viewIdx = rollback.indexOf('DROP VIEW IF EXISTS customer_identities');
    const colIdx = rollback.indexOf('DROP COLUMN IF EXISTS retired_at');
    expect(viewIdx).toBeGreaterThan(-1);
    expect(colIdx).toBeGreaterThan(viewIdx);
  });

  it('drops every column the forward migration added (IF EXISTS for safety)', () => {
    for (const col of ['eco_cert_level', 'in_stock_qty', 'retired_at', 'supplier_rating']) {
      expect(rollback).toMatch(new RegExp(`DROP\\s+COLUMN\\s+IF\\s+EXISTS\\s+${col}\\b`, 'i'));
    }
  });

  it('drops the composite catalog-filter index', () => {
    expect(rollback).toMatch(/DROP\s+INDEX\s+IF\s+EXISTS\s+products_catalog_filter_idx/i);
  });

  it('drops both NOT VALID constraints by name', () => {
    expect(rollback).toMatch(/DROP\s+CONSTRAINT\s+IF\s+EXISTS\s+merchants_slug_kebab_ck/i);
    expect(rollback).toMatch(/DROP\s+CONSTRAINT\s+IF\s+EXISTS\s+products_supplier_rating_bounds/i);
  });

  it('drops the eco_cert_level ENUM LAST (after column references gone)', () => {
    const enumIdx = rollback.indexOf('DROP TYPE IF EXISTS eco_cert_level');
    const colIdx = rollback.indexOf('DROP COLUMN IF EXISTS eco_cert_level');
    expect(enumIdx).toBeGreaterThan(colIdx);
  });

  it('documents the schema_migrations bookkeeping step', () => {
    expect(rollback).toMatch(/DELETE\s+FROM\s+schema_migrations\s+WHERE\s+version\s*=\s*'0010_catalog_filters'/i);
  });
});
