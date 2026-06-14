/**
 * Phase 5 — migration 0028 merchant onboarding content + reversibility.
 * Additive ALTER-only migration (no new table); asserts the columns are
 * added idempotently, the KYC enum is guarded, payout_queue is NOT
 * touched, and the rollback drops everything in dependency-safe order.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIG_DIR = join(__dirname, '..', 'db', 'migrations');
const read = (n: string) => readFileSync(join(MIG_DIR, n), 'utf8');

describe('migration 0028_merchant_onboarding.sql', () => {
  const sql = read('0028_merchant_onboarding.sql');

  it('no literal BEGIN/COMMIT (Neon HTTP auto-wraps)', () => {
    expect(/^\s*BEGIN\s*;/m.test(sql)).toBe(false);
    expect(/^\s*COMMIT\s*;/m.test(sql)).toBe(false);
  });

  it('guards the merchant_kyc_status ENUM with a DO $$ IF NOT EXISTS block', () => {
    expect(sql).toMatch(/CREATE\s+TYPE\s+merchant_kyc_status\s+AS\s+ENUM/i);
    expect(sql).toMatch(/'none'/);
    expect(sql).toMatch(/'lite_submitted'/);
    expect(sql).toMatch(/'verified'/);
    expect(sql).toMatch(/IF\s+NOT\s+EXISTS\s*\(\s*SELECT\s+1\s+FROM\s+pg_type\s+WHERE\s+typname\s*=\s*'merchant_kyc_status'/i);
  });

  it('adds all 4 onboarding columns idempotently (ADD COLUMN IF NOT EXISTS)', () => {
    for (const col of ['onboarding_step', 'kyc_status', 'payout_method', 'go_live_at']) {
      expect(sql, `expected ADD COLUMN IF NOT EXISTS ${col}`).toMatch(
        new RegExp(`ALTER\\s+TABLE\\s+merchants\\s+ADD\\s+COLUMN\\s+IF\\s+NOT\\s+EXISTS\\s+${col}\\b`, 'i'),
      );
    }
  });

  it('sets NOT NULL defaults on onboarding_step + kyc_status', () => {
    expect(sql).toMatch(/onboarding_step\s+INTEGER\s+NOT\s+NULL\s+DEFAULT\s+0/i);
    expect(sql).toMatch(/kyc_status\s+merchant_kyc_status\s+NOT\s+NULL\s+DEFAULT\s+'none'/i);
  });

  it('does NOT touch payout_queue or other money/order tables', () => {
    expect(/ALTER\s+TABLE\s+(payout_queue|orders|order_items|products|suppliers|webhook_events)\b/i.test(sql)).toBe(false);
    expect(/CREATE\s+TABLE/i.test(sql)).toBe(false); // additive ALTER-only
  });
});

describe('migration 0028_merchant_onboarding_rollback.sql', () => {
  const rb = read('0028_merchant_onboarding_rollback.sql');

  it('drops all 4 columns then the ENUM last', () => {
    for (const col of ['onboarding_step', 'kyc_status', 'payout_method', 'go_live_at']) {
      expect(rb).toMatch(new RegExp(`DROP\\s+COLUMN\\s+IF\\s+EXISTS\\s+${col}\\b`, 'i'));
    }
    const colIdx = rb.indexOf('DROP COLUMN IF EXISTS kyc_status');
    const enumIdx = rb.indexOf('DROP TYPE IF EXISTS merchant_kyc_status');
    expect(enumIdx).toBeGreaterThan(colIdx);
  });

  it('clears the schema_migrations bookkeeping row', () => {
    expect(rb).toMatch(/DELETE\s+FROM\s+schema_migrations\s+WHERE\s+version\s*=\s*'0028_merchant_onboarding'/i);
  });
});
