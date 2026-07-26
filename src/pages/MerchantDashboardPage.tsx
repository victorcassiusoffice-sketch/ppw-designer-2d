/**
 * M5 — Merchant Dashboard (RELENTLESS_GOAL 2026-05-19).
 *
 * Route: `/merchant/:slug`.
 *
 * Shows the merchant their own product grid + (placeholder) recent
 * customer designs + (placeholder) commission ledger. The Add Product
 * CTA routes to `/merchant/:slug/agent` (the M4 Integration Agent
 * surface that already exists in `MerchantAgentPage.tsx`).
 *
 * Auth note (deferred): the spec asked for "protected by merchant
 * auth". The codebase only ships admin-side Clerk (RequireAdmin); a
 * merchant-side Clerk role + Resend magic-link is its own follow-up
 * macro. M5 ships public-by-slug — the slug acts as a soft URL token.
 * Surface this gap in `_handoff/code-driver-to-dispatch.md`.
 *
 * Brand tokens applied directly: navy #232C3B / gold #FFBB58 / cream
 * #F5EBD7, plus EB Garamond display + Inter body per
 * `06-Roadmap/brand/2026-05-18-PPW-Brand-System/04-WEBSITE-THEME-APPLICATION.md`.
 * Inline styles (not Tailwind) because the brand palette lives outside
 * the existing `ppw-*` token namespace used by the designer surface.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { ApiProductsResponse, ApiProductSummary } from '../data/apiCatalogAdapter';
import { SESSION_STORAGE_KEY } from '../components/RequireMerchant';

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

/** Product management callbacks threaded to each ProductCard. */
interface ManageHandlers {
  canManage: boolean;
  onSavePrice: (id: number, priceMinor: number) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
}

const BRAND = {
  navy: '#232C3B',
  deepNavy: '#1A2230',
  gold: '#FFBB58',
  goldSoft: 'rgba(255,187,88,0.18)',
  cream: '#F5EBD7',
  creamLine: 'rgba(245,235,215,0.14)',
  muted: '#A8B0BD',
  serif: "'EB Garamond', Georgia, serif",
  sans: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif",
} as const;

type FetchState =
  | { phase: 'loading' }
  | { phase: 'loaded'; products: ApiProductSummary[]; merchantNotFound: boolean }
  | { phase: 'error'; message: string };

function fmtPrice(p: ApiProductSummary): string {
  const value = (p.priceMinor ?? 0) / 100;
  const formatted = value.toLocaleString('en-MU', { maximumFractionDigits: 0 });
  return `${formatted} ${p.currency || 'MUR'}`;
}

function fmtDims(p: ApiProductSummary): string {
  const w = p.widthMm ?? '?';
  const d = p.depthMm ?? '?';
  const h = p.heightMm ?? '?';
  return `${w} × ${d} × ${h} mm`;
}

export interface MerchantDashboardPageProps {
  /** Optional fetcher override for tests. */
  fetchImpl?: typeof globalThis.fetch;
}

