export interface AdminSupplierRow {
  id: number;
  merchantId: number;
  merchantBrandName: string | null;
  name: string;
  contactEmail: string;
  contactPhone: string | null;
  country: string;
  status: 'pending' | 'active' | 'suspended';
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export const SUPPLIER_STATUS_FILTERS = ['all', 'pending', 'active', 'suspended'] as const;

export interface SupplierFilterState {
  status: string;
  search: string;
}

export function applySupplierFilters(
  rows: AdminSupplierRow[],
  f: SupplierFilterState,
): AdminSupplierRow[] {
  const term = f.search.trim().toLowerCase();
  return rows.filter((r) => {
    if (f.status !== 'all' && r.status !== f.status) return false;
    if (term && !`${r.name} ${r.contactEmail} ${r.merchantBrandName ?? ''}`.toLowerCase().includes(term))
      return false;
    return true;
  });
}
