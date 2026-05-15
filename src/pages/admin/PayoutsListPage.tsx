/**
 * /admin/payouts — Phase 2 stub for the Phase 4 payouts worker.
 *
 * The `payout_queue` table is created in migration 0003 (this slice).
 * Until the disbursement worker lands the queue stays empty — the
 * page surfaces an explanatory message so Vic knows this is by design.
 */

import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth, UserButton } from '@clerk/clerk-react';

interface PayoutRow {
  id: number;
  merchantId: number;
  amountMinor: number;
  currency: string;
  rail: string;
  status: string;
  scheduledFor: string;
  processedAt: string | null;
  externalPayoutId: string | null;
  note: string | null;
  createdAt: string;
}

interface FetchState {
  loading: boolean;
  error: string | null;
  items: PayoutRow[];
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

export default function PayoutsListPage() {
  const { getToken, isLoaded } = useAuth();
  const [state, setState] = useState<FetchState>(INITIAL);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>('');

  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const token = await getToken();
      if (!token) throw new Error('Not signed in.');
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('perPage', '25');
      if (statusFilter) params.set('status', statusFilter);
      const res = await fetch(`/api/admin/payouts?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = (await res.json()) as {
        items?: PayoutRow[];
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
  }, [getToken, page, statusFilter]);

  useEffect(() => {
    if (!isLoaded) return;
    load();
  }, [isLoaded, load]);

  useEffect(() => {
    setPage(1);
  }, [statusFilter]);

  const pageCount = Math.max(1, Math.ceil(state.total / Math.max(1, state.perPage)));

  return (
    <main className="min-h-screen bg-ppw-sand text-ppw-ink">
      <header className="bg-ppw-ink text-white px-6 py-4 flex items-center justify-between">
        <div>
          <p className="text-[10px] uppercase tracking-widest opacity-80">PPW Marketplace</p>
          <h1 className="font-serif text-xl">Admin · Payouts</h1>
        </div>
        <UserButton afterSignOutUrl="/admin/payouts" />
      </header>

      <section className="max-w-6xl mx-auto p-6">
        <nav className="mb-4 flex gap-4 text-sm">
          <Link to="/admin/merchants" className="text-ppw-slate hover:text-ppw-ink">
            Merchants
          </Link>
          <Link to="/admin/orders" className="text-ppw-slate hover:text-ppw-ink">
            Orders
          </Link>
          <Link to="/admin/payouts" className="text-ppw-coral font-semibold">
            Payouts
          </Link>
        </nav>

        <div className="mb-4 rounded border border-ppw-slate/20 bg-white p-4 text-sm text-ppw-slate">
          <strong className="text-ppw-ink">Phase 4 preview.</strong> The disbursement worker that
          fills this queue ships in Phase 4. Until then the table is intentionally empty — the
          schema is already deployed so Phase 4 can plug straight in.
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-2">
          {['', 'queued', 'processing', 'sent', 'failed'].map((s) => (
            <button
              key={s || 'all'}
              type="button"
              onClick={() => setStatusFilter(s)}
              className={
                'rounded-full px-3 py-1 text-xs border ' +
                (statusFilter === s
                  ? 'bg-ppw-ink text-white border-ppw-ink'
                  : 'bg-white text-ppw-slate border-ppw-slate/30 hover:border-ppw-ink')
              }
            >
              {s || 'all'}
            </button>
          ))}
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
            The <code>payout_queue</code> table doesn't exist yet — apply migration{' '}
            <code>0003_admin_portal.sql</code> in Neon.
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
            No payouts queued yet.
          </div>
        ) : (
          <>
            <div className="overflow-x-auto rounded-lg border border-ppw-slate/15 bg-white">
              <table className="min-w-full text-sm">
                <thead className="bg-ppw-sand/60 text-xs uppercase tracking-wider text-ppw-slate">
                  <tr>
                    <th className="text-left px-4 py-2">Id</th>
                    <th className="text-left px-4 py-2">Merchant</th>
                    <th className="text-left px-4 py-2">Amount</th>
                    <th className="text-left px-4 py-2">Rail</th>
                    <th className="text-left px-4 py-2">Status</th>
                    <th className="text-left px-4 py-2">Scheduled</th>
                  </tr>
                </thead>
                <tbody>
                  {state.items.map((p) => (
                    <tr key={p.id} className="border-t border-ppw-slate/10">
                      <td className="px-4 py-2 font-mono text-xs">{p.id}</td>
                      <td className="px-4 py-2 text-xs">{p.merchantId}</td>
                      <td className="px-4 py-2 text-xs">
                        {(p.amountMinor / 100).toFixed(2)} {p.currency}
                      </td>
                      <td className="px-4 py-2 text-xs">{p.rail}</td>
                      <td className="px-4 py-2">
                        <span className="inline-block rounded bg-ppw-sand px-2 py-0.5 font-mono text-xs">
                          {p.status}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-xs text-ppw-slate">
                        {new Date(p.scheduledFor).toLocaleString()}
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
