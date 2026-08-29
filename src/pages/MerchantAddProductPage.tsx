/**
 * Wellness-Designer-App (c) part 2 — merchant Add-Product form.
 *
 * Route: `/merchant/:slug/products/new` (magic-link gated via
 * <RequireMerchant>).
 *
 * Two-step upload pattern (lambda-light):
 *   1. Form prompts the merchant for an image file (PNG/JPG ≤5 MiB).
 *   2. On submit, the file is uploaded directly to Vercel Blob via the
 *      `@vercel/blob/client` `upload()` helper — which itself calls the
 *      part-1 endpoint `POST /api/merchants/:slug/products/upload-image`
 *      to mint a 60-second client token, then PUTs the bytes straight to
 *      Blob storage. The lambda never sees the bytes.
 *   3. The returned blob URL is then submitted alongside the rest of the
 *      metadata to `POST /api/merchants/:slug/products` (which writes
 *      `merchant_products.image_url`).
 *
 * Brand tokens applied directly (inline styles) — matches the
 * conventions in MerchantDashboardPage / MerchantOnboardingPage.
 *
 * Why the form decision logic is extracted to `decideProductFormSubmit`:
 * the project's vitest is `environment: 'node'` without jsdom, so React
 * component tests cover pure logic only. The pure-fn captures the
 * submit-state machine so vitest can exercise every accept/reject path
 * without a DOM.
 */

import { useEffect, useMemo, useState, useCallback } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { uploadProductImageBlob, type ProductImageContentType } from '../lib/merchants/uploadProductImage';
import { SESSION_STORAGE_KEY } from '../components/RequireMerchant';

const BRAND = {
  navy: '#232C3B',
  deepNavy: '#1A2230',
  gold: '#FFBB58',
  goldSoft: 'rgba(255,187,88,0.18)',
  cream: '#F5EBD7',
  creamLine: 'rgba(245,235,215,0.14)',
  muted: '#A8B0BD',
  red: '#E07A7A',
  serif: "'EB Garamond', Georgia, serif",
  sans: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif",
} as const;

/** Tweak-05 category set — matches what K1 + downstream merchants stock. */
export const PRODUCT_CATEGORIES = [
  'cardio',
  'recovery',
  'sauna',
  'flooring',
  'walls',
  'decor',
  'furniture',
  // Sims world (2026-08-29) — passes straight through the catalog adapter.
  'lighting',
] as const;
export type ProductCategory = (typeof PRODUCT_CATEGORIES)[number];

export const ECO_CERT_OPTIONS = [
  { value: 'none', label: 'Not certified' },
  { value: 'self-declared', label: 'Self-declared' },
  { value: 'third-party-claimed', label: 'Third-party claimed' },
  { value: 'verified-certified', label: 'Verified / certified' },
] as const;

export const CURRENCIES = ['MUR', 'USD', 'EUR', 'GBP'] as const;
export type Currency = (typeof CURRENCIES)[number];

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const ALLOWED_IMAGE_TYPES = ['image/png', 'image/jpeg'] as const;

export interface ProductFormState {
  name: string;
  description: string;
  category: ProductCategory;
  priceMajor: string; // user types e.g. "1500" — meaning 1500 MUR
  currency: Currency;
  ecoCertLevel: 'none' | 'self-declared' | 'third-party-claimed' | 'verified-certified';
  widthMm: string;
  depthMm: string;
  heightMm: string;
  imageFile: File | null;
}

export const EMPTY_FORM: ProductFormState = {
  name: '',
  description: '',
  category: 'cardio',
  priceMajor: '',
  currency: 'MUR',
  ecoCertLevel: 'none',
  widthMm: '',
  depthMm: '',
  heightMm: '',
  imageFile: null,
};

/**
 * Pure-fn — given a form state, returns either the POST body payload or
 * a list of field-level validation errors. No DOM, no fetch.
 */
export interface SubmitDecisionOk {
  ok: true;
  payload: {
    name: string;
    description: string | null;
    category: ProductCategory;
    priceMinor: number;
    currency: Currency;
    ecoCertLevel: ProductFormState['ecoCertLevel'];
    // Footprint width + depth are REQUIRED (WD-2D top-down rebuild
    // 2026-07-10): the deterministic footprint normaliser + the to-scale
    // 0.5 m-grid placement both depend on a real W×D, so it can no longer
    // be blank/free-typed. Height stays optional (shadow only).
    widthMm: number;
    depthMm: number;
    heightMm: number | null;
  };
  imageFile: File | null;
}
export interface SubmitDecisionErr {
  ok: false;
  errors: Record<string, string>;
}

