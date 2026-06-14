/**
 * Phase 6 — migration 0029 coupons + commission_ledger content +
 * reversibility. Asserts both tables + both enums are created idempotently,
 * money/order/attribution tables are untouched, and rollback drops in
 * dependency-safe order.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIG_DIR = join(__dirname, '..', 'db', 'migrations');
const read = (n: string) => readFileSync(join(MIG_DIR, n), 'utf8');

describe('migration 0029_coupons_commission.sql', () => {
  const sql = read('0029_coupons_commission.sql');

  it('no literal BEGIN/COMMIT', () => {
    expect(/^\s*BEGIN\s*;/m.test(sql)).toBe(false);
    expect(/^\s*COMMIT\s*;/m.test(sql)).toBe(false);
  });

  it('guards both enums with DO $$ IF NOT EXISTS', () => {
    expect(sql).toMatch(/CREATE\s+TYPE\s+coupon_type\s+AS\s+ENUM/i);
    expect(sql).toMatch(/CREATE\s+TYPE\s+commission_status\s+AS\s+ENUM/i);
    expect(sql).toMatch(/typname\s*=\s*'coupon_type'/i);
    expect(sql).toMatch(/typname\s*=\s*'commission_status'/i);
  });

  it('creates coupons + commission_ledger idempotently', () => {
    expect(sql).toMatch(/CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+coupons/i);
    expect(sql).toMatch(/CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+commission_ledger/i);
    expect(sql).toMatch(/code\s+VARCHAR\(60\)\s+NOT\s+NULL\s+UNIQUE/i);
    expect(sql).toMatch(/redemptions\s+INTEGER\s+NOT\s+NULL\s+DEFAULT\s+0/i);
    expect(sql).toMatch(/ref_code\s+VARCHAR\(80\)\s+NOT\s+NULL\s+UNIQUE/i);
    expect(sql).toMatch(/status\s+commission_status\s+NOT\s+NULL\s+DEFAULT\s+'pending'/i);
  });

  it('does NOT alter money/order/attribution tables', () => {
    expect(/ALTER\s+TABLE\s+(orders|order_items|payout_queue|designer_referrals|products)\b/i.test(sql)).toBe(false);
  });
});

describe('migration 0029_coupons_commission_rollback.sql', () => {
  const rb = read('0029_coupons_commission_rollback.sql');

  it('drops both tables then both enums last', () => {
    const couponsTbl = rb.indexOf('DROP TABLE IF EXISTS coupons');
    const ledgerTbl = rb.indexOf('DROP TABLE IF EXISTS commission_ledger');
    const couponEnum = rb.indexOf('DROP TYPE IF EXISTS coupon_type');
    const commEnum = rb.indexOf('DROP TYPE IF EXISTS commission_status');
    expect(couponsTbl).toBeGreaterThan(-1);
    expect(ledgerTbl).toBeGreaterThan(-1);
    expect(couponEnum).toBeGreaterThan(couponsTbl);
    expect(commEnum).toBeGreaterThan(ledgerTbl);
  });

  it('clears the schema_migrations row', () => {
    expect(rb).toMatch(/DELETE\s+FROM\s+schema_migrations\s+WHERE\s+version\s*=\s*'0029_coupons_commission'/i);
  });
});
