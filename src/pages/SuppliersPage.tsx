/**
 * Public merchant signup page.
 *
 * Mounted at `/suppliers` (and aliased at `/merchants` in main.tsx).
 * Posts to `/api/merchants/signup`; on success redirects either to the
 * Stripe Connect onboarding URL (when MU compliance is live) or to
 * `/suppliers/signup/complete` (when we're on the manual-followup path).
 *
 * Zod validation lives server-side; the client uses a light mirror to
 * surface inline errors before submission to avoid round-trips.
 *
 * Styling matches the storefront brand palette (ppw-sand, ppw-ink, etc).
 */

import { useMemo, useState } from 'react';

const PRODUCT_CATEGORIES: Array<{ value: string; label: string }> = [
  { value: 'ice_baths', label: 'Ice baths & cold plunges' },
  { value: 'sleep_pods', label: 'Sleep pods' },
  { value: 'ergo_chairs', label: 'Ergonomic chairs' },
  { value: 'plants', label: 'Plants & biophilic decor' },
  { value: 'eco_office_kits', label: 'Eco-office kits' },
  { value: 'other', label: 'Other' },
];

const COUNTRIES: Array<{ value: string; label: string }> = [
  { value: 'MU', label: 'Mauritius' },
  { value: 'GB', label: 'United Kingdom' },
  { value: 'FR', label: 'France' },
  { value: 'ZA', label: 'South Africa' },
  { value: 'IN', label: 'India' },
  { value: 'AE', label: 'United Arab Emirates' },
  { value: 'US', label: 'United States' },
  { value: 'OTHER', label: 'Other (we\'ll follow up)' },
];

interface FormState {
  businessName: string;
  brandName: string;
  country: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  productCategories: string[];
  estimatedMonthlyVolume: string;
  website: string;
  referralNotes: string;
}

const INITIAL_FORM: FormState = {
  businessName: '',
  brandName: '',
  country: 'MU',
  contactName: '',
  contactEmail: '',
  contactPhone: '',
  productCategories: [],
  estimatedMonthlyVolume: '',
  website: '',
  referralNotes: '',
};

interface SuccessState {
  kind: 'stripe_onboarding' | 'manual_followup';
  onboardingUrl?: string;
  completeUrl?: string;
  businessName: string;
}

function validate(form: FormState): Record<string, string> {
  const e: Record<string, string> = {};
  if (form.businessName.trim().length < 2) e.businessName = 'Required.';
  if (form.brandName.trim().length < 1) e.brandName = 'Required.';
  if (form.contactName.trim().length < 2) e.contactName = 'Required.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.contactEmail.trim())) e.contactEmail = 'Valid email required.';
  if (form.contactPhone.trim().length < 6) e.contactPhone = 'Phone required.';
  if (form.productCategories.length === 0) e.productCategories = 'Pick at least one.';
  if (form.website.trim() && !/^https?:\/\//i.test(form.website.trim())) {
    e.website = 'Use http:// or https://';
  }
  return e;
}

