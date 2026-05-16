/**
 * /my-designs — cloud-save listing page (M1.C.6).
 *
 * Reads the cached customer email (set via Save / Request-Quote) and
 * lists the designs the API returns for that email. Clicking Load
 * hydrates the active Property in `propertyStore` and navigates back
 * to `/designer`.
 *
 * Anonymous-friendly: if no email is cached, the page prompts inline
 * (no Clerk forced sign-in — see `customerIdentity.ts` for the
 * rationale).
 */

import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { usePropertyStore } from '../store/propertyStore';
import { useToastStore } from '../store/toastStore';
import {
  getCachedCustomerEmail,
  isLikelyEmail,
  setCachedCustomerEmail,
} from '../lib/customerIdentity';
import { listDesignsByEmail, type ApiDesign } from '../lib/designsApi';
import { EmptyState, ErrorBanner, SkeletonRow } from '../components/uxKit';

export default function MyDesignsPage(): JSX.Element {
  const navigate = useNavigate();
  const loadProperty = usePropertyStore((s) => s.loadProperty);
  const pushToast = useToastStore((s) => s.push);

  const [email, setEmail] = useState<string | null>(() => getCachedCustomerEmail());
  const [emailDraft, setEmailDraft] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);

  const [designs, setDesigns] = useState<ApiDesign[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDesigns = useCallback(async (forEmail: string) => {
    setLoading(true);
    setError(null);
    try {
      const rows = await listDesignsByEmail(forEmail);
      setDesigns(rows);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load designs.';
      setError(msg);
      setDesigns([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (email) {
      void fetchDesigns(email);
    }
  }, [email, fetchDesigns]);

  function submitEmail(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = emailDraft.trim();
    if (!isLikelyEmail(trimmed)) {
      setEmailError('That doesn\'t look like a valid email.');
      return;
    }
    const normalised = setCachedCustomerEmail(trimmed);
    if (!normalised) {
      setEmailError('Could not save email.');
      return;
    }
    setEmail(normalised);
    setEmailError(null);
  }

  function handleLoad(design: ApiDesign) {
    if (!design.property) {
      pushToast('That design has no property data.', 'error');
      return;
    }
    loadProperty(design.property);
    pushToast(`Loaded "${design.name}"`, 'success');
    navigate('/designer');
  }

  return (
    <main className="min-h-screen bg-ppw-sand text-ppw-ink">
      <header className="border-b border-ppw-stone bg-white px-4 py-3">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-2">
          <div>
            <p className="text-xs uppercase tracking-widest text-ppw-teal">PPW</p>
            <h1 className="font-serif text-xl text-ppw-ink">My designs</h1>
          </div>
          <Link
            to="/designer"
            className="rounded-md border border-ppw-stone bg-white px-3 py-1.5 text-xs font-medium text-ppw-slate hover:border-ppw-teal"
          >
            Back to Designer
          </Link>
        </div>
      </header>

      <section className="mx-auto max-w-3xl px-4 py-6">
        {!email ? (
          <div className="rounded-lg border border-ppw-stone bg-white p-5 shadow-sm">
            <p className="mb-2 text-sm font-semibold text-ppw-ink">
              Enter the email you used when saving
            </p>
            <p className="mb-3 text-xs text-ppw-slate">
              We use email to find your cloud-saved designs. No password needed.
            </p>
            <form onSubmit={submitEmail} className="flex flex-col gap-2 sm:flex-row sm:items-start">
              <div className="flex-1">
                <input
                  type="email"
                  required
                  autoFocus
                  inputMode="email"
                  autoComplete="email"
                  value={emailDraft}
                  onChange={(e) => setEmailDraft(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full rounded-md border border-ppw-stone bg-white px-3 py-2 text-sm text-ppw-ink focus:border-ppw-teal focus:outline-none"
                  aria-invalid={emailError !== null}
                  aria-describedby={emailError ? 'email-error' : undefined}
                />
                {emailError && (
                  <p id="email-error" className="mt-1 text-xs text-ppw-coral">
                    {emailError}
                  </p>
                )}
              </div>
              <button
                type="submit"
                className="rounded-md bg-ppw-teal px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-ppw-teal/90"
              >
                Show my designs
              </button>
            </form>
          </div>
        ) : (
          <>
            <div className="mb-4 flex items-center justify-between gap-2">
              <p className="text-xs text-ppw-slate">
                Showing designs for <code className="text-ppw-ink">{email}</code>
              </p>
              <button
                type="button"
                onClick={() => {
                  setEmail(null);
                  setDesigns(null);
                  setEmailDraft('');
                }}
                className="text-[11px] text-ppw-coral hover:underline"
              >
                Use a different email
              </button>
            </div>

            {error && <ErrorBanner error={error} onRetry={() => fetchDesigns(email)} />}

            {loading && designs === null ? (
              <div className="flex flex-col gap-2">
                <SkeletonRow />
                <SkeletonRow />
                <SkeletonRow />
              </div>
            ) : designs && designs.length === 0 ? (
              <EmptyState
                title="No cloud-saved designs yet."
                message="Open the Designer, click Save as..., and your design will sync to the cloud automatically once your email is on file."
                actionLabel="Open Designer"
                onAction={() => navigate('/designer')}
              />
            ) : (
              <ul className="flex flex-col gap-2">
                {(designs ?? []).map((d) => {
                  const roomCount = d.property?.rooms?.length ?? 0;
                  const itemCount = (d.property?.rooms ?? []).reduce(
                    (acc, r) => acc + (r.placedItems?.length ?? 0),
                    0,
                  );
                  return (
                    <li
                      key={d.id}
                      className="rounded-lg border border-ppw-stone bg-white p-4 shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-ppw-ink">{d.name}</p>
                          <p className="text-[11px] text-ppw-slate">
                            {roomCount} room{roomCount === 1 ? '' : 's'} ·{' '}
                            {itemCount} item{itemCount === 1 ? '' : 's'} ·{' '}
                            saved {new Date(d.createdAt).toLocaleString()}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleLoad(d)}
                          className="shrink-0 rounded-md bg-ppw-teal px-3 py-1.5 text-xs font-semibold text-white hover:bg-ppw-teal/90"
                        >
                          Load
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </>
        )}
      </section>
    </main>
  );
}
