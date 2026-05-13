/**
 * /admin/merchants — Vic-only merchant approval queue.
 *
 * Phase 1 STUB: lists merchants in status=`pending_admin_approval`.
 * Approve / Reject buttons hit the corresponding API endpoints.
 * Phase 2 will replace this with the full Phase 2 admin portal
 * (audit log, orders, refunds, disputes).
 *
 * The page is wrapped in Clerk's <SignedIn> / <SignedOut> conditional
 * UI by the parent <AdminRoute>; API calls send `getToken()` as the
 * Bearer credential.
 */

import { useCallback, useEffect, useState } from 'react';
import { useAuth, UserButton } from '@clerk/clerk-react';

interface MerchantSummary {
  id: number;
  slug: string;
  businessName: string;
  brandName: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  country: string;
  website: string | null;
  productCategories: string[];
  estimatedMonthlyVolume: string | null;
  referralNotes: string | null;
  status: string;
  createdAt: string;
  notes: string | null;
  stripeConnectAccountId: string | null;
}

interface AdminInfo {
  email: string;
  role: 'super_admin' | 'reviewer';
}

interface FetchState {
  loading: boolean;
  error: string | null;
  admin: AdminInfo | null;
  merchants: MerchantSummary[];
}

const INITIAL: FetchState = {
  loading: true,
  error: null,
  admin: null,
  merchants: [],
};

