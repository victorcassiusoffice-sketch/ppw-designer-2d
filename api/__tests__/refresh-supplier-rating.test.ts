/**
 * V4 W0.D.9 — refresh-supplier-rating cron unit tests.
 *
 * Pure-function coverage of computeRatingForMerchantStatus + the
 * 0011 migration content + the cron-router dispatch line. The
 * actual batch execution against Drizzle is exercised via the
 * existing cron-router integration paths once W0.D.16 ci-tests
 * Neon branch lands.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  BACKFILL_LIMIT,
  REFRESH_INTERVAL_DAYS,
  computeRatingForMerchantStatus,
} from '../lib/cron/refreshSupplierRating';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIG_DIR = join(__dirname, '..', 'db', 'migrations');

describe('computeRatingForMerchantStatus (W0.D.9 v1 algorithm)', () => {
  it('approved → 3', () => {
    expect(computeRatingForMerchantStatus('approved')).toBe(3);
  });

  it('kyc_complete → 2', () => {
    expect(computeRatingForMerchantStatus('kyc_complete')).toBe(2);
  });

  it('pending_admin_approval → 2 (same signal as kyc_complete)', () => {
    expect(computeRatingForMerchantStatus('pending_admin_approval')).toBe(2);
  });

  it('awaiting_kyc → 1', () => {
    expect(computeRatingForMerchantStatus('awaiting_kyc')).toBe(1);
  });

  it('pending_signup → NULL', () => {
    expect(computeRatingForMerchantStatus('pending_signup')).toBeNull();
  });

  it('rejected → NULL', () => {
    expect(computeRatingForMerchantStatus('rejected')).toBeNull();
  });

  it('suspended → NULL', () => {
    expect(computeRatingForMerchantStatus('suspended')).toBeNull();
  });

  it('unknown status → NULL (future-proof against new enum values)', () => {
    expect(computeRatingForMerchantStatus('mystery_new_status' as never)).toBeNull();
  });

  it('every returned rating stays within the bounds CHECK (NULL or 1-5)', () => {
    const statuses = [
      'pending_signup',
      'awaiting_kyc',
      'kyc_complete',
      'pending_admin_approval',
      'approved',
      'rejected',
      'suspended',
    ] as const;
    for (const s of statuses) {
      const r = computeRatingForMerchantStatus(s);
      if (r !== null) {
        expect(r).toBeGreaterThanOrEqual(1);
        expect(r).toBeLessThanOrEqual(5);
      }
    }
  });
});

describe('W0.D.9 constants', () => {
  it('BACKFILL_LIMIT matches the spec (1000 per tick)', () => {
    expect(BACKFILL_LIMIT).toBe(1000);
  });

  it('REFRESH_INTERVAL_DAYS matches the spec (7 days)', () => {
    expect(REFRESH_INTERVAL_DAYS).toBe(7);
  });
});

describe('W0.D.9 migration 0011_supplier_rating_backfill.sql', () => {
  const sql = readFileSync(join(MIG_DIR, '0011_supplier_rating_backfill.sql'), 'utf8');

  it('does NOT contain literal BEGIN/COMMIT (per ME §03.1)', () => {
    expect(/^\s*BEGIN\s*;/m.test(sql)).toBe(false);
    expect(/^\s*COMMIT\s*;/m.test(sql)).toBe(false);
  });

  it('adds supplier_rating_refreshed_at column to products via ADD COLUMN IF NOT EXISTS', () => {
    expect(sql).toMatch(/ALTER\s+TABLE\s+products\s+ADD\s+COLUMN\s+IF\s+NOT\s+EXISTS\s+supplier_rating_refreshed_at\s+TIMESTAMPTZ/i);
  });

  it('creates the partial watermark index with NULLS FIRST ordering', () => {
    expect(sql).toMatch(/CREATE\s+INDEX\s+IF\s+NOT\s+EXISTS\s+products_supplier_rating_watermark_idx/i);
    expect(sql).toMatch(/supplier_rating_refreshed_at\s+NULLS\s+FIRST/i);
    expect(sql).toMatch(/WHERE\s+retired_at\s+IS\s+NULL/i);
  });
});

describe('W0.D.9 rollback 0011_supplier_rating_backfill_rollback.sql', () => {
  const rb = readFileSync(join(MIG_DIR, '0011_supplier_rating_backfill_rollback.sql'), 'utf8');

  it('drops the index BEFORE the column (reverse of forward)', () => {
    const idxIdx = rb.indexOf('DROP INDEX IF EXISTS products_supplier_rating_watermark_idx');
    const colIdx = rb.indexOf('DROP COLUMN IF EXISTS supplier_rating_refreshed_at');
    expect(idxIdx).toBeGreaterThan(-1);
    expect(colIdx).toBeGreaterThan(idxIdx);
  });

  it('documents the schema_migrations bookkeeping step', () => {
    expect(rb).toMatch(/DELETE\s+FROM\s+schema_migrations\s+WHERE\s+version\s*=\s*'0011_supplier_rating_backfill'/i);
  });
});
