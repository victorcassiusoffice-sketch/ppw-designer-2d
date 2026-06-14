/**
 * Phase 4 — migration 0027 product_reviews content + reversibility tests.
 *
 * Mirrors the 0010 convention: assert the SQL declares every object the
 * spec requires, is re-run safe (IF NOT EXISTS / DO $$ guards), and the
 * rollback sibling drops the same set in dependency-safe order. The
 * migration is never applied here — that's the operator's GATE-2 drill.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIG_DIR = join(__dirname, '..', 'db', 'migrations');
const read = (name: string) => readFileSync(join(MIG_DIR, name), 'utf8');

describe('migration 0027_product_reviews.sql', () => {
  const sql = read('0027_product_reviews.sql');

  it('does NOT contain literal BEGIN/COMMIT (Neon HTTP auto-wraps)', () => {
    expect(/^\s*BEGIN\s*;/m.test(sql)).toBe(false);
    expect(/^\s*COMMIT\s*;/m.test(sql)).toBe(false);
  });

  it('creates the review_status ENUM, guarded by a DO $$ IF NOT EXISTS block', () => {
    expect(sql).toMatch(/CREATE\s+TYPE\s+review_status\s+AS\s+ENUM/i);
    expect(sql).toMatch(/'pending'/);
    expect(sql).toMatch(/'published'/);
    expect(sql).toMatch(/'rejected'/);
    expect(sql).toMatch(/IF\s+NOT\s+EXISTS\s*\(\s*SELECT\s+1\s+FROM\s+pg_type\s+WHERE\s+typname\s*=\s*'review_status'/i);
  });

  it('creates product_reviews with CREATE TABLE IF NOT EXISTS (re-run safe)', () => {
    expect(sql).toMatch(/CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+product_reviews/i);
  });

  it('declares FK references to products + orders without altering them', () => {
    expect(sql).toMatch(/product_id\s+BIGINT\s+NOT\s+NULL\s+REFERENCES\s+products\(id\)\s+ON\s+DELETE\s+CASCADE/i);
    expect(sql).toMatch(/order_id\s+BIGINT\s+REFERENCES\s+orders\(id\)\s+ON\s+DELETE\s+SET\s+NULL/i);
    // Must NOT mutate money/order tables.
    expect(/ALTER\s+TABLE\s+(orders|order_items|products|suppliers|payout_queue|webhook_events)\b/i.test(sql)).toBe(false);
  });

  it('has the verified flag + status default pending + rating bounds CHECK NOT VALID', () => {
    expect(sql).toMatch(/verified\s+BOOLEAN\s+NOT\s+NULL\s+DEFAULT\s+false/i);
    expect(sql).toMatch(/status\s+review_status\s+NOT\s+NULL\s+DEFAULT\s+'pending'/i);
    expect(sql).toMatch(/CHECK\s*\(\s*rating\s+BETWEEN\s+1\s+AND\s+5\s*\)\s+NOT\s+VALID/i);
  });

  it('creates the (product_id, status) read index', () => {
    expect(sql).toMatch(/CREATE\s+INDEX\s+IF\s+NOT\s+EXISTS\s+product_reviews_product_status_idx\s+ON\s+product_reviews\(product_id,\s*status\)/i);
  });
});

describe('migration 0027_product_reviews_rollback.sql', () => {
  const rb = read('0027_product_reviews_rollback.sql');

  it('drops indexes, then table, then the ENUM last', () => {
    const tableIdx = rb.indexOf('DROP TABLE IF EXISTS product_reviews');
    const enumIdx = rb.indexOf('DROP TYPE IF EXISTS review_status');
    expect(tableIdx).toBeGreaterThan(-1);
    expect(enumIdx).toBeGreaterThan(tableIdx); // enum dropped after the table that references it
  });

  it('drops both review indexes', () => {
    expect(rb).toMatch(/DROP\s+INDEX\s+IF\s+EXISTS\s+product_reviews_product_status_idx/i);
    expect(rb).toMatch(/DROP\s+INDEX\s+IF\s+EXISTS\s+product_reviews_email_hash_idx/i);
  });

  it('clears the schema_migrations bookkeeping row', () => {
    expect(rb).toMatch(/DELETE\s+FROM\s+schema_migrations\s+WHERE\s+version\s*=\s*'0027_product_reviews'/i);
  });
});
