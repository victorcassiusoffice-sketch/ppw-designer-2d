/**
 * /admin/merchants — Phase 2 enhanced merchant queue.
 *
 * Replaces the Phase 1 stub at `src/pages/AdminMerchantsPage.tsx`.
 * Features:
 *   - Status filter chips (all / pending_admin_approval / approved /
 *     rejected / suspended / awaiting_kyc)
 *   - Search by business name OR contact email (client-side, debounced).
 *   - Paginated table (25/page).
 *   - Click row → `/admin/merchants/:slug` (detail page).
 *
 * Phase 1's list endpoint still only surfaces pending_admin_approval
 * merchants — when Phase 2's list-all endpoint lands the SAME UI will
 * just gain the extra rows. Filter chips already gracefully no-op when
 * a status isn't represented.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth, UserButton } from '@clerk/clerk-react';

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
function useDebounced<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return debounced;
}

interface FetchState {
  loading: boolean;
  error: string | null;
  rows: MerchantRow[];
}

const INITIAL: FetchState = { loading: true, error: null, rows: [] };

export default function MerchantsListPage() {
  const { getToken, isLoaded } = useAuth();
  const [fetchState, setFetchState] = useState<FetchState>(INITIAL);
  const [status, setStatus] = useState<string>('all');
  const [searchInput, setSearchInput] = useState('');
  const search = useDebounced(searchInput, 250);
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    setFetchState((s) => ({ ...s, loading: true, error: null }));
    try {
      const token = await getToken();
      if (!token) throw new Error('Not signed in.');
      const res = await fetch('/api/admin/merchants', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = (await res.json()) as { merchants?: MerchantRow[]; error?: string };
      if (!res.ok) {
        setFetchState({ loading: false, error: data.error ?? 'Request failed', rows: [] });
        return;
      }
      setFetchState({ loading: false, error: null, rows: data.merchants ?? [] });
    } catch (err) {
      setFetchState({
        loading: false,
        error: err instanceof Error ? err.message : 'Network error',
        rows: [],
      });
    }
  }, [getToken]);

  useEffect(() => {
    if (!isLoaded) return;
    load();
  }, [isLoaded, load]);

  // Reset to page 1 when filters change.
  useEffect(() => {
    setPage(1);
  }, [status, search]);

  const filterState: MerchantsFilterState = useMemo(
    () => ({ status, search, page, perPage: 25 }),
    [status, search, page],
  );
  const view = useMemo(
    () => applyMerchantFilters(fetchState.rows, filterState),
    [fetchState.rows, filterState],
  );

  return (
    <main className="min-h-screen bg-ppw-sand text-ppw-ink">
      <header className="bg-ppw-ink text-white px-6 py-4 flex items-center justify-between">
        <div>
          <p className="text-[10px] uppercase tracking-widest opacity-80">PPW Marketplace</p>
          <h1 className="font-serif text-xl">Admin · Merchants</h1>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <UserButton afterSignOutUrl="/admin/merchants" />
        </div>
      </header>

      <section className="max-w-6xl mx-auto p-6">
        <nav className="mb-4 flex gap-4 text-sm">
          <Link to="/admin/merchants" className="text-ppw-coral font-semibold">
            Merchants
          </Link>
          <Link to="/admin/orders" className="text-ppw-slate hover:text-ppw-ink">
            Orders
          </Link>
          <Link to="/admin/payouts" className="text-ppw-slate hover:text-ppw-ink">
            Payouts
          </Link>
        </nav>

        <div className="mb-4 flex flex-wrap items-center gap-2">
          {ALL_STATUSES.map((s) => (
            <button
              key={s}
              type="button"
              data-testid={`chip-${s}`}
              onClick={() => setStatus(s)}
              className={
                'rounded-full px-3 py-1 text-xs border ' +
                (status === s
                  ? 'bg-ppw-ink text-white border-ppw-ink'
                  : 'bg-white text-ppw-slate border-ppw-slate/30 hover:border-ppw-ink')
              }
            >
              {s.replace(/_/g, ' ')}
            </button>
          ))}
          <input
            type="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search business name or email…"
            data-testid="search-input"
            className="ml-auto rounded border border-ppw-slate/30 px-3 py-1.5 text-sm min-w-[260px]"
          />
          <button
            type="button"
            onClick={() => load()}
            className="rounded border border-ppw-slate/30 px-3 py-1.5 text-xs"
          >
            Refresh
          </button>
        </div>

        {fetchState.loading ? (
          <p className="text-sm text-ppw-slate">Loading…</p>
        ) : fetchState.error ? (
          <div className="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            {fetchState.error}
          </div>
        ) : view.total === 0 ? (
          <div className="rounded border border-ppw-slate/20 bg-white p-6 text-sm text-ppw-slate">
            No merchants match the current filter.
          </div>
        ) : (
          <>
            <div className="overflow-x-auto rounded-lg border border-ppw-slate/15 bg-white">
              <table className="min-w-full text-sm">
                <thead className="bg-ppw-sand/60 text-xs uppercase tracking-wider text-ppw-slate">
                  <tr>
                    <th className="text-left px-4 py-2">Business</th>
                    <th className="text-left px-4 py-2">Contact</th>
                    <th className="text-left px-4 py-2">Country</th>
                    <th className="text-left px-4 py-2">Status</th>
                    <th className="text-left px-4 py-2">Applied</th>
                    <th className="text-left px-4 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {view.page.map((m) => (
                    <tr key={m.id} className="border-t border-ppw-slate/10">
                      <td className="px-4 py-2">
                        <div className="font-semibold">{m.businessName}</div>
                        <div className="text-xs text-ppw-slate">{m.brandName}</div>
                      </td>
                      <td className="px-4 py-2">
                        <div>{m.contactName}</div>
                        <div className="text-xs text-ppw-slate">{m.contactEmail}</div>
                      </td>
                      <td className="px-4 py-2">{m.country}</td>
                      <td className="px-4 py-2">
                        <span className="inline-block rounded bg-ppw-sand px-2 py-0.5 font-mono text-xs">
                          {m.status}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-xs text-ppw-slate">
                        {new Date(m.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-2 text-right">
                        <Link
                          to={`/admin/merchants/${m.slug}`}
                          className="text-ppw-coral text-xs font-semibold"
                        >
                          View →
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-4 flex items-center justify-between text-xs text-ppw-slate">
              <span>
                Showing {view.page.length} of {view.total} ({view.pageCount} pages)
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="rounded border border-ppw-slate/30 px-3 py-1 disabled:opacity-40"
                >
                  Prev
                </button>
                <span className="px-2 py-1">{page}</span>
                <button
                  type="button"
                  disabled={page >= view.pageCount}
                  onClick={() => setPage((p) => Math.min(view.pageCount, p + 1))}
                  className="rounded border border-ppw-slate/30 px-3 py-1 disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </section>
    </main>
  );
}
