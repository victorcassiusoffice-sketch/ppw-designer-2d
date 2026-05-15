/**
 * /admin/merchants/:slug — Phase 2 merchant detail.
 *
 * Shows the full merchant record, KYC document list, Stripe Connect
 * account state, and Approve / Reject controls. Reject requires a
 * note (5+ chars) — same constraint as Phase 1's API.
 */

import { useCallback, useEffect, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useAuth, UserButton } from '@clerk/clerk-react';

interface MerchantDetail {
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
  stripeConnectAccountId: string | null;
  status: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  approvedAt: string | null;
  approvedBy: string | null;
  rejectedAt: string | null;
  rejectedReason: string | null;
}

interface MerchantDocument {
  id: number;
  docType: string;
  blobUrl: string;
  uploadedAt: string;
}

interface StripeState {
  id: string;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  detailsSubmitted: boolean;
  requirementsCurrentlyDue: string[];
}

interface FetchState {
  loading: boolean;
  error: string | null;
  merchant: MerchantDetail | null;
  documents: MerchantDocument[];
  stripe: StripeState | null;
}

const INITIAL: FetchState = {
  loading: true,
  error: null,
  merchant: null,
  documents: [],
  stripe: null,
};

export default function MerchantDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { getToken, isLoaded } = useAuth();
  const [state, setState] = useState<FetchState>(INITIAL);
  const [acting, setActing] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  const load = useCallback(async () => {
    if (!slug) return;
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const token = await getToken();
      if (!token) throw new Error('Not signed in.');
      const res = await fetch(`/api/admin/merchants/${encodeURIComponent(slug)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = (await res.json()) as {
        merchant?: MerchantDetail;
        documents?: MerchantDocument[];
        stripe?: StripeState | null;
        error?: string;
      };
      if (!res.ok) {
        setState({ ...INITIAL, loading: false, error: data.error ?? 'Request failed' });
        return;
      }
      setState({
        loading: false,
        error: null,
        merchant: data.merchant ?? null,
        documents: data.documents ?? [],
        stripe: data.stripe ?? null,
      });
    } catch (err) {
      setState({
        ...INITIAL,
        loading: false,
        error: err instanceof Error ? err.message : 'Network error',
      });
    }
  }, [getToken, slug]);

  useEffect(() => {
    if (!isLoaded) return;
    load();
  }, [isLoaded, load]);

  async function approve() {
    if (!state.merchant) return;
    setActing(true);
    try {
      const token = await getToken();
      const res = await fetch('/api/admin/merchants/approve', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token ?? ''}`,
        },
        body: JSON.stringify({ merchantId: state.merchant.id }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        alert(`Approve failed: ${data.error ?? res.status}`);
        return;
      }
      await load();
    } finally {
      setActing(false);
    }
  }

  async function reject() {
    if (!state.merchant) return;
    if (rejectReason.trim().length < 5) {
      alert('Rejection reason must be at least 5 characters.');
      return;
    }
    setActing(true);
    try {
      const token = await getToken();
      const res = await fetch('/api/admin/merchants/reject', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token ?? ''}`,
        },
        body: JSON.stringify({ merchantId: state.merchant.id, reason: rejectReason.trim() }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        alert(`Reject failed: ${data.error ?? res.status}`);
        return;
      }
      setRejectOpen(false);
      setRejectReason('');
      await load();
    } finally {
      setActing(false);
    }
  }

  return (
    <main className="min-h-screen bg-ppw-sand text-ppw-ink">
      <header className="bg-ppw-ink text-white px-6 py-4 flex items-center justify-between">
        <div>
          <p className="text-[10px] uppercase tracking-widest opacity-80">PPW Marketplace</p>
          <h1 className="font-serif text-xl">Admin · Merchant detail</h1>
        </div>
        <UserButton afterSignOutUrl="/admin/merchants" />
      </header>

      <section className="max-w-5xl mx-auto p-6">
        <div className="mb-4 flex items-center justify-between">
          <button
            type="button"
            onClick={() => navigate('/admin/merchants')}
            className="text-sm text-ppw-coral font-semibold"
          >
            ← Back to list
          </button>
          <button
            type="button"
            onClick={() => load()}
            className="rounded border border-ppw-slate/30 px-3 py-1.5 text-xs"
          >
            Refresh
          </button>
        </div>

        {state.loading ? (
          <p className="text-sm text-ppw-slate">Loading…</p>
        ) : state.error ? (
          <div className="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            {state.error}
            <div className="mt-2">
              <Link to="/admin/merchants" className="text-ppw-coral underline">
                Return to list
              </Link>
            </div>
          </div>
        ) : !state.merchant ? (
          <p className="text-sm text-ppw-slate">Merchant not found.</p>
        ) : (
          <div className="space-y-6">
            <article className="rounded-lg bg-white p-6 shadow">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="font-serif text-2xl">{state.merchant.businessName}</h2>
                  <p className="text-sm text-ppw-slate">
                    Brand: <strong>{state.merchant.brandName}</strong> · slug{' '}
                    <code>{state.merchant.slug}</code> · {state.merchant.country}
                  </p>
                </div>
                <span className="inline-block rounded bg-ppw-sand px-3 py-1 font-mono text-xs">
                  {state.merchant.status}
                </span>
              </div>

              <dl className="grid gap-4 sm:grid-cols-2 mt-5 text-sm">
                <div>
                  <dt className="text-[10px] uppercase tracking-wider text-ppw-slate">Contact</dt>
                  <dd>
                    {state.merchant.contactName}
                    <br />
                    <a className="text-ppw-coral" href={`mailto:${state.merchant.contactEmail}`}>
                      {state.merchant.contactEmail}
                    </a>
                    <br />
                    <a className="text-ppw-coral" href={`tel:${state.merchant.contactPhone}`}>
                      {state.merchant.contactPhone}
                    </a>
                  </dd>
                </div>
                <div>
                  <dt className="text-[10px] uppercase tracking-wider text-ppw-slate">Categories</dt>
                  <dd>{state.merchant.productCategories.join(', ') || '—'}</dd>
                  {state.merchant.estimatedMonthlyVolume ? (
                    <p className="text-xs text-ppw-slate mt-1">
                      Volume: {state.merchant.estimatedMonthlyVolume}
                    </p>
                  ) : null}
                </div>
                {state.merchant.website ? (
                  <div className="sm:col-span-2">
                    <dt className="text-[10px] uppercase tracking-wider text-ppw-slate">Website</dt>
                    <dd>
                      <a
                        className="text-ppw-coral break-all"
                        href={state.merchant.website}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {state.merchant.website}
                      </a>
                    </dd>
                  </div>
                ) : null}
                {state.merchant.referralNotes ? (
                  <div className="sm:col-span-2">
                    <dt className="text-[10px] uppercase tracking-wider text-ppw-slate">
                      Applicant notes
                    </dt>
                    <dd className="italic">{state.merchant.referralNotes}</dd>
                  </div>
                ) : null}
                {state.merchant.notes ? (
                  <div className="sm:col-span-2">
                    <dt className="text-[10px] uppercase tracking-wider text-ppw-slate">
                      System notes
                    </dt>
                    <dd className="text-xs text-ppw-slate">{state.merchant.notes}</dd>
                  </div>
                ) : null}
                <div className="sm:col-span-2 text-xs text-ppw-slate">
                  Applied {new Date(state.merchant.createdAt).toLocaleString()}
                  {state.merchant.approvedAt
                    ? ` · approved ${new Date(state.merchant.approvedAt).toLocaleString()} by ${state.merchant.approvedBy ?? '—'}`
                    : ''}
                  {state.merchant.rejectedAt
                    ? ` · rejected ${new Date(state.merchant.rejectedAt).toLocaleString()}`
                    : ''}
                </div>
              </dl>
            </article>

            <article className="rounded-lg bg-white p-6 shadow">
              <h3 className="font-serif text-lg mb-3">Stripe Connect</h3>
              {state.merchant.stripeConnectAccountId ? (
                state.stripe ? (
                  <ul className="text-sm space-y-1">
                    <li>
                      <strong>Account id:</strong>{' '}
                      <code className="text-xs">{state.stripe.id}</code>
                    </li>
                    <li>
                      Charges enabled: {state.stripe.chargesEnabled ? 'yes' : 'no'} · Payouts
                      enabled: {state.stripe.payoutsEnabled ? 'yes' : 'no'} · Details submitted:{' '}
                      {state.stripe.detailsSubmitted ? 'yes' : 'no'}
                    </li>
                    {state.stripe.requirementsCurrentlyDue.length > 0 ? (
                      <li className="text-xs text-ppw-slate">
                        Currently due: {state.stripe.requirementsCurrentlyDue.join(', ')}
                      </li>
                    ) : null}
                  </ul>
                ) : (
                  <p className="text-sm text-ppw-slate">
                    Stripe account id on file:{' '}
                    <code className="text-xs">{state.merchant.stripeConnectAccountId}</code>. Live
                    state unavailable (Stripe key not configured or fetch failed).
                  </p>
                )
              ) : (
                <p className="text-sm text-ppw-slate">
                  No Stripe Connect account linked yet.
                </p>
              )}
            </article>

            <article className="rounded-lg bg-white p-6 shadow">
              <h3 className="font-serif text-lg mb-3">KYC documents</h3>
              {state.documents.length === 0 ? (
                <p className="text-sm text-ppw-slate">No documents uploaded.</p>
              ) : (
                <ul className="text-sm space-y-2">
                  {state.documents.map((d) => (
                    <li key={d.id} className="flex items-center justify-between">
                      <span>
                        <span className="inline-block rounded bg-ppw-sand px-2 py-0.5 font-mono text-xs mr-2">
                          {d.docType}
                        </span>
                        <span className="text-xs text-ppw-slate">
                          Uploaded {new Date(d.uploadedAt).toLocaleString()}
                        </span>
                      </span>
                      <a
                        href={d.blobUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-ppw-coral text-xs font-semibold"
                      >
                        Open →
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </article>

            <article className="rounded-lg bg-white p-6 shadow">
              <h3 className="font-serif text-lg mb-3">Actions</h3>
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={approve}
                  disabled={acting || state.merchant.status === 'approved'}
                  className="rounded bg-ppw-teal px-4 py-2 text-white text-sm font-semibold disabled:opacity-50"
                >
                  Approve
                </button>
                {rejectOpen ? (
                  <>
                    <input
                      type="text"
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      placeholder="Reason (emailed to merchant)"
                      className="flex-1 rounded border border-ppw-slate/30 px-3 py-2 text-sm min-w-[260px]"
                    />
                    <button
                      type="button"
                      onClick={reject}
                      disabled={acting}
                      className="rounded bg-red-700 px-4 py-2 text-white text-sm font-semibold disabled:opacity-50"
                    >
                      Confirm reject
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setRejectOpen(false);
                        setRejectReason('');
                      }}
                      className="rounded border border-ppw-slate/30 px-3 py-2 text-sm"
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => setRejectOpen(true)}
                    disabled={state.merchant.status === 'rejected'}
                    className="rounded border border-red-700 text-red-700 px-4 py-2 text-sm font-semibold disabled:opacity-50"
                  >
                    Reject…
                  </button>
                )}
              </div>
            </article>
          </div>
        )}
      </section>
    </main>
  );
}
