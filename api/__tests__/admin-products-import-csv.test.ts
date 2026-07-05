/**
 * V3.1 M3.A.1 — admin product CSV import unit tests.
 *
 * Pure-function coverage of parseProductCsv + productCsvRowSchema +
 * csvRowToCreatePayload + validateCsvRows. The handler's DB/auth
 * orchestration is exercised at integration-mock level via the
 * admin-router dispatch test (admin-router.test.ts).
 */

import { describe, it, expect } from 'vitest';

import {
  CSV_HEADERS,
  parseProductCsv,
  productCsvRowSchema,
  csvRowToCreatePayload,
  validateCsvRows,
  type CsvRowRecord,
} from '../_lib/admin/products/importCsv';

const HEADER_LINE = CSV_HEADERS.join(',');

function csv(...rows: string[]): string {
  return [HEADER_LINE, ...rows].join('\n');
}

describe('parseProductCsv', () => {
  it('rejects empty body', () => {
    const r = parseProductCsv('');
    expect(r.ok).toBe(false);
  });

  it('rejects whitespace-only body', () => {
    const r = parseProductCsv('   \n  \n');
    expect(r.ok).toBe(false);
  });

  it('rejects header column count mismatch', () => {
    const r = parseProductCsv('merchant_id,sku,name\n1,A-001,Test');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/exactly 8 columns/);
  });

  it('rejects misnamed header column', () => {
    const wrong = HEADER_LINE.replace('sku', 'product_code');
    const r = parseProductCsv(`${wrong}\n1,A,Name,cat,100,USD,,`);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/column 2 must be "sku"/);
  });

  it('rejects when only the header line is present', () => {
    const r = parseProductCsv(HEADER_LINE);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/no data rows/);
  });

  it('parses a single valid row', () => {
    const r = parseProductCsv(csv('1,A-001,Ice Bath,ice_baths,12500,USD,1200x800x600,https://x.test/a.png'));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.rows).toHaveLength(1);
      expect(r.rows[0].sku).toBe('A-001');
      expect(r.rows[0].dimensions_mm).toBe('1200x800x600');
    }
  });

  it('parses multiple rows and tolerates blank lines', () => {
    const r = parseProductCsv(csv('1,A-001,Ice Bath,ice_baths,12500,USD,,', '', '2,A-002,Sauna,saunas,30000,USD,,'));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.rows).toHaveLength(2);
  });

  it('handles CRLF line endings', () => {
    const text = `${HEADER_LINE}\r\n1,A-001,Ice Bath,ice_baths,12500,USD,,\r\n`;
    const r = parseProductCsv(text);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.rows).toHaveLength(1);
  });

  it('parses quoted fields with embedded commas', () => {
    const r = parseProductCsv(csv('1,A-001,"Ice Bath, Pro",ice_baths,12500,USD,,'));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.rows[0].name).toBe('Ice Bath, Pro');
  });

  it('parses escaped double-quotes inside a quoted field', () => {
    const r = parseProductCsv(csv('1,A-001,"Sun ""Pro""",ice_baths,12500,USD,,'));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.rows[0].name).toBe('Sun "Pro"');
  });

  it('rejects a row with the wrong cell count', () => {
    const r = parseProductCsv(`${HEADER_LINE}\n1,A,Name,cat,100,USD,,extra,boom`);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/Row 2/);
  });
});

