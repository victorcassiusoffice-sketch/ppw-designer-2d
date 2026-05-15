/**
 * /admin/orders — Phase 2 orders list (read-only).
 *
 * Reads from /api/admin/orders, which in turn reads from the `orders`
 * table created by the PayPal slice migration. If that migration
 * hasn't landed yet the API returns an empty page with a
 * `X-Schema-Missing: orders` header — we read the JSON `schemaMissing`
 * flag (mirror of that header) and show a "PayPal slice not yet
 * deployed" notice instead of looking broken.
 */

import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth, UserButton } from '@clerk/clerk-react';

interface OrderRow {
  id?: number | string;
  rail?: string;
  status?: string;
  amount_minor?: number;
  currency?: string;
  created_at?: string;
  merchant_id?: number;
  // Tolerate unknown columns — Phase 2 doesn't own this schema.
  [k: string]: unknown;
}

interface FetchState {
  loading: boolean;
  error: string | null;
  items: OrderRow[];
  total: number;
  page: number;
  perPage: number;
  schemaMissing: boolean;
}

const INITIAL: FetchState = {
  loading: true,
  error: null,
  items: [],
  total: 0,
  page: 1,
  perPage: 25,
  schemaMissing: false,
};

const RAILS = ['', 'stripe', 'paypal', 'mips', 'mcb_juice', 'bank_transfer'];

export default function OrdersListPage() {
  const { getToken, isLoaded } = useAuth();
  const [state, setState] = useState<FetchState>(INITIAL);
  const [rail, setRail] = useState<string>('');
  const [status, setStatus] = useState<string>('');
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const token = await getToken();
      if (!token) throw new Error('Not signed in.');
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('perPage', '25');
      if (rail) params.set('rail', rail);
      if (status) params.set('status', status);
      const res = await fetch(`/api/admin/orders?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = (await res.json()) as {
        items?: OrderRow[];
        total?: number;
        page?: number;
        perPage?: number;
        schemaMissing?: boolean;
        error?: string;
      };
      if (!res.ok) {
        setState({ ...INITIAL, loading: false, error: data.error ?? 'Request failed' });
        return;
      }
      setState({
        loading: false,
        error: null,
        items: data.items ?? [],
        total: data.total ?? 0,
        page: data.page ?? page,
        perPage: data.perPage ?? 25,
        schemaMissing: !!data.schemaMissing,
      });
    } catch (err) {
      setState({
        ...INITIAL,
        loading: false,
        error: err instanceof Error ? err.message : 'Network error',
      });
    }
  }, [getToken, page, rail, status]);

  useEffect(() => {
    if (!isLoaded) return;
    load();
  }, [isLoaded, load]);

  useEffect(() => {
    setPage(1);
  }, [rail, status]);

  const pageCount = Math.max(1, Math.ceil(state.total / Math.max(1, state.perPage)));

  return (
    <main className="min-h-screen bg-ppw-sand text-ppw-ink">
      <header className="bg-ppw-ink text-white px-6 py-4 flex items-center justify-between">
        <div>
          <p className="text-[10px] uppercase tracking-widest opacity-80">PPW Marketplace</p>
          <h1 className="font-serif text-xl">Admin · Orders</h1>
        </div>
        <UserButton afterSignOutUrl="/admin/orders" />
      </header>

      <section className="max-w-6xl mx-auto p-6">
        <nav className="mb-4 flex gap-4 text-sm">
          <Link to="/admin/merchants" className="text-ppw-slate hover:text-ppw-ink">
            Merchants
          </Link>
          <Link to="/admin/orders" className="text-ppw-coral font-semibold">
            Orders
          </Link>
          <Link to="/admin/payouts" className="text-ppw-slate hover:text-ppw-ink">
            Payouts
          </Link>
        </nav>

        <div className="mb-4 flex flex-wrap items-center gap-2">
          <label className="text-xs text-ppw-slate flex items-center gap-1">
            Rail:
            <select
              value={rail}
              onChange={(e) => setRail(e.target.value)}
              className="rounded border border-ppw-slate/30 px-2 py-1 text-xs"
            >
              {RAILS.map((r) => (
                <option key={r} value={r}>
                  {r || 'all'}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-ppw-slate flex items-center gap-1">
            Status:
            <input
              type="text"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              placeholder="any"
              className="rounded border border-ppw-slate/30 px-2 py-1 text-xs w-32"
            />
          </label>
          <button
            type="button"
            onClick={() => load()}
            className="ml-auto rounded border border-ppw-slate/30 px-3 py-1.5 text-xs"
          >
            Refresh
          </button>
        </div>

        {state.schemaMissing ? (
          <div className="rounded border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 mb-4">
            The <code>orders</code> table doesn't exist yet. The PayPal payment-rails slice
            (migration <code>0002_payment_rails.sql</code>) creates it. Once Vic deploys that slice
            this page will populate automatically.
          </div>
        ) : null}

        {state.loading ? (
          <p className="text-sm text-ppw-slate">Loading…</p>
        ) : state.error ? (
          <div className="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            {state.error}
          </div>
        ) : state.items.length === 0 ? (
          <div className="rounded border border-ppw-slate/20 bg-white p-6 text-sm text-ppw-slate">
            No orders match the current filter.
          </div>
        ) : (
          <>
            <div className="overflow-x-auto rounded-lg border border-ppw-slate/15 bg-white">
              <table className="min-w-full text-sm">
                <thead className="bg-ppw-sand/60 text-xs uppercase tracking-wider text-ppw-slate">
                  <tr>
                    <th className="text-left px-4 py-2">Order id</th>
                    <th className="text-left px-4 py-2">Rail</th>
                    <th className="text-left px-4 py-2">Status</th>
                    <th className="text-left px-4 py-2">Amount</th>
                    <th className="text-left px-4 py-2">Merchant</th>
                    <th className="text-left px-4 py-2">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {state.items.map((o, idx) => (
                    <tr key={String(o.id ?? idx)} className="border-t border-ppw-slate/10">
                      <td className="px-4 py-2 font-mono text-xs">{String(o.id ?? '—')}</td>
                      <td className="px-4 py-2 text-xs">{o.rail ?? '—'}</td>
                      <td className="px-4 py-2">
                        <span className="inline-block rounded bg-ppw-sand px-2 py-0.5 font-mono text-xs">
                          {o.status ?? '—'}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-xs">
                        {typeof o.amount_minor === 'number'
                          ? `${(o.amount_minor / 100).toFixed(2)} ${o.currency ?? ''}`
                          : '—'}
                      </td>
                      <td className="px-4 py-2 text-xs">{String(o.merchant_id ?? '—')}</td>
                      <td className="px-4 py-2 text-xs text-ppw-slate">
                        {o.created_at ? new Date(String(o.created_at)).toLocaleString() : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-4 flex items-center justify-between text-xs text-ppw-slate">
              <span>
                Showing {state.items.length} of {state.total} ({pageCount} pages)
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
                  disabled={page >= pageCount}
                  onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
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