export default function SuppliersPage() {
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [serverIssues, setServerIssues] = useState<Array<{ path: string; message: string }>>([]);
  const [success, setSuccess] = useState<SuccessState | null>(null);

  const errors = useMemo(() => validate(form), [form]);
  const canSubmit = Object.keys(errors).length === 0 && !submitting;

  function patch<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function toggleCategory(value: string) {
    setForm((prev) => {
      const has = prev.productCategories.includes(value);
      return {
        ...prev,
        productCategories: has
          ? prev.productCategories.filter((c) => c !== value)
          : [...prev.productCategories, value],
      };
    });
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setServerError(null);
    setServerIssues([]);
    try {
      const res = await fetch('/api/merchants/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = (await res.json()) as {
        kind?: 'stripe_onboarding' | 'manual_followup';
        onboardingUrl?: string;
        completeUrl?: string;
        error?: string;
        issues?: Array<{ path: string; message: string }>;
      };
      if (!res.ok) {
        setServerError(data.error ?? 'Signup failed. Please try again.');
        setServerIssues(data.issues ?? []);
        return;
      }
      if (data.kind === 'stripe_onboarding' && data.onboardingUrl) {
        // Hard redirect: Stripe-hosted KYC flow.
        window.location.assign(data.onboardingUrl);
        return;
      }
      setSuccess({
        kind: data.kind ?? 'manual_followup',
        completeUrl: data.completeUrl,
        businessName: form.businessName,
      });
    } catch (err) {
      setServerError(err instanceof Error ? err.message : 'Network error.');
    } finally {
      setSubmitting(false);
    }
  }

  if (success) {
    return (
      <main className="min-h-screen bg-ppw-sand text-ppw-ink px-4 py-12">
        <div className="mx-auto max-w-2xl rounded-lg bg-white p-8 shadow">
          <h1 className="font-serif text-3xl text-ppw-ink mb-3">Application received</h1>
          <p className="text-sm text-ppw-ink/80 mb-4">
            Thank you. We've recorded your supplier application for{' '}
            <strong>{success.businessName}</strong>.
          </p>
          <p className="text-sm text-ppw-ink/80 mb-4">
            Vic will personally review your application within 48 hours. You'll receive an
            email confirmation shortly — if it doesn't arrive, check your spam folder.
          </p>
          {success.completeUrl ? (
            <a
              href={success.completeUrl}
              className="inline-block rounded bg-ppw-teal px-5 py-2 text-white text-sm font-semibold"
            >
              View status
            </a>
          ) : null}
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-ppw-sand text-ppw-ink px-4 py-12">
      <div className="mx-auto max-w-3xl">
        <section className="rounded-lg bg-white p-8 shadow mb-6">
          <p className="text-xs uppercase tracking-widest text-ppw-teal mb-2">Suppliers</p>
          <h1 className="font-serif text-4xl text-ppw-ink mb-3">
            Become a Peak Performance Wellness supplier
          </h1>
          <p className="text-sm text-ppw-ink/80 leading-relaxed">
            Stock your brand on Mauritius's first integrated wellness marketplace. Customers
            design their space using our 2D room planner — your products appear in the catalog,
            ship to the customer, and we handle payment routing via Stripe Connect.
          </p>
          <ul className="mt-5 grid gap-2 text-sm text-ppw-ink/80 sm:grid-cols-3">
            <li className="rounded bg-ppw-sand px-3 py-2"><strong>5%</strong> referral commission</li>
            <li className="rounded bg-ppw-sand px-3 py-2"><strong>14-day</strong> payout hold for refund protection</li>
            <li className="rounded bg-ppw-sand px-3 py-2"><strong>You</strong> control pricing &amp; inventory</li>
          </ul>
        </section>

        <form
          onSubmit={onSubmit}
          className="rounded-lg bg-white p-8 shadow space-y-5"
          noValidate
        >
          <h2 className="font-serif text-2xl text-ppw-ink">Apply to supply</h2>
          {serverError ? (
            <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              {serverError}
              {serverIssues.length > 0 ? (
                <ul className="mt-2 list-disc list-inside text-xs">
                  {serverIssues.map((i) => (
                    <li key={i.path}>
                      <strong>{i.path}</strong>: {i.message}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Business legal name" error={errors.businessName}>
              <input
                type="text"
                value={form.businessName}
                onChange={(e) => patch('businessName', e.target.value)}
                className="input"
                autoComplete="organization"
                required
              />
            </Field>
            <Field label="Brand name (as shown to customers)" error={errors.brandName}>
              <input
                type="text"
                value={form.brandName}
                onChange={(e) => patch('brandName', e.target.value)}
                className="input"
                required
              />
            </Field>
            <Field label="Country" error={errors.country}>
              <select
                value={form.country}
                onChange={(e) => patch('country', e.target.value)}
                className="input"
              >
                {COUNTRIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Contact name" error={errors.contactName}>
              <input
                type="text"
                value={form.contactName}
                onChange={(e) => patch('contactName', e.target.value)}
                className="input"
                autoComplete="name"
                required
              />
            </Field>
            <Field label="Contact email" error={errors.contactEmail}>
              <input
                type="email"
                value={form.contactEmail}
                onChange={(e) => patch('contactEmail', e.target.value)}
                className="input"
                autoComplete="email"
                required
              />
            </Field>
            <Field label="Contact phone (international format)" error={errors.contactPhone}>
              <input
                type="tel"
                value={form.contactPhone}
                onChange={(e) => patch('contactPhone', e.target.value)}
                className="input"
                placeholder="+230 ..."
                autoComplete="tel"
                required
              />
            </Field>
          </div>

          <Field
            label="Product categories"
            error={errors.productCategories}
            description="Pick all that apply."
          >
            <div className="flex flex-wrap gap-2">
              {PRODUCT_CATEGORIES.map((c) => {
                const active = form.productCategories.includes(c.value);
                return (
                  <button
                    type="button"
                    key={c.value}
                    onClick={() => toggleCategory(c.value)}
                    className={`rounded-full border px-3 py-1.5 text-xs ${
                      active
                        ? 'border-ppw-teal bg-ppw-teal text-white'
                        : 'border-ppw-ink/20 bg-white text-ppw-ink'
                    }`}
                    aria-pressed={active}
                  >
                    {c.label}
                  </button>
                );
              })}
            </div>
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Estimated monthly product volume (optional)">
              <input
                type="text"
                value={form.estimatedMonthlyVolume}
                onChange={(e) => patch('estimatedMonthlyVolume', e.target.value)}
                className="input"
                placeholder="e.g. 20-50 units"
              />
            </Field>
            <Field label="Website (optional)" error={errors.website}>
              <input
                type="url"
                value={form.website}
                onChange={(e) => patch('website', e.target.value)}
                className="input"
                placeholder="https://"
                autoComplete="url"
              />
            </Field>
          </div>

          <Field label="How did you hear about us? Notes? (optional)">
            <textarea
              value={form.referralNotes}
              onChange={(e) => patch('referralNotes', e.target.value)}
              rows={4}
              className="input"
            />
          </Field>

          <div className="flex items-center justify-between pt-2">
            <p className="text-xs text-ppw-ink/60">
              By submitting, you agree to undergo Stripe Connect identity verification before
              any orders are routed to you.
            </p>
            <button
              type="submit"
              disabled={!canSubmit}
              className="rounded bg-ppw-teal px-6 py-2.5 text-white text-sm font-semibold disabled:opacity-50"
            >
              {submitting ? 'Submitting…' : 'Submit application'}
            </button>
          </div>
        </form>
      </div>

      <style>{`
        .input {
          width: 100%;
          padding: 8px 10px;
          border: 1px solid rgba(31, 58, 58, 0.2);
          border-radius: 6px;
          background: #ffffff;
          font-size: 14px;
          color: #1f3a3a;
        }
        .input:focus { outline: 2px solid #1f4a4a; outline-offset: 1px; }
      `}</style>
    </main>
  );
}

interface FieldProps {
  label: string;
  description?: string;
  error?: string;
  children: React.ReactNode;
}

function Field({ label, description, error, children }: FieldProps) {
  return (
    <label className="block">
      <span className="block text-xs font-semibold uppercase tracking-wider text-ppw-ink/70 mb-1">
        {label}
      </span>
      {description ? (
        <span className="block text-xs text-ppw-ink/60 mb-2">{description}</span>
      ) : null}
      {children}
      {error ? <span className="block text-xs text-red-700 mt-1">{error}</span> : null}
    </label>
  );
}
