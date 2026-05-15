import { describe, it, expect } from 'vitest';
import { applySupplierFilters, type AdminSupplierRow } from '../SuppliersListPage';

const sample: AdminSupplierRow[] = [
  {
    id: 1,
    merchantId: 1,
    merchantBrandName: 'IceCo',
    name: 'Acme Fulfilment',
    contactEmail: 'ops@acme.example',
    contactPhone: null,
    country: 'MU',
    status: 'active',
    notes: null,
    createdAt: '',
    updatedAt: '',
  },
  {
    id: 2,
    merchantId: 1,
    merchantBrandName: 'IceCo',
    name: 'Beta Logistics',
    contactEmail: 'hello@beta.test',
    contactPhone: null,
    country: 'GB',
    status: 'pending',
    notes: null,
    createdAt: '',
    updatedAt: '',
  },
  {
    id: 3,
    merchantId: 2,
    merchantBrandName: 'GreenLeaf',
    name: 'Acme Logistics',
    contactEmail: 'ops@acme-log.example',
    contactPhone: null,
    country: 'US',
    status: 'suspended',
    notes: null,
    createdAt: '',
    updatedAt: '',
  },
];

describe('applySupplierFilters', () => {
  it('returns all rows when status=all', () => {
    expect(applySupplierFilters(sample, { status: 'all', search: '' })).toHaveLength(3);
  });

  it('filters by exact status', () => {
    expect(applySupplierFilters(sample, { status: 'active', search: '' })).toHaveLength(1);
    expect(applySupplierFilters(sample, { status: 'pending', search: '' })).toHaveLength(1);
    expect(applySupplierFilters(sample, { status: 'suspended', search: '' })).toHaveLength(1);
  });

  it('searches across name + email + brand', () => {
    expect(applySupplierFilters(sample, { status: 'all', search: 'acme' })).toHaveLength(2);
    expect(applySupplierFilters(sample, { status: 'all', search: 'greenleaf' })).toHaveLength(1);
    expect(applySupplierFilters(sample, { status: 'all', search: 'beta.test' })).toHaveLength(1);
  });

  it('combines filters (AND logic)', () => {
    expect(applySupplierFilters(sample, { status: 'active', search: 'acme' })).toHaveLength(1);
  });
});