export function decideProductFormSubmit(state: ProductFormState): SubmitDecisionOk | SubmitDecisionErr {
  const errors: Record<string, string> = {};

  const name = state.name.trim();
  if (!name) errors.name = 'Required.';
  if (name.length > 200) errors.name = 'Max 200 characters.';

  if (!(PRODUCT_CATEGORIES as readonly string[]).includes(state.category)) {
    errors.category = 'Invalid category.';
  }

  const priceMajor = state.priceMajor.trim();
  if (!priceMajor) {
    errors.priceMajor = 'Required.';
  } else {
    const n = Number(priceMajor);
    if (!Number.isFinite(n) || n < 0) errors.priceMajor = 'Must be a non-negative number.';
  }

  if (!(CURRENCIES as readonly string[]).includes(state.currency)) {
    errors.currency = 'Invalid currency.';
  }

  function parseDim(s: string): number | null | 'invalid' {
    const t = s.trim();
    if (!t) return null;
    const n = Number(t);
    if (!Number.isFinite(n) || n < 0 || !Number.isInteger(n)) return 'invalid';
    return n;
  }
  const w = parseDim(state.widthMm);
  const d = parseDim(state.depthMm);
  const h = parseDim(state.heightMm);
  // Width + depth REQUIRED and positive (footprint drives to-scale placement
  // + the top-down normaliser). Height optional (shadow geometry only).
  if (w === 'invalid') errors.widthMm = 'Whole positive mm.';
  else if (w === null) errors.widthMm = 'Required — real footprint width in mm.';
  else if (w <= 0) errors.widthMm = 'Must be greater than 0.';
  if (d === 'invalid') errors.depthMm = 'Whole positive mm.';
  else if (d === null) errors.depthMm = 'Required — real footprint depth in mm.';
  else if (d <= 0) errors.depthMm = 'Must be greater than 0.';
  if (h === 'invalid') errors.heightMm = 'Whole non-negative mm.';

  if (state.imageFile) {
    if (!(ALLOWED_IMAGE_TYPES as readonly string[]).includes(state.imageFile.type)) {
      errors.imageFile = 'PNG or JPG only.';
    } else if (state.imageFile.size > MAX_IMAGE_BYTES) {
      errors.imageFile = 'Max 5 MB.';
    }
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }

  const priceMinor = Math.round(Number(priceMajor) * 100);

  return {
    ok: true,
    payload: {
      name,
      description: state.description.trim() ? state.description.trim() : null,
      category: state.category,
      priceMinor,
      currency: state.currency,
      ecoCertLevel: state.ecoCertLevel,
      // w and d are guaranteed valid positive numbers here (guarded above).
      widthMm: w as number,
      depthMm: d as number,
      heightMm: h === null || h === 'invalid' ? null : h,
    },
    imageFile: state.imageFile,
  };
}

interface StoredSession {
  slug: string;
  token: string;
  email: string;
  exp: number;
}

function readSession(): StoredSession | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as StoredSession;
  } catch {
    return null;
  }
}

type Phase = 'idle' | 'uploading' | 'submitting' | 'error';

export interface MerchantAddProductPageProps {
  /** Optional fetch override for tests. */
  fetchImpl?: typeof globalThis.fetch;
}

