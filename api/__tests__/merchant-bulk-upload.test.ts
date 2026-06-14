/**
 * Phase 5 — merchant bulk catalog upload tests.
 *   - preview: validates + previews, rejects bad SKU/price (no write).
 *   - commit: inserts valid rows via an injected createProduct fn;
 *     bad rows reported, never abort the batch.
 */

import { describe, it, expect } from 'vitest';
import { previewBulkUpload, commitBulkUpload, type CreateProductFn } from '../lib/merchants/bulkUpload';

const HEADER = 'merchant_id,sku,name,category,price_minor,currency,dimensions_mm,image_url';
const goodRow = '1,ICE-1,Ice Bath,recovery,150000,MUR,1200x800x600,';
const badPriceRow = '1,ICE-2,Bad Price,recovery,notanumber,MUR,,';
const badSkuRow = '1,,No SKU,recovery,1000,MUR,,';

describe('previewBulkUpload', () => {
  it('400 on empty / malformed CSV', () => {
    expect(previewBulkUpload('').status).toBe(400);
    expect(previewBulkUpload('wrong,header').status).toBe(400);
  });
  it('counts valid + reports invalid rows without writing', () => {
    const csv = [HEADER, goodRow, badPriceRow, badSkuRow].join('\n');
    const r = previewBulkUpload(csv);
    expect(r.ok).toBe(true);
    expect(r.totalRows).toBe(3);
    expect(r.validCount).toBe(1);
    expect(r.invalid).toHaveLength(2);
    expect(r.preview?.[0]).toMatchObject({ sku: 'ICE-1', priceMinor: 150000, currency: 'MUR' });
  });
});

describe('commitBulkUpload', () => {
  it('inserts valid rows via injected createProduct; reports failures', async () => {
    const csv = [HEADER, goodRow, badPriceRow].join('\n');
    const calls: Array<{ slug: string; payload: unknown }> = [];
    const createProduct: CreateProductFn = async (slug, payload) => {
      calls.push({ slug, payload });
      return { ok: true, status: 201, product: { id: 99, sku: 'ICE-1', name: 'Ice Bath', category: 'recovery', priceMinor: 150000, currency: 'MUR', imageUrl: null, ecoCertLevel: 'none' } };
    };
    const r = await commitBulkUpload('k1-sport', csv, { createProduct });
    expect(r.ok).toBe(true);
    expect(r.status).toBe(201);
    expect(r.created).toEqual([{ rowNumber: 2, sku: 'ICE-1', id: 99 }]);
    expect(r.failed).toHaveLength(1); // the bad-price row
    // The injected create got a merchant-scoped payload WITHOUT merchantId.
    expect(calls).toHaveLength(1);
    expect(calls[0].slug).toBe('k1-sport');
    expect(calls[0].payload).not.toHaveProperty('merchantId');
    expect(calls[0].payload).toMatchObject({ sku: 'ICE-1', priceMinor: 150000, widthMm: 1200 });
  });

  it('surfaces a per-row create failure without aborting', async () => {
    const csv = [HEADER, goodRow].join('\n');
    const createProduct: CreateProductFn = async () => ({ ok: false, status: 409, error: 'sku_conflict' });
    const r = await commitBulkUpload('k1-sport', csv, { createProduct });
    expect(r.created).toEqual([]);
    expect(r.failed?.[0]).toMatchObject({ rowNumber: 2, error: 'sku_conflict' });
    expect(r.status).toBe(200);
  });

  it('400 on malformed CSV', async () => {
    const r = await commitBulkUpload('k1-sport', 'nope', {});
    expect(r.status).toBe(400);
  });
});
