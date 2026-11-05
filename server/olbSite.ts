import { next, rewrite } from '@vercel/functions';
import { ACCESS_COOKIE, digest, safeDestination } from './accessGate';
import { ADMIN_CLEAR_COOKIE, adminCookieValue, adminSetCookie, normalizeEmail, passwordMatches, readAdminSession, type AdminConfig } from './adminAuth';
import { deckBySlug, deckForAudience } from './olbDecks';
import { adminPage, deckNotFoundPage, landingPage, type AdminView } from './olbPages';

/** onelivebuild.com's own public pages, answered before the studio code gate:
 * - /                    the landing: "Who are you?" with a dropdown of type decks;
 * - /decks/<slug>/       a type deck (static copy in public/decks/<slug>/);
 * - /admin               email + password sign-in; the cookie opens what the studio code opens;
 * - /admin/sign-out      clears the admin cookie and the studio code cookie on this browser.
 * Everything else falls through to the gate as before. designer.ppwellness.co, the shop's
 * address and the vercel.app production alias never reach this. */

export const LANDING_HOSTS: ReadonlySet<string> = new Set(['onelivebuild.com', 'www.onelivebuild.com']);

/** The landing and /admin answer on onelivebuild.com (+ www) only. A Vercel preview mirrors
 * onelivebuild.com (as brandFor does) so a branch can be checked before it is merged;
 * `?brand=ppw` on a preview gives the designer.ppwellness.co behaviour. */
export function isLandingSite(url: URL, environment: string): boolean {
  if (LANDING_HOSTS.has(url.hostname.toLowerCase())) return true;
  return environment === 'preview' && url.searchParams.get('brand') !== 'ppw';
}

type Command = (args: (string | number)[]) => Promise<unknown>;
export type OlbSiteDependencies = {
  admin: AdminConfig;
  /** The studio gate's private storage (Neon), used here for the wrong-try lockout. */
  command: Command;
  now: () => number;
  clientIp: string;
  namespace: string;
  sleep: (ms: number) => Promise<void>;
};

export const WRONG_TRY_DELAY_MS = 1000;
export const MAX_WRONG_TRIES = 10;
export const LOCKOUT_SECONDS = 600;
const MAX_FORM_BYTES = 2048;

const PAGE_HEADERS = {
  'Content-Type': 'text/html; charset=utf-8',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'same-origin',
  'X-Robots-Tag': 'noindex, nofollow',
};
const PAGE_CSP = "default-src 'none'; style-src 'unsafe-inline'; img-src 'self'; font-src 'self'; form-action 'self'; base-uri 'none'";

function landing(request: Request): Response {
  if (request.method !== 'GET' && request.method !== 'HEAD') return new Response(null, { status: 405, headers: { Allow: 'GET, HEAD' } });
  return new Response(request.method === 'HEAD' ? null : landingPage(), { status: 200, headers: {
    ...PAGE_HEADERS,
    // Same for every visitor; revalidated so a release shows at once.
    'Cache-Control': 'public, max-age=0, must-revalidate',
    'Content-Security-Policy': `${PAGE_CSP}; frame-ancestors 'self'`,
  } });
}

function adminResponse(view: AdminView, status = 200, extra: Record<string, string> = {}): Response {
  return new Response(adminPage(view), { status, headers: {
    ...PAGE_HEADERS,
    'Cache-Control': 'private, no-store, max-age=0',
    'CDN-Cache-Control': 'no-store',
    'Vercel-CDN-Cache-Control': 'no-store',
    'Content-Security-Policy': `${PAGE_CSP}; frame-ancestors 'none'`,
    'X-Frame-Options': 'DENY',
    ...extra,
  } });
}

function seeOther(location: string, cookies: string[] = []): Response {
  const headers = new Headers({ Location: location, 'Cache-Control': 'private, no-store' });
  for (const cookie of cookies) headers.append('Set-Cookie', cookie);
  return new Response(null, { status: 303, headers });
}

