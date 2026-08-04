/**
 * Gumroad checkout client helpers — Phase 0 interim rail (2026-08-04).
 *
 * Outbound leg: MarketplaceCheckoutPage POSTs the cart to
 * /api/gumroad/create-order, saves the orderRef to localStorage (the
 * cart itself is NOT cleared — clearing happens only after the payment
 * is confirmed captured on the track page), then redirects the tab to
 * the returned PWYW checkout URL.
 *
 * Return leg: the Gumroad product's "redirect after purchase" URL points
 * at /order/gumroad-return (static — Gumroad cannot template our per-order
 * ref into it). That page resolves the orderRef from localStorage (or an
 * order_ref query param if present) and forwards to
 * /order/track/:ref?rail=gumroad, where OrderTrackPage polls the order
 * until the Ping webhook flips it pending → captured.
 */

export const GUMROAD_PENDING_REF_KEY = 'ppw_gumroad_pending_ref';

export function saveGumroadPendingRef(ref: string): void {
  try {
    localStorage.setItem(GUMROAD_PENDING_REF_KEY, ref);
  } catch {
    /* storage unavailable — return page falls back to query param */
  }
}

export function readGumroadPendingRef(): string | null {
  try {
    const v = localStorage.getItem(GUMROAD_PENDING_REF_KEY);
    return v && v.trim().length > 0 ? v : null;
  } catch {
    return null;
  }
}

export function clearGumroadPendingRef(): void {
  try {
    localStorage.removeItem(GUMROAD_PENDING_REF_KEY);
  } catch {
    /* swallow */
  }
}

/** True when this navigation is a Gumroad return (`?rail=gumroad`). */
export function readGumroadReturnFlag(search: string): boolean {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  return params.get('rail') === 'gumroad';
}

/** Resolve the order ref on the return page: explicit query param wins,
 *  localStorage pending ref is the fallback. */
export function resolveGumroadReturnRef(search: string): string | null {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  const fromQuery = params.get('order_ref');
  if (fromQuery && fromQuery.trim().length > 0) return fromQuery.trim();
  return readGumroadPendingRef();
}

/** Strip the Gumroad round-trip params from a URL once settled. */
export function stripGumroadReturnParams(href: string): string {
  const url = new URL(href, 'http://placeholder.local');
  url.searchParams.delete('rail');
  url.searchParams.delete('sale_id');
  url.searchParams.delete('order_ref');
  const qs = url.searchParams.toString();
  return `${url.pathname}${qs ? `?${qs}` : ''}${url.hash}`;
}

export interface GumroadCreateResponse {
  orderRef: string;
  checkoutUrl: string;
  usdMinor: number;
  fxRateUsed: number;
  fxIndicative: boolean;
  fxDisclosure: string;
  priceAdjusted?: boolean;
  error?: string;
}

/** POST the cart to the create-order endpoint. Throws on HTTP failure
 *  with the server's safe error message. */
export async function createGumroadOrder(body: unknown): Promise<GumroadCreateResponse> {
  const res = await fetch('/api/gumroad/create-order', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const j = (await res.json().catch(() => ({}))) as GumroadCreateResponse;
  if (!res.ok) {
    throw new Error(j.error ?? `HTTP ${res.status}`);
  }
  return j;
}
