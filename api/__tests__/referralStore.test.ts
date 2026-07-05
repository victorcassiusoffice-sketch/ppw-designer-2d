/**
 * M7 — referralStore + ref-code generator + Pattern C handlers.
 */
import { describe, it, expect } from 'vitest';
import {
  mintRefCode,
  createInMemoryReferralStore,
  REF_CODE_HEX_BYTES,
} from '../_db/referralStore';
import {
  REFERRAL_OUTBOUND_BASE,
  validateRedirectQuery,
  buildOutboundUrl,
  processRedirect,
  parseReconcileQuery,
  referralRowToCsvRow,
  buildReconcileCsv,
} from '../orders';

describe('mintRefCode', () => {
  it('produces the PPW-<MERCHANT>-<DESIGN>-<HEX> shape', () => {
    const code = mintRefCode({ merchantSlug: 'k1-sport', designId: 'design42', randomHex: 'abc12345' });
    expect(code).toBe('PPW-K1-SPORT-DESIGN42-ABC12345');
  });

  it('falls back to NEW when designId is missing', () => {
    const code = mintRefCode({ merchantSlug: 'k1-sport', randomHex: '11223344' });
    expect(code).toBe('PPW-K1-SPORT-NEW-11223344');
  });

  it('uppercases + dashes the merchant slug', () => {
    const code = mintRefCode({ merchantSlug: 'new.shop', designId: 'd1', randomHex: 'ffff0000' });
    expect(code).toBe('PPW-NEW-SHOP-D1-FFFF0000');
  });

  it('truncates an over-long merchant slug to keep the code compact', () => {
    const code = mintRefCode({
      merchantSlug: 'absurdly-long-merchant-name',
      designId: 'd',
      randomHex: 'abcdef01',
    });
    // merchantSlug token is sliced to 12 chars.
    expect(code).toBe('PPW-ABSURDLY-LON-D-ABCDEF01');
  });

  it('emits 8 hex chars by default (4 random bytes)', () => {
    const code = mintRefCode({ merchantSlug: 'k1-sport', designId: 'd' });
    const hexPart = code.split('-').pop()!;
    expect(hexPart).toMatch(/^[A-F0-9]{8}$/);
    expect(hexPart.length).toBe(REF_CODE_HEX_BYTES * 2);
  });

  it('produces collision-resistant codes across 5k random calls', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 5_000; i++) {
      const c = mintRefCode({ merchantSlug: 'k1-sport', designId: 'd' });
      seen.add(c);
    }
    // With 32-bit suffix, expect no collisions at this volume (birthday
    // half-life ~65k). Allow one collision worst-case for flake safety.
    expect(seen.size).toBeGreaterThanOrEqual(4_999);
  });
});

describe('validateRedirectQuery', () => {
  it('accepts the minimum valid query', () => {
    const r = validateRedirectQuery({ slug: 'k1-sport' });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.query.slug).toBe('k1-sport');
      expect(r.baseUrl).toBe(REFERRAL_OUTBOUND_BASE['k1-sport']);
    }
  });

  it('rejects an unknown merchant slug with 404', () => {
    const r = validateRedirectQuery({ slug: 'never-heard-of' });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.status).toBe(404);
      expect(r.error).toMatch(/unknown merchant/);
    }
  });

  it('rejects a missing slug with 400', () => {
    const r = validateRedirectQuery({});
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe(400);
  });

  it('parses optional product metadata + clamps price', () => {
    const r = validateRedirectQuery({
      slug: 'k1-sport',
      productId: 'k1-nordictrack-2450',
      productSku: 'K1-CDIO-NT2450',
      productName: 'NordicTrack Commercial 2450',
      productPriceMinor: '15000000',
      productCurrency: 'mur',
      designId: 'design42',
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.query.productPriceMinor).toBe(15_000_000);
      expect(r.query.productCurrency).toBe('MUR');
      expect(r.query.productSku).toBe('K1-CDIO-NT2450');
      expect(r.query.designId).toBe('design42');
    }
  });

  it('rejects a non-numeric price', () => {
    const r = validateRedirectQuery({ slug: 'k1-sport', productPriceMinor: 'free' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe(400);
  });

  it('rejects an unknown currency', () => {
    const r = validateRedirectQuery({ slug: 'k1-sport', productCurrency: 'XBT' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe(400);
  });

  it('lowercases slug for canonical lookup', () => {
    const r = validateRedirectQuery({ slug: 'K1-Sport' });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.query.slug).toBe('k1-sport');
  });
});

describe('buildOutboundUrl', () => {
  it('appends ref + utm_* without breaking existing query string', () => {
    const out = buildOutboundUrl({
      baseUrl: 'https://www.k1-sport.com/shop-online?source=internal',
      refCode: 'PPW-K1-NEW-AABBCCDD',
    });
    const u = new URL(out);
    expect(u.searchParams.get('ref')).toBe('PPW-K1-NEW-AABBCCDD');
    expect(u.searchParams.get('utm_source')).toBe('ppw-designer');
    expect(u.searchParams.get('utm_medium')).toBe('referral');
    expect(u.searchParams.get('utm_campaign')).toBe('k1-pilot');
    expect(u.searchParams.get('source')).toBe('internal');
  });
});

describe('processRedirect', () => {
  it('writes a referral row and returns outbound URL', async () => {
    const store = createInMemoryReferralStore();
    const out = await processRedirect({
      query: {
        slug: 'k1-sport',
        productId: 'k1-nordictrack-2450',
        productSku: 'K1-CDIO-NT2450',
        productName: 'NordicTrack 2450',
        productPriceMinor: '15000000',
        productCurrency: 'MUR',
        designId: 'design-42',
        sessionId: 'sess-123',
      },
      userAgent: 'unit-test/1.0',
      ipHash: 'hashed-ip',
      store,
    });
    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(out.outboundUrl).toMatch(/^https:\/\/www\.k1-sport\.com\/shop-online\?/);
      expect(out.refCode).toMatch(/^PPW-K1-SPORT-DESIGN-42-[A-F0-9]{8}$/);
    }
    const rows = await store.list({});
    expect(rows.length).toBe(1);
    expect(rows[0].productSku).toBe('K1-CDIO-NT2450');
    expect(rows[0].userAgent).toBe('unit-test/1.0');
    expect(rows[0].ipHash).toBe('hashed-ip');
  });

  it('still returns ok+url when the store insert throws', async () => {
    const flaky = {
      ...createInMemoryReferralStore(),
      async insert(): Promise<never> {
        throw new Error('DB down');
      },
    };
    const out = await processRedirect({
      query: { slug: 'k1-sport' },
      store: flaky as unknown as ReturnType<typeof createInMemoryReferralStore>,
    });
    // Attribution failure must NOT block the customer redirect.
    expect(out.ok).toBe(true);
  });

  it('returns the validation error verbatim on bad input', async () => {
    const store = createInMemoryReferralStore();
    const out = await processRedirect({ query: { slug: '' }, store });
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.status).toBe(400);
  });
});