describe('productCsvRowSchema', () => {
  const valid: CsvRowRecord = {
    merchant_id: '7',
    sku: 'PROD-1',
    name: 'Ice Bath',
    category: 'ice_baths',
    price_minor: '12500',
    currency: 'USD',
    dimensions_mm: '1200x800x600',
    image_url: 'https://example.test/a.png',
  };

  it('accepts a minimal valid row', () => {
    const r = productCsvRowSchema.safeParse(valid);
    expect(r.success).toBe(true);
  });

  it('rejects empty merchant_id', () => {
    const r = productCsvRowSchema.safeParse({ ...valid, merchant_id: '' });
    expect(r.success).toBe(false);
  });

  it('rejects non-numeric merchant_id', () => {
    const r = productCsvRowSchema.safeParse({ ...valid, merchant_id: 'abc' });
    expect(r.success).toBe(false);
  });

  it('rejects negative price_minor (regex blocks the sign)', () => {
    const r = productCsvRowSchema.safeParse({ ...valid, price_minor: '-1' });
    expect(r.success).toBe(false);
  });

  it('rejects 2-letter currency', () => {
    const r = productCsvRowSchema.safeParse({ ...valid, currency: 'US' });
    expect(r.success).toBe(false);
  });

  it('allows missing dimensions_mm + image_url', () => {
    const r = productCsvRowSchema.safeParse({ ...valid, dimensions_mm: '', image_url: '' });
    expect(r.success).toBe(true);
  });

  it('rejects malformed dimensions_mm', () => {
    const r = productCsvRowSchema.safeParse({ ...valid, dimensions_mm: '1200 x 800' });
    expect(r.success).toBe(false);
  });

  it('rejects non-http image_url', () => {
    const r = productCsvRowSchema.safeParse({ ...valid, image_url: 'ftp://x/y' });
    expect(r.success).toBe(false);
  });
});

describe('csvRowToCreatePayload', () => {
  it('maps snake_case CSV → camelCase payload + expands dimensions', () => {
    const out = csvRowToCreatePayload({
      merchant_id: '3',
      sku: 'SKU-1',
      name: 'Sauna',
      category: 'saunas',
      price_minor: '30000',
      currency: 'EUR',
      dimensions_mm: '2000x1500x2000',
      image_url: 'https://x/y.png',
    });
    expect(out).toMatchObject({
      merchantId: 3,
      sku: 'SKU-1',
      name: 'Sauna',
      category: 'saunas',
      priceMinor: 30000,
      currency: 'EUR',
      widthMm: 2000,
      depthMm: 1500,
      heightMm: 2000,
      imageUrl: 'https://x/y.png',
    });
  });

  it('omits dimension keys when dimensions_mm is empty', () => {
    const out = csvRowToCreatePayload({
      merchant_id: '3',
      sku: 'SKU-1',
      name: 'Sauna',
      category: 'saunas',
      price_minor: '30000',
      currency: 'EUR',
      dimensions_mm: '',
      image_url: '',
    });
    expect(out).not.toHaveProperty('widthMm');
    expect(out).not.toHaveProperty('imageUrl');
  });
});

describe('validateCsvRows', () => {
  const okRow: CsvRowRecord = {
    merchant_id: '1',
    sku: 'A-1',
    name: 'A',
    category: 'cat',
    price_minor: '100',
    currency: 'USD',
    dimensions_mm: '',
    image_url: '',
  };

  it('flags row numbers starting at 2 (header is row 1)', () => {
    const results = validateCsvRows([okRow, okRow]);
    expect(results.map((r) => r.rowNumber)).toEqual([2, 3]);
  });

  it('reports row-level errors with concatenated path:message', () => {
    const bad: CsvRowRecord = { ...okRow, merchant_id: '', sku: '' };
    const [r] = validateCsvRows([bad]);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toMatch(/merchant_id/);
      expect(r.error).toMatch(/sku/);
    }
  });

  it('also runs the validateCreate shape gate (e.g. currency uppercasing path)', () => {
    const lower = { ...okRow, currency: 'usd' };
    const [r] = validateCsvRows([lower]);
    expect(r.ok).toBe(true);
    if (r.ok && r.payload) expect(r.payload.currency).toBe('USD');
  });

  it('continues past a bad row to validate the next one', () => {
    const bad: CsvRowRecord = { ...okRow, currency: 'X' };
    const results = validateCsvRows([bad, okRow]);
    expect(results[0].ok).toBe(false);
    expect(results[1].ok).toBe(true);
  });
});
