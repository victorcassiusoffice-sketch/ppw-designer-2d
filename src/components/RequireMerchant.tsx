/**
 * M5.b — RequireMerchant route guard.
 *
 * Gates `/merchant/:slug` and `/merchant/:slug/agent`. The merchant
 * authenticates via the magic-link flow:
 *
 *   1. They visit `/merchant/<slug>` → no token in localStorage →
 *      this component shows a sign-in form.
 *   2. They submit their email → `POST /api/merchants/<slug>/magic-link`
 *      → backend (api/orders.ts handleMerchantMagicLink) signs a token
 *      and emails them a one-click link to
 *      `/merchant/<slug>?session=<token>`.
 *   3. They click the link → this component reads `?session=` from the
 *      URL, parses the embedded payload (slug + email + exp), checks
 *      slug + expiry locally, stashes the token in localStorage, and
 *      strips the query param via history.replaceState so the URL
 *      stays clean. Then it renders children.
 *
 * The token is opaque to the client — the client only inspects the
 * unsigned payload prefix to know what slug + expiry the server signed.
 * Server-side `verifyMerchantSession` does the HMAC check on any API
 * call that needs real authorisation (deferred to M7 once the
 * commission ledger reads real numbers).
 *
 * Storage key: `ppw_merchant_session_v1`. Only one merchant per
 * browser at a time — switching merchants clears + re-issues.
 *
 * Auth-gap caveats this guard does NOT close:
 *   - The token in the URL is logged in browser/proxy/CDN access logs
 *     during the redirect step. Acceptable for M5.b pilot but should be
 *     swapped for a POST-based exchange once Clerk merchant org lands.
 *   - The client-side check is advisory — a determined visitor can paste
 *     a fabricated token. The real check is server-side. The dashboard
 *     today only renders placeholder content; this guard hides it from
 *     casual visitors. Real commission data must go through verified
 *     server API calls in M7.
 */

import { useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';

export const SESSION_STORAGE_KEY = 'ppw_merchant_session_v1';

interface MerchantSessionPayload {
  slug: string;
  email: string;
  exp: number;
}

interface StoredSession {
  slug: string;
  token: string;
  email: string;
  exp: number;
}

function base64UrlDecode(input: string): string | null {
  try {
    const padded = input.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((input.length + 3) % 4);
    if (typeof atob === 'function') return atob(padded);
    return null;
  } catch {
    return null;
  }
}

/** Inspect (NOT verify) the unsigned prefix to know slug + expiry. */
export function inspectToken(token: string): MerchantSessionPayload | null {
  if (typeof token !== 'string' || !token.includes('.')) return null;
  const body = token.slice(0, token.lastIndexOf('.'));
  const json = base64UrlDecode(body);
  if (!json) return null;
  try {
    const parsed = JSON.parse(json);
    if (
      parsed &&
      typeof parsed.slug === 'string' &&
      typeof parsed.email === 'string' &&
      typeof parsed.exp === 'number'
    ) {
      return parsed as MerchantSessionPayload;
    }
  } catch {
    // ignore
  }
  return null;
}

function readStored(): StoredSession | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredSession;
    if (
      parsed &&
      typeof parsed.slug === 'string' &&
      typeof parsed.token === 'string' &&
      typeof parsed.email === 'string' &&
      typeof parsed.exp === 'number'
    ) {
      return parsed;
    }
  } catch {
    // ignore
  }
  return null;
}

function writeStored(session: StoredSession): void {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
  } catch {
    // ignore quota errors
  }
}

function clearStored(): void {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.removeItem(SESSION_STORAGE_KEY);
  } catch {
    // ignore
  }
}

function stripSessionParamFromUrl(): void {
  try {
    if (typeof window === 'undefined' || !window.history || !window.location) return;
    const url = new URL(window.location.href);
    if (!url.searchParams.has('session')) return;
    url.searchParams.delete('session');
    window.history.replaceState({}, '', url.toString());
  } catch {
    // ignore — leaving the token in the URL bar is acceptable degradation
  }
}

const BRAND = {
  navy: '#232C3B',
  deepNavy: '#1A2230',
  gold: '#FFBB58',
  cream: '#F5EBD7',
  muted: '#A8B0BD',
  serif: "'EB Garamond', Georgia, serif",
  sans: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif",
} as const;

export interface RequireMerchantProps {
  children: React.ReactNode;
  /** Optional fetch override for tests. */
  fetchImpl?: typeof globalThis.fetch;
  /** Optional clock injection for tests. */
  now?: () => number;
}

/**
 * Resolve the active session for a given slug. Returns null if no
 * valid session is present. Exported for tests and for any other
 * surface (e.g. a future merchant-side header) that needs to read it.
 */
export function readActiveMerchantSession(
  slug: string,
  now: number = Date.now(),
): StoredSession | null {
  const stored = readStored();
  if (!stored) return null;
  if (stored.slug !== slug) return null;
  if (stored.exp <= now) return null;
  return stored;
}