describe('parseReconcileQuery', () => {
  it('returns an unfiltered filter when query is empty', () => {
    const r = parseReconcileQuery({});
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.filter.merchantSlug).toBeUndefined();
      expect(r.filter.fromDate).toBeUndefined();
      expect(r.filter.toDate).toBeUndefined();
      expect(r.filename).toBe('ppw-referrals.csv');
    }
  });

  it('parses ISO date range', () => {
    const r = parseReconcileQuery({ from: '2026-05-01', to: '2026-05-31', merchant: 'K1-SPORT' });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.filter.merchantSlug).toBe('k1-sport');
      expect(r.filter.fromDate).toBe('2026-05-01');
      expect(r.filter.toDate).toBe('2026-05-31');
      expect(r.filename).toBe('ppw-referrals_k1-sport_2026-05-01_2026-05-31.csv');
    }
  });

  it('rejects non-ISO date', () => {
    const r = parseReconcileQuery({ from: '01/05/2026' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe(400);
  });

  it('rejects inverted range', () => {
    const r = parseReconcileQuery({ from: '2026-06-01', to: '2026-05-01' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe(400);
  });
});

describe('buildReconcileCsv', () => {
  it('emits a header row + body row with CRLF terminators', () => {
    const row = referralRowToCsvRow({
      refCode: 'PPW-K1-D42-AABBCCDD',
      createdAt: new Date('2026-05-19T10:00:00.000Z'),
      merchantSlug: 'k1-sport',
      designId: 'design42',
      sessionId: 'sess-1',
      productId: 'k1-nordictrack-2450',
      productSku: 'K1-CDIO-NT2450',
      productName: 'NordicTrack 2450',
      productPriceMinor: 15_000_000,
      productCurrency: 'MUR',
      outboundUrl: 'https://www.k1-sport.com/shop-online?ref=PPW-K1-D42-AABBCCDD',
      utmSource: 'ppw-designer',
      utmMedium: 'referral',
      utmCampaign: 'k1-pilot',
    });
    const csv = buildReconcileCsv([row]);
    const lines = csv.split('\r\n');
    expect(lines[0].split(',')).toContain('ref_code');
    expect(lines[0].split(',')).toContain('product_price_minor');
    expect(lines[1]).toContain('PPW-K1-D42-AABBCCDD');
    expect(lines[1]).toContain('15000000');
    expect(lines[1]).toContain('NordicTrack 2450');
    expect(csv.endsWith('\r\n')).toBe(true);
  });

  it('quotes + escapes commas, quotes and newlines in values', () => {
    const row = referralRowToCsvRow({
      refCode: 'PPW-X-A',
      createdAt: new Date('2026-05-19T10:00:00.000Z'),
      merchantSlug: 'k1-sport',
      designId: null,
      sessionId: null,
      productId: null,
      productSku: null,
      productName: 'Comma, "Quote" and\nnewline',
      productPriceMinor: null,
      productCurrency: null,
      outboundUrl: 'https://x.test',
      utmSource: null,
      utmMedium: null,
      utmCampaign: null,
    });
    const csv = buildReconcileCsv([row]);
    expect(csv).toContain('"Comma, ""Quote"" and\nnewline"');
  });

  it('emits an empty CSV (header only) for zero rows', () => {
    const csv = buildReconcileCsv([]);
    const lines = csv.split('\r\n');
    expect(lines[0]).toContain('ref_code');
    // header + trailing CRLF → 2 elements after split
    expect(lines.length).toBe(2);
    expect(lines[1]).toBe('');
  });
});