export default function AdminMerchantsPage() {
  const { getToken, isLoaded } = useAuth();
  const [state, setState] = useState<FetchState>(INITIAL);
  const [actingId, setActingId] = useState<number | null>(null);
  const [rejectionDraftFor, setRejectionDraftFor] = useState<number | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const token = await getToken();
      if (!token) throw new Error('Not signed in.');
      const res = await fetch('/api/admin/merchants', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = (await res.json()) as {
        admin?: AdminInfo;
        merchants?: MerchantSummary[];
        error?: string;
      };
      if (!res.ok) {
        setState({ loading: false, error: data.error ?? 'Request failed', admin: null, merchants: [] });
        return;
      }
      setState({
        loading: false,
        error: null,
        admin: data.admin ?? null,
        merchants: data.merchants ?? [],
      });
    } catch (err) {
      setState({
        loading: false,
        error: err instanceof Error ? err.message : 'Network error',
        admin: null,
        merchants: [],
      });
    }
  }, [getToken]);

  useEffect(() => {
    if (!isLoaded) return;
    load();
  }, [isLoaded, load]);

  async function approve(id: number) {
    setActingId(id);
    try {
      const token = await getToken();
      const res = await fetch('/api/admin/merchants/approve', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token ?? ''}`,
        },
        body: JSON.stringify({ merchantId: id }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        alert(`Approve failed: ${data.error ?? res.status}`);
        return;
      }
      await load();
    } finally {
      setActingId(null);
    }
  }

  async function reject(id: number) {
    if (!rejectionReason.trim()) {
      alert('Please enter a rejection reason.');
      return;
    }
    setActingId(id);
    try {
      const token = await getToken();
      const res = await fetch('/api/admin/merchants/reject', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token ?? ''}`,
        },
        body: JSON.stringify({ merchantId: id, reason: rejectionReason.trim() }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        alert(`Reject failed: ${data.error ?? res.status}`);
        return;
      }
      setRejectionDraftFor(null);
      setRejectionReason('');
      await load();
    } finally {
      setActingId(null);
    }
  }

  return (
    <main className="min-h-screen bg-ppw-sand text-ppw-ink">
      <header className="bg-ppw-ink text-white px-6 py-4 flex items-center justify-between">
        <div>
          <p className="text-[10px] uppercase tracking-widest opacity-80">PPW Marketplace</p>
          <h1 className="font-serif text-xl">Admin · Merchants queue</h1>
        </div>
        <div className="flex items-center gap-3 text-sm">
          {state.admin ? (
            <span className="opacity-80">
              {state.admin.email} · {state.admin.role}
            </span>
          ) : null}
          <UserButton afterSignOutUrl="/admin/merchants" />
        </div>
      </header>

      <section className="max-w-6xl mx-auto p-6">
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-ppw-ink/70">
            Suppliers who have cleared Stripe KYC and are waiting for your approval.
          </p>
          <button
            type="button"
            onClick={() => load()}
            className="rounded border border-ppw-ink/30 px-3 py-1.5 text-xs"
          >
            Refresh
          </button>
        </div>

        {state.loading ? (
          <p className="text-sm text-ppw-ink/60">Loading…</p>
        ) : state.error ? (
          <div className="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            {state.error}
          </div>
        ) : state.merchants.length === 0 ? (
          <div className="rounded border border-ppw-ink/15 bg-white p-6 text-sm text-ppw-ink/70">
            <p className="font-semibold mb-1">Queue empty.</p>
            <p>No merchants are currently awaiting approval. When a supplier completes Stripe KYC, they'll appear here.</p>
          </div>
        ) : (
          <ul className="space-y-4">
            {state.merchants.map((m) => (
              <li key={m.id} className="rounded-lg bg-white p-5 shadow">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="font-serif text-lg text-ppw-ink">{m.businessName}</h2>
                    <p className="text-xs text-ppw-ink/60">
                      Brand: <strong>{m.brandName}</strong> · slug: <code>{m.slug}</code> ·{' '}
                      {m.country}
                    </p>
                    <p className="text-xs text-ppw-ink/60 mt-1">
                      Applied {new Date(m.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <div className="text-xs text-ppw-ink/60 text-right">
                    Status:{' '}
                    <span className="inline-block rounded bg-ppw-sand px-2 py-0.5 font-mono">
                      {m.status}
                    </span>
                  </div>
                </div>

                <dl className="grid gap-3 sm:grid-cols-2 mt-4 text-sm">
                  <div>
                    <dt className="text-[10px] uppercase tracking-wider text-ppw-ink/60">
                      Contact
                    </dt>
                    <dd>
                      {m.contactName}
                      <br />
                      <a href={`mailto:${m.contactEmail}`} className="text-ppw-teal">
                        {m.contactEmail}
                      </a>
                      <br />
                      <a href={`tel:${m.contactPhone}`} className="text-ppw-teal">
                        {m.contactPhone}
                      </a>
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[10px] uppercase tracking-wider text-ppw-ink/60">
                      Categories
                    </dt>
                    <dd>{m.productCategories.join(', ')}</dd>
                    {m.estimatedMonthlyVolume ? (
                      <p className="text-xs text-ppw-ink/60 mt-1">
                        Volume estimate: {m.estimatedMonthlyVolume}
                      </p>
                    ) : null}
                  </div>
                  {m.website ? (
                    <div className="sm:col-span-2">
                      <dt className="text-[10px] uppercase tracking-wider text-ppw-ink/60">
                        Website
                      </dt>
                      <dd>
                        <a href={m.website} target="_blank" rel="noreferrer" className="text-ppw-teal break-all">
                          {m.website}
                        </a>
                      </dd>
                    </div>
                  ) : null}
                  {m.referralNotes ? (
                    <div className="sm:col-span-2">
                      <dt className="text-[10px] uppercase tracking-wider text-ppw-ink/60">
                        Notes from applicant
                      </dt>
                      <dd className="text-ppw-ink/80 italic">{m.referralNotes}</dd>
                    </div>
                  ) : null}
                  {m.notes ? (
                    <div className="sm:col-span-2">
                      <dt className="text-[10px] uppercase tracking-wider text-ppw-ink/60">
                        System notes
                      </dt>
                      <dd className="text-ppw-ink/70 text-xs">{m.notes}</dd>
                    </div>
                  ) : null}
                  {m.stripeConnectAccountId ? (
                    <div>
                      <dt className="text-[10px] uppercase tracking-wider text-ppw-ink/60">
                        Stripe Connect account
                      </dt>
                      <dd className="text-xs font-mono break-all">{m.stripeConnectAccountId}</dd>
                    </div>
                  ) : null}
                </dl>

                <div className="mt-4 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => approve(m.id)}
                    disabled={actingId === m.id}
                    className="rounded bg-ppw-teal px-4 py-2 text-white text-sm font-semibold disabled:opacity-50"
                  >
                    Approve
                  </button>
                  {rejectionDraftFor === m.id ? (
                    <>
                      <input
                        type="text"
                        value={rejectionReason}
                        onChange={(e) => setRejectionReason(e.target.value)}
                        placeholder="Reason (will be emailed to merchant)"
                        className="flex-1 rounded border border-ppw-ink/30 px-3 py-2 text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => reject(m.id)}
                        disabled={actingId === m.id}
                        className="rounded bg-red-700 px-4 py-2 text-white text-sm font-semibold disabled:opacity-50"
                      >
                        Confirm reject
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setRejectionDraftFor(null);
                          setRejectionReason('');
                        }}
                        className="rounded border border-ppw-ink/30 px-3 py-2 text-sm"
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setRejectionDraftFor(m.id)}
                      className="rounded border border-red-700 text-red-700 px-4 py-2 text-sm font-semibold"
                    >
                      Reject…
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}

        <p className="mt-8 text-[10px] uppercase tracking-widest text-ppw-ink/40">
          OMS Phase 1 — admin stub. Phase 2 expands into the full portal.
        </p>
      </section>
    </main>
  );
}
