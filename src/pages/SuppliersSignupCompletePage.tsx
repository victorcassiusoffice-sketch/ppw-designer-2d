/**
 * /suppliers/signup/complete — confirmation page shown either:
 *   - As Stripe's `return_url` after the merchant finishes Stripe-hosted KYC
 *   - As the destination of the manual-followup-path success state
 *
 * Phase 1: minimal, brand-aligned. Dev-only debug section reveals the
 * `?m=<slug>` query param so Vic can spot-check.
 */

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

export default function SuppliersSignupCompletePage() {
  const [params] = useSearchParams();
  const slug = params.get('m') ?? '';
  const isDev = useMemo(() => import.meta.env.DEV === true, []);
  const [debug, setDebug] = useState<unknown>(null);

  useEffect(() => {
    if (!isDev || !slug) return;
    // Phase 1: no public-facing /api/merchants/by-slug endpoint yet —
    // the dev debug section only echoes the slug. Phase 2 admin
    // portal will surface full status.
    setDebug({ slug, note: 'Dev-only debug: merchant slug from query string.' });
  }, [isDev, slug]);

  return (
    <main className="min-h-screen bg-ppw-sand text-ppw-ink px-4 py-12">
      <div className="mx-auto max-w-2xl rounded-lg bg-white p-8 shadow">
        <p className="text-xs uppercase tracking-widest text-ppw-teal mb-2">
          Application received
        </p>
        <h1 className="font-serif text-3xl text-ppw-ink mb-3">Thank you.</h1>
        <p className="text-sm text-ppw-ink/80 mb-3">
          Your supplier application has been received. If Stripe Connect identity verification
          was part of your flow, Stripe will continue processing in the background.
        </p>
        <p className="text-sm text-ppw-ink/80 mb-3">
          Vic Bhatoolaul will personally review your application and email you within{' '}
          <strong>48 hours</strong>.
        </p>
        <p className="text-sm text-ppw-ink/80 mb-6">
          You don't need to do anything else right now.
        </p>

        <div className="rounded bg-ppw-sand p-4 text-xs text-ppw-ink/80">
          <p className="font-semibold mb-1">What happens next</p>
          <ol className="list-decimal pl-5 space-y-1">
            <li>Vic reviews your application and the products you intend to supply.</li>
            <li>If anything is missing, you'll get a follow-up email asking for more.</li>
            <li>When approved, you'll receive a portal URL to connect your inventory.</li>
            <li>Once your catalog is live, customers can include your products in their designs.</li>
          </ol>
        </div>

        {isDev && debug ? (
          <details className="mt-6 rounded border border-dashed border-ppw-ink/30 p-3 text-xs text-ppw-ink/70">
            <summary className="cursor-pointer font-semibold">Dev debug</summary>
            <pre className="mt-2 whitespace-pre-wrap break-all">{JSON.stringify(debug, null, 2)}</pre>
          </details>
        ) : null}
      </div>
    </main>
  );
}