function deckNotFound(): Response {
  return new Response(deckNotFoundPage(), { status: 404, headers: { ...PAGE_HEADERS, 'Cache-Control': 'public, max-age=0, must-revalidate', 'Content-Security-Policy': `${PAGE_CSP}; frame-ancestors 'self'` } });
}

/** /decks/?for=<choice> (the landing form) -> that deck; anything else -> the landing. */
function chooseDeck(url: URL): Response {
  const deck = deckForAudience(url.searchParams.get('for'));
  return seeOther(deck ? `/decks/${deck.slug}/` : '/');
}

function serveDeck(url: URL): Response {
  const match = /^\/decks\/([a-z0-9-]{1,64})(\/.*)?$/.exec(url.pathname);
  const deck = match ? deckBySlug(match[1]) : undefined;
  if (!match || !deck) return deckNotFound();
  const rest = match[2];
  // The decks load assets/… by relative path, so the page itself lives at the slash form.
  if (rest === undefined) return new Response(null, { status: 308, headers: { Location: `/decks/${deck.slug}/${url.search}` } });
  if (rest === '/') return rewrite(new URL(`/decks/${deck.slug}/index.html`, url));
  // Files (pictures, fonts) are served as they are; a page-like path inside a deck is not.
  if (!rest.slice(rest.lastIndexOf('/') + 1).includes('.')) return deckNotFound();
  return next();
}