export default function MerchantAddProductPage(
  _props: MerchantAddProductPageProps = {},
): JSX.Element {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [form, setForm] = useState<ProductFormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [phase, setPhase] = useState<Phase>('idle');
  const [phaseMsg, setPhaseMsg] = useState<string>('');

  const session = useMemo(readSession, []);
  const isLoggedIn = !!session && session.slug === slug;

  useEffect(() => {
    if (!isLoggedIn) {
      setPhase('error');
      setPhaseMsg('Sign in required — return to dashboard and sign in.');
    }
  }, [isLoggedIn]);

  const update = <K extends keyof ProductFormState>(key: K, value: ProductFormState[K]): void => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key as string]: '' }));
  };

  const onFile = useCallback((ev: ChangeEvent<HTMLInputElement>) => {
    const f = ev.target.files?.[0] ?? null;
    update('imageFile', f);
  }, []);

  const onSubmit = useCallback(
    async (ev: FormEvent<HTMLFormElement>) => {
      ev.preventDefault();
      if (!isLoggedIn || !slug || !session) {
        setPhase('error');
        setPhaseMsg('Sign in required.');
        return;
      }
      const decision = decideProductFormSubmit(form);
      if (!decision.ok) {
        setErrors(decision.errors);
        return;
      }
      setErrors({});

      let imageUrl: string | null = null;
      if (decision.imageFile) {
        setPhase('uploading');
        setPhaseMsg('Uploading image…');
        try {
          const blob = await uploadProductImageBlob({
            merchantSlug: slug,
            file: decision.imageFile,
            filename: decision.imageFile.name,
            contentType: decision.imageFile.type as ProductImageContentType,
            sessionToken: session.token,
          });
          imageUrl = blob.blobUrl;
        } catch (err) {
          setPhase('error');
          setPhaseMsg(`Image upload failed: ${err instanceof Error ? err.message : 'unknown'}`);
          return;
        }
      }

      setPhase('submitting');
      setPhaseMsg('Saving product…');

      try {
        const res = await fetch(`/api/merchants/${encodeURIComponent(slug)}/products`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.token}`,
          },
          body: JSON.stringify({ ...decision.payload, imageUrl }),
        });
        if (res.status === 201) {
          navigate(`/merchant/${encodeURIComponent(slug)}`);
          return;
        }
        const errBody = (await res.json().catch(() => null)) as { error?: string } | null;
        setPhase('error');
        setPhaseMsg(`Save failed (${res.status}): ${errBody?.error ?? 'unknown error'}`);
      } catch (err) {
        setPhase('error');
        setPhaseMsg(`Save failed: ${err instanceof Error ? err.message : 'unknown'}`);
      }
    },
    [form, isLoggedIn, navigate, session, slug],
  );

  return (
    <main style={styles.page}>
      <header style={styles.header}>
        <a href={`/merchant/${slug}`} style={styles.backLink}>
          ← Back to dashboard
        </a>
        <h1 style={styles.h1}>Add product</h1>
        <p style={styles.lede}>
          Fields marked with * are required. Image must be PNG or JPG, ≤5 MB. Real footprint
          Width × Depth (mm) are required — they place your product to-scale in the room designer
          and drive the top-down catalog render. Upload a clear product photo; we generate the
          to-scale top-down for you.
        </p>
      </header>

      <form onSubmit={onSubmit} style={styles.form}>
        <Field label="Product name *" error={errors.name}>
          <input
            type="text"
            value={form.name}
            onChange={(e) => update('name', e.target.value)}
            style={styles.input}
            maxLength={200}
            data-testid="product-name"
          />
        </Field>

        <Field label="Description" error={errors.description}>
          <textarea
            value={form.description}
            onChange={(e) => update('description', e.target.value)}
            style={{ ...styles.input, minHeight: 80 }}
            maxLength={5000}
            data-testid="product-description"
          />
        </Field>

        <Field label="Category *" error={errors.category}>
          <select
            value={form.category}
            onChange={(e) => update('category', e.target.value as ProductCategory)}
            style={styles.input}
            data-testid="product-category"
          >
            {PRODUCT_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c.charAt(0).toUpperCase() + c.slice(1)}
              </option>
            ))}
          </select>
        </Field>

        <div style={styles.row}>
          <Field label="Price *" error={errors.priceMajor}>
            <input
              type="number"
              min={0}
              step="0.01"
              value={form.priceMajor}
              onChange={(e) => update('priceMajor', e.target.value)}
              style={styles.input}
              data-testid="product-price"
            />
          </Field>
          <Field label="Currency *" error={errors.currency}>
            <select
              value={form.currency}
              onChange={(e) => update('currency', e.target.value as Currency)}
              style={styles.input}
              data-testid="product-currency"
            >
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <Field label="Eco-certification" error={errors.ecoCertLevel}>
          <select
            value={form.ecoCertLevel}
            onChange={(e) => update('ecoCertLevel', e.target.value as ProductFormState['ecoCertLevel'])}
            style={styles.input}
            data-testid="product-eco-cert"
          >
            {ECO_CERT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>

        <div style={styles.row3}>
          <Field label="Width (mm) *" error={errors.widthMm}>
            <input
              type="number"
              min={1}
              step={1}
              value={form.widthMm}
              onChange={(e) => update('widthMm', e.target.value)}
              style={styles.input}
              data-testid="product-width"
            />
          </Field>
          <Field label="Depth (mm) *" error={errors.depthMm}>
            <input
              type="number"
              min={1}
              step={1}
              value={form.depthMm}
              onChange={(e) => update('depthMm', e.target.value)}
              style={styles.input}
              data-testid="product-depth"
            />
          </Field>
          <Field label="Height (mm)" error={errors.heightMm}>
            <input
              type="number"
              min={0}
              step={1}
              value={form.heightMm}
              onChange={(e) => update('heightMm', e.target.value)}
              style={styles.input}
              data-testid="product-height"
            />
          </Field>
        </div>

        <Field label="Top-down image (PNG/JPG, ≤5 MB)" error={errors.imageFile}>
          <input
            type="file"
            accept="image/png,image/jpeg"
            onChange={onFile}
            style={styles.input}
            data-testid="product-image"
          />
          {form.imageFile && (
            <p style={styles.fileInfo}>
              {form.imageFile.name} — {(form.imageFile.size / 1024).toFixed(0)} KB
            </p>
          )}
        </Field>

        {phaseMsg && (
          <p style={phase === 'error' ? styles.errorBanner : styles.infoBanner}>{phaseMsg}</p>
        )}

        <div style={styles.actions}>
          <button
            type="submit"
            disabled={phase === 'uploading' || phase === 'submitting' || !isLoggedIn}
            style={styles.submitBtn}
            data-testid="product-submit"
          >
            {phase === 'uploading' ? 'Uploading…' : phase === 'submitting' ? 'Saving…' : 'Add product'}
          </button>
        </div>
      </form>
    </main>
  );
}

function Field(props: { label: string; error?: string; children: React.ReactNode }): JSX.Element {
  return (
    <div style={styles.field}>
      <label style={styles.label}>{props.label}</label>
      {props.children}
      {props.error && <p style={styles.errorText}>{props.error}</p>}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    background: BRAND.deepNavy,
    color: BRAND.cream,
    fontFamily: BRAND.sans,
    padding: '32px 24px',
    boxSizing: 'border-box',
  },
  header: {
    maxWidth: 720,
    margin: '0 auto 24px',
  },
  backLink: {
    color: BRAND.gold,
    textDecoration: 'none',
    fontSize: 14,
    display: 'inline-block',
    marginBottom: 16,
  },
  h1: {
    fontFamily: BRAND.serif,
    fontSize: 32,
    margin: '0 0 8px',
    color: BRAND.cream,
  },
  lede: {
    color: BRAND.muted,
    fontSize: 14,
    lineHeight: 1.5,
    margin: 0,
  },
  form: {
    maxWidth: 720,
    margin: '0 auto',
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: 600,
    color: BRAND.cream,
  },
  input: {
    background: BRAND.navy,
    border: `1px solid ${BRAND.creamLine}`,
    color: BRAND.cream,
    fontFamily: BRAND.sans,
    fontSize: 15,
    padding: '10px 12px',
    borderRadius: 6,
    boxSizing: 'border-box',
    width: '100%',
  },
  row: {
    display: 'grid',
    gridTemplateColumns: '2fr 1fr',
    gap: 12,
  },
  row3: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr 1fr',
    gap: 12,
  },
  errorText: {
    color: BRAND.red,
    fontSize: 12,
    margin: 0,
  },
  errorBanner: {
    background: 'rgba(224,122,122,0.18)',
    color: BRAND.red,
    padding: '10px 12px',
    borderRadius: 6,
    fontSize: 13,
    margin: 0,
  },
  infoBanner: {
    background: BRAND.goldSoft,
    color: BRAND.gold,
    padding: '10px 12px',
    borderRadius: 6,
    fontSize: 13,
    margin: 0,
  },
  fileInfo: {
    color: BRAND.muted,
    fontSize: 12,
    margin: '4px 0 0',
  },
  actions: {
    display: 'flex',
    justifyContent: 'flex-end',
    marginTop: 8,
  },
  submitBtn: {
    background: BRAND.gold,
    color: BRAND.deepNavy,
    border: 'none',
    fontFamily: BRAND.sans,
    fontWeight: 700,
    fontSize: 15,
    padding: '12px 24px',
    borderRadius: 6,
    cursor: 'pointer',
  },
};