export default function MerchantDashboardPage(
  props: MerchantDashboardPageProps = {},
): JSX.Element {
  const { slug } = useParams<{ slug: string }>();
  const [state, setState] = useState<FetchState>({ phase: 'loading' });

  useEffect(() => {
    if (!slug) {
      setState({ phase: 'error', message: 'No merchant slug in URL.' });
      return;
    }
    const fetcher = props.fetchImpl ?? globalThis.fetch;
    let cancelled = false;
    fetcher(`/api/merchants/${encodeURIComponent(slug)}/products?limit=100`)
      .then(async (res) => {
        if (cancelled) return;
        if (!res.ok && res.status !== 200) {
          setState({
            phase: 'error',
            message: `HTTP ${res.status} loading merchant products`,
          });
          return;
        }
        // The /api/merchants/:slug/products endpoint returns a
        // `merchantNotFound: true` flag on unknown slugs (200, empty
        // products list). That flag isn't surfaced on the shared
        // `ApiProductsResponse` shape used by the designer-catalog
        // adapter, so widen the cast locally.
        const json = (await res.json()) as ApiProductsResponse & {
          merchantNotFound?: boolean;
        };
        setState({
          phase: 'loaded',
          products: json.products ?? [],
          merchantNotFound: Boolean(json.merchantNotFound),
        });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setState({
          phase: 'error',
          message: err instanceof Error ? err.message : 'Failed to load merchant.',
        });
      });
    return () => {
      cancelled = true;
    };
  }, [slug, props.fetchImpl]);

  // Merchant session (Bearer token) enables in-place price edit + delete. The
  // token authorises writes for THIS slug only; the server also enforces it.
  const session = useMemo(readSession, []);
  const token = session && session.slug === slug ? session.token : null;
  const fetcher = props.fetchImpl ?? globalThis.fetch;

  const onDelete = useCallback(
    async (id: number): Promise<void> => {
      if (!slug || !token) throw new Error('Not signed in.');
      const res = await fetcher(`/api/products?slug=${encodeURIComponent(slug)}&id=${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok && res.status !== 204) throw new Error(`Delete failed (HTTP ${res.status})`);
      setState((s) =>
        s.phase === 'loaded' ? { ...s, products: s.products.filter((p) => p.id !== id) } : s,
      );
    },
    [slug, token, fetcher],
  );

  const onSavePrice = useCallback(
    async (id: number, priceMinor: number): Promise<void> => {
      if (!slug || !token) throw new Error('Not signed in.');
      const res = await fetcher(`/api/products?slug=${encodeURIComponent(slug)}&id=${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ priceMinor }),
      });
      if (!res.ok) throw new Error(`Save failed (HTTP ${res.status})`);
      setState((s) =>
        s.phase === 'loaded'
          ? { ...s, products: s.products.map((p) => (p.id === id ? { ...p, priceMinor } : p)) }
          : s,
      );
    },
    [slug, token, fetcher],
  );

  const manage: ManageHandlers = { canManage: !!token, onSavePrice, onDelete };

  return (
    <div
      data-testid="merchant-dashboard"
      data-merchant-slug={slug ?? ''}
      style={{
        minHeight: '100vh',
        background: BRAND.navy,
        color: BRAND.cream,
        fontFamily: BRAND.sans,
      }}
    >
      <Header slug={slug ?? ''} />
      <main style={{ maxWidth: 1120, margin: '0 auto', padding: '32px 24px 64px' }}>
        <ProductsSection state={state} slug={slug ?? ''} manage={manage} />
        <TwoColumnRow>
          <RecentDesignsCard />
          <CommissionLedgerCard />
        </TwoColumnRow>
      </main>
    </div>
  );
}