/** After sign-in: the page asked for (?next=), else the One Live Build home. */
export function adminDestination(value: string | null): string {
  if (!value) return '/home';
  const destination = safeDestination(value);
  const path = destination.split(/[?#]/)[0];
  return path === '/admin' || path === '/admin/' || path === '/admin/sign-out' ? '/home' : destination;
}

async function smallFormBody(request: Request): Promise<string | null> {
  const reader = request.body?.getReader();
  if (!reader) return '';
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_FORM_BYTES) { await reader.cancel(); return null; }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return new TextDecoder().decode(bytes);
}

function lockedMessage(unlockAt: number, now: number): string {
  const minutes = Math.max(1, Math.ceil((unlockAt - now) / 60_000));
  return `Too many tries. Try again in ${minutes} minute${minutes === 1 ? '' : 's'}.`;
}

async function admin(request: Request, url: URL, deps: OlbSiteDependencies): Promise<Response> {
  const config = deps.admin;
  const notSetUp = () => adminResponse({ state: 'not-set-up' }, 503, { 'Retry-After': '3600' });
  const unavailable = (destination: string, email = '') => adminResponse({ state: 'sign-in', next: destination, email, error: 'Sign-in is not available right now. Try again in a minute.' }, 503, { 'Retry-After': '60' });
  if (request.method === 'GET' || request.method === 'HEAD') {
    if (!config.ok) return notSetUp();
    const destination = adminDestination(url.searchParams.get('next'));
    const email = await readAdminSession(request.headers.get('cookie'), config, url.host, deps.now());
    if (email) return adminResponse({ state: 'signed-in', email, next: destination });
    return adminResponse({ state: 'sign-in', next: destination, notice: url.searchParams.has('signed-out') ? 'You are signed out.' : '' });
  }
  if (request.method !== 'POST') return adminResponse({ state: 'sign-in', next: '/home' }, 405, { Allow: 'GET, HEAD, POST' });
  if (!config.ok) return notSetUp();
  // A form on another site cannot sign anyone in (or probe the lockout).
  if (request.headers.get('origin') !== url.origin) return adminResponse({ state: 'sign-in', next: '/home', error: 'Please sign in from this page.' }, 403);
  const badForm = () => adminResponse({ state: 'sign-in', next: '/home', error: 'Please fill in your email and password.' }, 400);
  if (!request.headers.get('content-type')?.startsWith('application/x-www-form-urlencoded')) return badForm();
  if (Number(request.headers.get('content-length') ?? 0) > MAX_FORM_BYTES) return badForm();
  const text = await smallFormBody(request);
  if (text === null) return badForm();
  const form = new URLSearchParams(text);
  const email = normalizeEmail(form.get('email') ?? '');
  const password = form.get('password') ?? '';
  const destination = adminDestination(form.get('next'));
  if (!email || !password || email.length > 254 || password.length > 256) return badForm();

  const now = deps.now();
  const scope = `ppw:studio-access:v1:${deps.namespace}:${url.host}`;
  const address = (await digest(deps.clientIp)).slice(0, 32);
  const wrongTries = `${scope}:admin-wrong:${address}`;
  const lock = `${scope}:admin-lock:${address}`;
  let unlockAt: number;
  try { unlockAt = Number((await deps.command(['GET', lock])) ?? 0); }
  catch { return unavailable(destination, email); }
  if (Number.isFinite(unlockAt) && unlockAt > now) {
    await deps.sleep(WRONG_TRY_DELAY_MS);
    return adminResponse({ state: 'sign-in', next: destination, email, error: lockedMessage(unlockAt, now) }, 429, { 'Retry-After': String(Math.ceil((unlockAt - now) / 1000)) });
  }

  // The password is always checked, so a wrong email takes as long as a wrong password.
  let matches: boolean;
  try { matches = await passwordMatches(password, config); }
  catch { return unavailable(destination, email); }
  if (!matches || !config.users.includes(email)) {
    let count: number;
    try {
      count = Number(await deps.command(['INCR', wrongTries]));
      if (!Number.isSafeInteger(count) || count < 1) throw new Error('Unavailable lockout count');
      if (count === 1) await deps.command(['EXPIRE', wrongTries, LOCKOUT_SECONDS]);
      if (count >= MAX_WRONG_TRIES) await deps.command(['SET', lock, String(now + LOCKOUT_SECONDS * 1000), 'EX', LOCKOUT_SECONDS, 'NX']);
    } catch {
      await deps.sleep(WRONG_TRY_DELAY_MS);
      return unavailable(destination, email);
    }
    await deps.sleep(WRONG_TRY_DELAY_MS);
    if (count >= MAX_WRONG_TRIES) {
      return adminResponse({ state: 'sign-in', next: destination, email, error: lockedMessage(now + LOCKOUT_SECONDS * 1000, now) }, 429, { 'Retry-After': String(LOCKOUT_SECONDS) });
    }
    // 200, not 401: a form page that says "try again" (401 would need an HTTP auth challenge).
    return adminResponse({ state: 'sign-in', next: destination, email, error: 'That email or password is wrong.' });
  }

  // Signed in: forget earlier wrong tries (best effort) and set the 30-day cookie.
  try { await deps.command(['EXPIRE', wrongTries, 1]); } catch { /* the count expires by itself */ }
  return seeOther(destination, [adminSetCookie(await adminCookieValue(email, config, url.host, now))]);
}

/** Sign out = this browser forgets both ways in: the admin cookie and the studio code cookie. */
function signOut(request: Request, url: URL): Response {
  if (request.method === 'GET' || request.method === 'HEAD') return seeOther('/admin');
  if (request.method !== 'POST') return new Response(null, { status: 405, headers: { Allow: 'GET, HEAD, POST' } });
  if (request.headers.get('origin') !== url.origin) return adminResponse({ state: 'sign-in', next: '/home', error: 'Please sign out from this site.' }, 403);
  return seeOther('/admin?signed-out=1', [
    ADMIN_CLEAR_COOKIE,
    `${ACCESS_COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=None; Partitioned`,
  ]);
}

/** The landing site's own routes. Returns null for every other path (the gate decides). */
export async function handleOlbSite(request: Request, deps: OlbSiteDependencies): Promise<Response | null> {
  const url = new URL(request.url);
  const path = url.pathname;
  if (path === '/') return landing(request);
  if (path === '/decks' || path === '/decks/') return chooseDeck(url);
  if (path.startsWith('/decks/')) return serveDeck(url);
  if (path === '/admin' || path === '/admin/') return admin(request, url, deps);
  if (path === '/admin/sign-out') return signOut(request, url);
  return null;
}