export default function RequireMerchant({
  children,
  fetchImpl,
  now = Date.now,
}: RequireMerchantProps): JSX.Element {
  const { slug } = useParams<{ slug: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const [session, setSession] = useState<StoredSession | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (!slug) {
      setHydrated(true);
      return;
    }
    let active: StoredSession | null = null;
    const tokenFromUrl = searchParams.get('session');
    if (tokenFromUrl) {
      const payload = inspectToken(tokenFromUrl);
      if (payload && payload.slug === slug && payload.exp > now()) {
        active = {
          slug: payload.slug,
          email: payload.email,
          exp: payload.exp,
          token: tokenFromUrl,
        };
        writeStored(active);
      }
    }
    if (!active) {
      active = readActiveMerchantSession(slug, now());
    }
    if (tokenFromUrl) {
      // Strip ?session= from both react-router state AND window.location.
      const next = new URLSearchParams(searchParams);
      next.delete('session');
      setSearchParams(next, { replace: true });
      stripSessionParamFromUrl();
    }
    setSession(active);
    setHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, now]);

  if (!hydrated) return <BlankShell />;

  if (session && session.slug === slug) {
    return <>{children}</>;
  }

  return (
    <SignInScreen
      slug={slug ?? ''}
      fetchImpl={fetchImpl}
      onCleared={() => {
        clearStored();
        setSession(null);
      }}
    />
  );
}

function BlankShell(): JSX.Element {
  return (
    <div
      data-testid="merchant-auth-loading"
      style={{
        minHeight: '100vh',
        background: BRAND.navy,
        color: BRAND.cream,
        fontFamily: BRAND.sans,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 13,
        opacity: 0.7,
      }}
    >
      Loading sign-in…
    </div>
  );
}

interface SignInScreenProps {
  slug: string;
  fetchImpl?: typeof globalThis.fetch;
  onCleared: () => void;
}

function SignInScreen({ slug, fetchImpl }: SignInScreenProps): JSX.Element {
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fetcher = useMemo(() => fetchImpl ?? globalThis.fetch, [fetchImpl]);

  const slugDisplay = slug || '—';

  async function onSubmit(e: React.FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    if (!slug || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetcher(`/api/merchants/${encodeURIComponent(slug)}/magic-link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      if (!res.ok && res.status !== 200) {
        let msg = `Request failed (${res.status})`;
        try {
          const j = (await res.json()) as { error?: string };
          if (j.error) msg = j.error;
        } catch {
          // ignore
        }
        setError(msg);
        return;
      }
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      data-testid="merchant-sign-in"
      data-merchant-slug={slug}
      style={{
        minHeight: '100vh',
        background: BRAND.navy,
        color: BRAND.cream,
        fontFamily: BRAND.sans,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '32px 16px',
      }}
    >
      <div
        style={{
          maxWidth: 420,
          width: '100%',
          background: BRAND.deepNavy,
          border: `1px solid rgba(245,235,215,0.14)`,
          borderRadius: 10,
          padding: 32,
        }}
      >
        <h1
          style={{
            fontFamily: BRAND.serif,
            fontWeight: 500,
            fontSize: 24,
            margin: '0 0 8px',
          }}
        >
          Merchant sign-in
        </h1>
        <p style={{ color: BRAND.muted, fontSize: 13, margin: '0 0 24px' }}>
          Enter the contact email on file for <strong style={{ color: BRAND.cream }}>{slugDisplay}</strong>.
          We&rsquo;ll email you a one-click link to open the dashboard. The link is valid for 30 days.
        </p>
        {sent ? (
          <p
            data-testid="merchant-sign-in-sent"
            style={{
              color: BRAND.cream,
              background: 'rgba(255,187,88,0.14)',
              padding: 12,
              borderRadius: 6,
              fontSize: 13,
              lineHeight: 1.5,
            }}
          >
            If that email matches a registered merchant, a sign-in link has been emailed. Check your inbox.
          </p>
        ) : (
          <form onSubmit={onSubmit}>
            <label
              htmlFor="merchant-email"
              style={{ display: 'block', fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase', color: BRAND.muted, marginBottom: 6 }}
            >
              Contact email
            </label>
            <input
              id="merchant-email"
              data-testid="merchant-sign-in-email"
              type="email"
              required
              autoComplete="email"
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                padding: '10px 12px',
                borderRadius: 6,
                border: `1px solid rgba(245,235,215,0.24)`,
                background: BRAND.navy,
                color: BRAND.cream,
                fontFamily: BRAND.sans,
                fontSize: 14,
                marginBottom: 16,
              }}
            />
            {error && (
              <p
                data-testid="merchant-sign-in-error"
                style={{ color: BRAND.gold, fontSize: 12, margin: '0 0 12px' }}
              >
                {error}
              </p>
            )}
            <button
              data-testid="merchant-sign-in-submit"
              type="submit"
              disabled={submitting || !email}
              style={{
                width: '100%',
                padding: '10px 16px',
                borderRadius: 6,
                background: submitting ? 'rgba(255,187,88,0.5)' : BRAND.gold,
                color: BRAND.deepNavy,
                border: 'none',
                fontWeight: 600,
                fontSize: 13,
                cursor: submitting ? 'wait' : 'pointer',
                fontFamily: BRAND.sans,
              }}
            >
              {submitting ? 'Sending…' : 'Email me a sign-in link'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
