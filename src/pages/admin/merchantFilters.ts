export interface MerchantRow {
  id: number;
  slug: string;
  businessName: string;
  brandName: string;
  contactName: string;
  contactEmail: string;
  status: string;
  country: string;
  createdAt: string;
  productCategories: string[];
}

export interface MerchantsFilterState {
  status: string; // 'all' or one of the statuses
  search: string;
  page: number;
  perPage: number;
}

export const ALL_STATUSES = [
  'all',
  'pending_admin_approval',
  'kyc_complete',
  'awaiting_kyc',
  'approved',
  'rejected',
  'suspended',
] as const;

/**
 * Apply filter + search + pagination to a merchant list. Pure so we
 * can unit test it without rendering a component.
 */
export function applyMerchantFilters(
  rows: MerchantRow[],
  filter: MerchantsFilterState,
): { filtered: MerchantRow[]; page: MerchantRow[]; total: number; pageCount: number } {
  const term = filter.search.trim().toLowerCase();

  const filtered = rows.filter((r) => {
    if (filter.status !== 'all' && r.status !== filter.status) return false;
    if (!term) return true;
    return (
      r.businessName.toLowerCase().includes(term) ||
      r.contactEmail.toLowerCase().includes(term) ||
      r.brandName.toLowerCase().includes(term)
    );
  });

  const total = filtered.length;
  const perPage = Math.max(1, filter.perPage);
  const pageCount = Math.max(1, Math.ceil(total / perPage));
  const page = Math.min(Math.max(1, filter.page), pageCount);
  const offset = (page - 1) * perPage;
  return {
    filtered,
    page: filtered.slice(offset, offset + perPage),
    total,
    pageCount,
  };
}

/** Debounce helper (no dep on lodash). */
