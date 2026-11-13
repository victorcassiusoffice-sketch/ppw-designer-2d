export const SESSION_STORAGE_KEY = 'ppw_merchant_session_v1';

interface MerchantSessionPayload {
  slug: string;
  email: string;
  exp: number;
}

export interface StoredSession {
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

export function writeStored(session: StoredSession): void {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
  } catch {
    // ignore quota errors
  }
}

export function clearStored(): void {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.removeItem(SESSION_STORAGE_KEY);
  } catch {
    // ignore
  }
}

export function stripSessionParamFromUrl(): void {
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
