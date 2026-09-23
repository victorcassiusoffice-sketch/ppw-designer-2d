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

import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { usePropertyStore } from '../store/propertyStore';
import { useDesignsStore } from '../store/designsStore';
import { useToastStore } from '../store/toastStore';
import {
  getCachedCustomerEmail,
  isLikelyEmail,
  setCachedCustomerEmail,
  clearCachedCustomerEmail,
} from '../lib/customerIdentity';
import { listDesignsByEmail, type ApiDesign } from '../lib/designsApi';
import { openCloudDesign, saveCurrentPageToCloud } from '../lib/cloudDesigns';
import { propertyHasContent } from '../lib/pages';
import { EmptyState, ErrorBanner, SkeletonRow } from '../components/uxKit';

export default function MyDesignsPage(): JSX.Element {
  const navigate = useNavigate();
  const property = usePropertyStore((s) => s.property);
  const activePage = useDesignsStore((s) => s.currentId ? s.designs[s.currentId] : undefined);
  const pushToast = useToastStore((s) => s.push);

  const [email, setEmail] = useState<string | null>(() => getCachedCustomerEmail());
  const [emailDraft, setEmailDraft] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);

  const [designs, setDesigns] = useState<ApiDesign[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveName, setSaveName] = useState(() => activePage?.name ?? property.name ?? 'Untitled plan');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const request = useRef(0);
  const canUpdate = !!email && activePage?.cloud?.email === email;
  const hasPlan = propertyHasContent(property);

  const fetchDesigns = useCallback(async (forEmail: string) => {
    const id = ++request.current;
    setLoading(true);
    setError(null);
    try {
      const rows = await listDesignsByEmail(forEmail);
      if (request.current !== id) return;
      setDesigns(rows);
    } catch (err) {
      if (request.current !== id) return;
      const msg = err instanceof Error ? err.message : 'Failed to load designs.';
      setError(msg);
      setDesigns([]);
    } finally {
      if (request.current === id) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (email) {
      void fetchDesigns(email);
    }
    return () => { request.current += 1; };
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
    if (!email) return;
    try {
      openCloudDesign(design, email);
      pushToast(`Loaded "${design.name}" as a separate plan`, 'success');
      navigate('/designer');
    } catch (err) {
      pushToast(err instanceof Error ? err.message : 'Could not load that design.', 'error');
    }
  }

  async function handleCloudSave(updateExisting: boolean) {
    if (!email || saving || !hasPlan) return;
    setSaving(true);
    setSaveError(null);
    try {
      const saved = await saveCurrentPageToCloud(email, saveName, updateExisting);
      pushToast(`${updateExisting ? 'Updated' : 'Saved'} "${saved.name}" in the cloud.`, 'success');
      await fetchDesigns(email);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Cloud save failed. Your local plan is still saved on this device.');
    } finally {
      setSaving(false);
    }
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
                  request.current += 1;
                  clearCachedCustomerEmail();
                  setEmail(null);
                  setDesigns(null);
                  setEmailDraft('');
                  setError(null);
                  setSaveError(null);
                }}
                disabled={saving}
                className="text-[11px] text-ppw-coral hover:underline"
              >
                Use a different email
              </button>
            </div>

            {hasPlan && (
              <div className="mb-5 rounded-lg border border-ppw-stone bg-white p-4" data-testid="cloud-save-panel">
                <h2 className="text-sm font-semibold">Current plan</h2>
                <p className="mt-1 text-xs text-ppw-slate">Save all floors, walls, finishes, garden and placed items to your cloud designs.</p>
                <label className="mt-3 block text-xs font-medium" htmlFor="cloud-plan-name">Plan name</label>
                <input id="cloud-plan-name" value={saveName} onChange={(event) => setSaveName(event.target.value)}
                  disabled={saving} className="mt-1 w-full rounded-md border border-ppw-stone px-3 py-2 text-sm" />
                <div className="mt-3 flex flex-wrap gap-2">
                  {canUpdate && (
                    <button type="button" onClick={() => void handleCloudSave(true)} disabled={saving || !saveName.trim()}
                      data-testid="cloud-update" className="min-h-11 rounded-md bg-ppw-teal px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
                      {saving ? 'Saving…' : 'Update cloud copy'}
                    </button>
                  )}
                  <button type="button" onClick={() => void handleCloudSave(false)} disabled={saving || !saveName.trim()}
                    data-testid="cloud-save-new" className="min-h-11 rounded-md border border-ppw-teal px-4 py-2 text-sm font-semibold text-ppw-teal disabled:opacity-50">
                    {saving ? 'Saving…' : canUpdate ? 'Save a new copy' : 'Save plan to cloud'}
                  </button>
                </div>
                {saveError && <p className="mt-2 text-sm text-ppw-coral" role="alert">{saveError}</p>}
              </div>
            )}

            {error && <ErrorBanner error={error} onRetry={() => fetchDesigns(email)} />}

            {loading && designs === null ? (
              <div className="flex flex-col gap-2">
                <SkeletonRow />
                <SkeletonRow />
                <SkeletonRow />
              </div>
            ) : !error && designs && designs.length === 0 ? (
              <EmptyState
                title="No cloud-saved designs yet."
                message={hasPlan ? 'Save the current plan above to keep your first cloud copy.' : 'Draw a plan in the Designer, then return here to save it to the cloud.'}
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
                          disabled={saving}
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
