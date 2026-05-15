import { describe, it, expect } from 'vitest';
import { applyProductFilters, type AdminProductRow } from '../ProductsListPage';

const sample: AdminProductRow[] = [
  {
    id: 1,
    merchantId: 1,
    merchantBrandName: 'IceCo',
    sku: 'IB-001',
    name: 'Ice Bath Pro',
    category: 'ice_baths',
    status: 'active',
    priceMinor: 12500,
    currency: 'USD',
    imageUrl: null,
    region: null,
    createdAt: '',
    updatedAt: '',
  },
  {
    id: 2,
    merchantId: 1,
    merchantBrandName: 'IceCo',
    sku: 'IB-002',
    name: 'Ice Bath Mini',
    category: 'ice_baths',
    status: 'draft',
    priceMinor: 7500,
    currency: 'USD',
    imageUrl: null,
    region: null,
    createdAt: '',
    updatedAt: '',
  },
  {
    id: 3,
    merchantId: 2,
    merchantBrandName: 'GreenLeaf',
    sku: 'PL-100',
    name: 'Office Plant',
    category: 'plants',
    status: 'active',
    priceMinor: 4500,
    currency: 'USD',
    imageUrl: null,
    region: null,
    createdAt: '',
    updatedAt: '',
  },
];

describe('applyProductFilters', () => {
  it('returns all when status=all + no other filters', () => {
    expect(applyProductFilters(sample, { status: 'all', category: '', search: '' })).toHaveLength(3);
  });

  it('filters by exact status', () => {
    expect(applyProductFilters(sample, { status: 'draft', category: '', search: '' })).toHaveLength(1);
    expect(applyProductFilters(sample, { status: 'active', category: '', search: '' })).toHaveLength(2);
  });

  it('filters by category (case-insensitive)', () => {
    expect(applyProductFilters(sample, { status: 'all', category: 'ICE_BATHS', search: '' })).toHaveLength(2);
    expect(applyProductFilters(sample, { status: 'all', category: 'plants', search: '' })).toHaveLength(1);
  });

  it('searches across SKU, name, and brand', () => {
    expect(applyProductFilters(sample, { status: 'all', category: '', search: 'mini' })).toHaveLength(1);
    expect(applyProductFilters(sample, { status: 'all', category: '', search: 'iceco' })).toHaveLength(2);
    expect(applyProductFilters(sample, { status: 'all', category: '', search: 'IB-001' })).toHaveLength(1);
  });

  it('combines filters (AND logic)', () => {
    expect(
      applyProductFilters(sample, { status: 'active', category: 'ice_baths', search: '' }),
    ).toHaveLength(1);
  });

  it('returns empty when no rows match', () => {
    expect(
      applyProductFilters(sample, { status: 'archived', category: '', search: '' }),
    ).toHaveLength(0);
  });
});
