export interface AdminProductRow {
  id: number;
  merchantId: number;
  merchantBrandName: string | null;
  sku: string;
  name: string;
  category: string;
  status: 'draft' | 'active' | 'archived' | 'out_of_stock';
  priceMinor: number;
  currency: string;
  imageUrl: string | null;
  region: string | null;
  createdAt: string;
  updatedAt: string;
}

export const PRODUCT_STATUS_FILTERS = [
  'all',
  'draft',
  'active',
  'archived',
  'out_of_stock',
] as const;

export interface ProductFilterState {
  status: string;
  category: string;
  search: string;
}

export function applyProductFilters(
  rows: AdminProductRow[],
  f: ProductFilterState,
): AdminProductRow[] {
  const term = f.search.trim().toLowerCase();
  const cat = f.category.trim().toLowerCase();
  return rows.filter((r) => {
    if (f.status !== 'all' && r.status !== f.status) return false;
    if (cat && r.category.toLowerCase() !== cat) return false;
    if (term && !`${r.sku} ${r.name} ${r.merchantBrandName ?? ''}`.toLowerCase().includes(term))
      return false;
    return true;
  });
}