function Header({ slug }: { slug: string }): JSX.Element {
  return (
    <header
      style={{
        background: BRAND.deepNavy,
        borderBottom: `1px solid ${BRAND.creamLine}`,
        padding: '20px 24px',
      }}
    >
      <div style={{ maxWidth: 1120, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
          <span
            style={{
              padding: '4px 10px',
              borderRadius: 4,
              background: BRAND.gold,
              color: BRAND.deepNavy,
              fontFamily: BRAND.sans,
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
            }}
          >
            PPW Merchant
          </span>
          <h1
            style={{
              margin: 0,
              fontFamily: BRAND.serif,
              fontWeight: 500,
              fontSize: 24,
              color: BRAND.cream,
            }}
            data-testid="merchant-dashboard-title"
          >
            {slug || '—'}
          </h1>
        </div>
        <nav style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <Link
            to={`/merchant/${encodeURIComponent(slug)}/products/new`}
            data-testid="merchant-dashboard-add-product"
            style={{
              display: 'inline-block',
              padding: '8px 16px',
              borderRadius: 6,
              background: BRAND.gold,
              color: BRAND.deepNavy,
              fontFamily: BRAND.sans,
              fontWeight: 600,
              fontSize: 13,
              textDecoration: 'none',
              letterSpacing: '0.02em',
            }}
          >
            + Add product
          </Link>
          <Link
            to={`/merchant/${encodeURIComponent(slug)}/agent`}
            data-testid="merchant-dashboard-agent"
            style={{
              display: 'inline-block',
              padding: '8px 16px',
              borderRadius: 6,
              background: 'transparent',
              color: BRAND.gold,
              border: `1px solid ${BRAND.gold}`,
              fontFamily: BRAND.sans,
              fontWeight: 600,
              fontSize: 13,
              textDecoration: 'none',
              letterSpacing: '0.02em',
            }}
          >
            Open agent
          </Link>
        </nav>
      </div>
    </header>
  );
}

function SectionHeading({ children, testid }: { children: React.ReactNode; testid?: string }): JSX.Element {
  return (
    <h2
      data-testid={testid}
      style={{
        fontFamily: BRAND.serif,
        fontWeight: 500,
        fontSize: 22,
        margin: '0 0 16px',
        color: BRAND.cream,
        borderBottom: `1px solid ${BRAND.creamLine}`,
        paddingBottom: 8,
      }}
    >
      {children}
    </h2>
  );
}

function ProductsSection({
  state,
  slug,
  manage,
}: {
  state: FetchState;
  slug: string;
  manage: ManageHandlers;
}): JSX.Element {
  return (
    <section style={{ marginBottom: 40 }}>
      <SectionHeading testid="products-heading">Your products</SectionHeading>
      {state.phase === 'loading' && (
        <p style={{ color: BRAND.muted, fontSize: 13 }}>Loading product catalogue…</p>
      )}
      {state.phase === 'error' && (
        <p data-testid="products-error" style={{ color: BRAND.gold, fontSize: 13 }}>
          {state.message}
        </p>
      )}
      {state.phase === 'loaded' && state.merchantNotFound && (
        <p data-testid="merchant-not-found" style={{ color: BRAND.gold, fontSize: 13 }}>
          No merchant matches the slug “{slug}”. If you just signed up, your account may still be in review.
        </p>
      )}
      {state.phase === 'loaded' && !state.merchantNotFound && state.products.length === 0 && (
        <EmptyProducts slug={slug} />
      )}
      {state.phase === 'loaded' && state.products.length > 0 && (
        <div
          data-testid="products-grid"
          style={{
            display: 'grid',
            gap: 14,
            gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
          }}
        >
          {state.products.map((p) => (
            <ProductCard key={p.id} product={p} manage={manage} />
          ))}
        </div>
      )}
    </section>
  );
}

const MANAGE_BTN = {
  ghost: {
    padding: '4px 10px',
    borderRadius: 4,
    fontSize: 11,
    fontWeight: 600,
    cursor: 'pointer',
    border: `1px solid ${BRAND.creamLine}`,
    background: 'transparent',
    color: BRAND.cream,
  },
  primary: {
    padding: '4px 10px',
    borderRadius: 4,
    fontSize: 11,
    fontWeight: 700,
    cursor: 'pointer',
    border: 'none',
    background: BRAND.gold,
    color: BRAND.deepNavy,
  },
  danger: {
    padding: '4px 10px',
    borderRadius: 4,
    fontSize: 11,
    fontWeight: 600,
    cursor: 'pointer',
    border: '1px solid rgba(220,80,80,0.5)',
    background: 'transparent',
    color: '#F0A0A0',
  },
} as const;

function ProductCard({
  product,
  manage,
}: {
  product: ApiProductSummary;
  manage: ManageHandlers;
}): JSX.Element {
  const [editing, setEditing] = useState(false);
  const [priceMajor, setPriceMajor] = useState(String((product.priceMinor ?? 0) / 100));
  const [busy, setBusy] = useState<null | 'save' | 'delete'>(null);
  const [err, setErr] = useState<string | null>(null);

  async function handleSave(): Promise<void> {
    // Reject empty/whitespace BEFORE coercion — Number('') === 0 would slip a
    // free product past a `< 0` check. Require a positive price on this money
    // field (a $0 product can be designed into a room + routed to fulfilment).
    const raw = priceMajor.trim();
    const major = Number(raw);
    if (raw === '' || !Number.isFinite(major) || major <= 0) {
      setErr('Enter a valid price above 0.');
      return;
    }
    setBusy('save');
    setErr(null);
    try {
      await manage.onSavePrice(product.id, Math.round(major * 100));
      setEditing(false);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Save failed.');
    } finally {
      setBusy(null);
    }
  }

  async function handleDelete(): Promise<void> {
    if (
      typeof window !== 'undefined' &&
      !window.confirm(`Delete “${product.name}”? It will be removed from your catalogue.`)
    ) {
      return;
    }
    setBusy('delete');
    setErr(null);
    try {
      await manage.onDelete(product.id);
      // On success the card unmounts (removed from list) — no state reset needed.
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Delete failed.');
      setBusy(null);
    }
  }

  return (
    <article
      data-testid="merchant-product-card"
      data-product-sku={product.sku}
      style={{
        background: BRAND.deepNavy,
        border: `1px solid ${BRAND.creamLine}`,
        borderRadius: 10,
        padding: 14,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        minHeight: 180,
      }}
    >
      {product.imageUrl ? (
        // Show the product's own image (top-down render or uploaded photo).
        // White fill so transparent top-down PNGs read on the navy card.
        <img
          src={product.imageUrl}
          alt={product.name}
          loading="lazy"
          data-testid="merchant-product-image"
          style={{
            width: '100%',
            height: 70,
            borderRadius: 6,
            objectFit: 'contain',
            background: '#FFFFFF',
          }}
        />
      ) : (
        <div
          aria-hidden
          style={{
            width: '100%',
            height: 70,
            borderRadius: 6,
            background: BRAND.goldSoft,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: BRAND.gold,
            fontFamily: BRAND.serif,
            fontSize: 14,
            letterSpacing: '0.04em',
          }}
        >
          {product.category}
        </div>
      )}
      <h3
        style={{
          margin: 0,
          fontFamily: BRAND.serif,
          fontWeight: 500,
          fontSize: 16,
          color: BRAND.cream,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {product.name}
      </h3>
      <dl style={{ margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Row label="SKU" value={product.sku} muted />
        <Row label="Dimensions" value={fmtDims(product)} muted />
        <Row label="Price" value={fmtPrice(product)} accent />
      </dl>

      {manage.canManage && (
        <div
          data-testid="merchant-product-manage"
          style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}
        >
          {editing ? (
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
              <input
                type="number"
                min="0"
                step="1"
                value={priceMajor}
                onChange={(e) => setPriceMajor(e.target.value)}
                aria-label="New price"
                data-testid="merchant-product-price-input"
                style={{
                  width: 84,
                  padding: '4px 6px',
                  borderRadius: 4,
                  border: `1px solid ${BRAND.creamLine}`,
                  background: BRAND.navy,
                  color: BRAND.cream,
                  fontSize: 12,
                }}
              />
              <span style={{ fontSize: 11, color: BRAND.muted }}>{product.currency || 'MUR'}</span>
              <button
                type="button"
                onClick={handleSave}
                disabled={busy !== null}
                data-testid="merchant-product-save"
                style={MANAGE_BTN.primary}
              >
                {busy === 'save' ? 'Saving…' : 'Save'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditing(false);
                  setPriceMajor(String((product.priceMinor ?? 0) / 100));
                  setErr(null);
                }}
                disabled={busy !== null}
                style={MANAGE_BTN.ghost}
              >
                Cancel
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                type="button"
                onClick={() => setEditing(true)}
                data-testid="merchant-product-edit"
                style={MANAGE_BTN.ghost}
              >
                Edit price
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={busy !== null}
                data-testid="merchant-product-delete"
                style={MANAGE_BTN.danger}
              >
                {busy === 'delete' ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          )}
          {err && (
            <span data-testid="merchant-product-error" style={{ fontSize: 11, color: BRAND.gold }}>
              {err}
            </span>
          )}
        </div>
      )}
    </article>
  );
}

function Row({ label, value, muted, accent }: { label: string; value: string; muted?: boolean; accent?: boolean }): JSX.Element {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, gap: 8 }}>
      <dt style={{ color: BRAND.muted, fontWeight: 500, letterSpacing: '0.04em', textTransform: 'uppercase', fontSize: 10 }}>
        {label}
      </dt>
      <dd
        style={{
          margin: 0,
          color: accent ? BRAND.gold : muted ? BRAND.cream : BRAND.cream,
          fontWeight: accent ? 600 : 400,
        }}
      >
        {value}
      </dd>
    </div>
  );
}

function EmptyProducts({ slug }: { slug: string }): JSX.Element {
  return (
    <div
      data-testid="products-empty"
      style={{
        border: `1px dashed ${BRAND.creamLine}`,
        borderRadius: 10,
        padding: 32,
        textAlign: 'center',
        background: BRAND.deepNavy,
      }}
    >
      <p style={{ color: BRAND.cream, fontSize: 14, marginTop: 0 }}>
        No products yet. Open the Integration Agent and describe a product to add it to your catalogue.
      </p>
      <Link
        to={`/merchant/${encodeURIComponent(slug)}/agent`}
        style={{
          display: 'inline-block',
          padding: '8px 16px',
          borderRadius: 6,
          background: BRAND.gold,
          color: BRAND.deepNavy,
          fontFamily: BRAND.sans,
          fontWeight: 600,
          fontSize: 13,
          textDecoration: 'none',
        }}
      >
        Open Integration Agent
      </Link>
    </div>
  );
}

function TwoColumnRow({ children }: { children: React.ReactNode }): JSX.Element {
  return (
    <div
      style={{
        display: 'grid',
        gap: 18,
        gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
      }}
    >
      {children}
    </div>
  );
}

function RecentDesignsCard(): JSX.Element {
  return (
    <section
      data-testid="recent-designs-card"
      style={{
        background: BRAND.deepNavy,
        border: `1px solid ${BRAND.creamLine}`,
        borderRadius: 10,
        padding: 18,
      }}
    >
      <SectionHeading>Recent customer designs</SectionHeading>
      <p style={{ color: BRAND.muted, fontSize: 13, marginBottom: 8 }}>
        Designs that include your products will appear here.
      </p>
      <p style={{ color: BRAND.muted, fontSize: 12, fontStyle: 'italic' }}>
        Placeholder — real wiring lands with M7 commission attribution (`designer_orders` + `?ref=ppw` tracking).
      </p>
    </section>
  );
}

function CommissionLedgerCard(): JSX.Element {
  return (
    <section
      data-testid="commission-ledger-card"
      style={{
        background: BRAND.deepNavy,
        border: `1px solid ${BRAND.creamLine}`,
        borderRadius: 10,
        padding: 18,
      }}
    >
      <SectionHeading>Commission ledger</SectionHeading>
      <p style={{ color: BRAND.muted, fontSize: 13, marginBottom: 8 }}>
        Monthly commission summary: 0 orders · MUR 0 accrued.
      </p>
      <p style={{ color: BRAND.muted, fontSize: 12, fontStyle: 'italic' }}>
        Placeholder — Pattern C (manual reconciliation CSV) wires up in M7 via /api/commission/reconcile. Pattern B (MIPS split) is the M7.b ship after sub-merchant onboarding.
      </p>
    </section>
  );
}
