/**
 * MerchantsListPage — pure-logic tests.
 *
 * The page renders Clerk hooks + a Router + a DOM, none of which run
 * in this vitest project's `environment: 'node'` config. We test the
 * extracted `applyMerchantFilters()` function which is where the
 * filter / search / pagination logic actually lives.
 */

import { describe, it, expect } from 'vitest';
import { applyMerchantFilters, type MerchantRow } from '../MerchantsListPage';

function row(over: Partial<MerchantRow>): MerchantRow {
  return {
    id: 1,
    slug: 'biz',
    businessName: 'Biz Co',
    brandName: 'Biz',
    contactName: 'Jane',
    contactEmail: 'jane@biz.example',
    status: 'pending_admin_approval',
    country: 'MU',
    createdAt: '2026-04-01T00:00:00Z',
    productCategories: ['plants'],
    ...over,
  };
}

describe('applyMerchantFilters — status filter', () => {
  const rows = [
    row({ id: 1, status: 'pending_admin_approval' }),
    row({ id: 2, status: 'approved' }),
    row({ id: 3, status: 'rejected' }),
  ];

  it('returns all rows when filter is "all"', () => {
    const out = applyMerchantFilters(rows, {
      status: 'all',
      search: '',
      page: 1,
      perPage: 25,
    });
    expect(out.total).toBe(3);
    expect(out.page.map((r) => r.id)).toEqual([1, 2, 3]);
  });

  it('filters by a specific status', () => {
    const out = applyMerchantFilters(rows, {
      status: 'approved',
      search: '',
      page: 1,
      perPage: 25,
    });
    expect(out.total).toBe(1);
    expect(out.page[0].id).toBe(2);
  });
});

describe('applyMerchantFilters — search', () => {
  const rows = [
    row({ id: 1, businessName: 'Aurora Wellness', contactEmail: 'a@aurora.co' }),
    row({ id: 2, businessName: 'Mountain Gear', contactEmail: 'admin@mountain.co' }),
    row({ id: 3, businessName: 'Aurora Plants', brandName: 'AuroraGreen', contactEmail: 'p@plants.co' }),
  ];

  it('matches by business name (case-insensitive, substring)', () => {
    const out = applyMerchantFilters(rows, {
      status: 'all',
      search: 'aurora',
      page: 1,
      perPage: 25,
    });
    expect(out.total).toBe(2);
    expect(out.page.map((r) => r.id).sort()).toEqual([1, 3]);
  });

  it('matches by contact email', () => {
    const out = applyMerchantFilters(rows, {
      status: 'all',
      search: 'mountain.co',
      page: 1,
      perPage: 25,
    });
    expect(out.total).toBe(1);
    expect(out.page[0].id).toBe(2);
  });

  it('matches by brand name', () => {
    const out = applyMerchantFilters(rows, {
      status: 'all',
      search: 'auroragreen',
      page: 1,
      perPage: 25,
    });
    expect(out.total).toBe(1);
    expect(out.page[0].id).toBe(3);
  });

  it('returns zero rows when search has no match', () => {
    const out = applyMerchantFilters(rows, {
      status: 'all',
      search: 'no-such-merchant',
      page: 1,
      perPage: 25,
    });
    expect(out.total).toBe(0);
  });

  it('treats blank search as no filter', () => {
    const out = applyMerchantFilters(rows, {
      status: 'all',
      search: '   ',
      page: 1,
      perPage: 25,
    });
    expect(out.total).toBe(3);
  });
});

describe('applyMerchantFilters — pagination', () => {
  const rows = Array.from({ length: 73 }, (_, i) => row({ id: i + 1 }));

  it('returns the requested page (default perPage = 25)', () => {
    const out = applyMerchantFilters(rows, {
      status: 'all',
      search: '',
      page: 2,
      perPage: 25,
    });
    expect(out.page).toHaveLength(25);
    expect(out.page[0].id).toBe(26);
    expect(out.pageCount).toBe(3);
  });

  it('clamps overshooting page to the last page', () => {
    const out = applyMerchantFilters(rows, {
      status: 'all',
      search: '',
      page: 99,
      perPage: 25,
    });
    // total=73, perPage=25 → pages 1,2,3 with page 3 holding 23 rows.
    expect(out.page).toHaveLength(23);
    expect(out.page[0].id).toBe(51);
  });

  it('clamps page < 1 to page 1', () => {
    const out = applyMerchantFilters(rows, {
      status: 'all',
      search: '',
      page: -3,
      perPage: 25,
    });
    expect(out.page[0].id).toBe(1);
  });

  it('combines status + search + pagination correctly', () => {
    const rows2 = [
      row({ id: 1, businessName: 'Aurora 1', status: 'pending_admin_approval' }),
      row({ id: 2, businessName: 'Aurora 2', status: 'approved' }),
      row({ id: 3, businessName: 'Aurora 3', status: 'pending_admin_approval' }),
      row({ id: 4, businessName: 'Mountain', status: 'pending_admin_approval' }),
    ];
    const out = applyMerchantFilters(rows2, {
      status: 'pending_admin_approval',
      search: 'aurora',
      page: 1,
      perPage: 1,
    });
    expect(out.total).toBe(2);
    expect(out.page).toHaveLength(1);
    expect(out.pageCount).toBe(2);
  });
});
