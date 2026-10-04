import { accessPage } from './accessPage';

const CODE_HASH = '35a99a53ff1b46f86a14a375742dfd7fefff96a8a2e9c4bcf0fe3546c36c9520';
export const ACCESS_COOKIE = '__Host-ppw-studio';
const SESSION_SECONDS = 12 * 60 * 60;
const encoder = new TextEncoder();
type Command = (args: (string | number)[]) => Promise<unknown>;
export type AccessDependencies = {
  command: Command;
  now: () => number;
  clientIp: string;
  namespace: string;
  codeHash?: string;
};

export async function digest(value: string): Promise<string> {
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(value))), (v) => v.toString(16).padStart(2, '0')).join('');
}
function randomHex(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)), (v) => v.toString(16).padStart(2, '0')).join('');
}
export function safeDestination(value: string | null): string {
  if (!value || !value.startsWith('/') || value.startsWith('//') || /[\\\r\n]/.test(value)) return '/designer';
  try {
    const url = new URL(value, 'https://studio.invalid');
    if (url.origin !== 'https://studio.invalid' || url.pathname === '/access' || url.pathname.startsWith('/api/')) return '/designer';
    return url.pathname + url.search + url.hash;
  } catch { return '/designer'; }
}
function fixedEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let i = 0; i < a.length; i++) difference |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return difference === 0;
}
function page(destination: string, message = '', status = 200, extra: Record<string, string> = {}) {
  return new Response(accessPage(destination, message), { status, headers: {
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'private, no-store, max-age=0',
    'CDN-Cache-Control': 'no-store',
    'Vercel-CDN-Cache-Control': 'no-store',
    'X-Robots-Tag': 'noindex, nofollow',
    'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'",
    ...extra,
  } });
}

/** An opaque random session, stored only as a hash in the existing private Redis.
 * No localStorage unlock flag, public signing key or client-side code verifier.
 * A new session is deliberately scoped to one hostname, not every preview.
 */
export async function handleAccess(request: Request, deps: AccessDependencies): Promise<Response | null> {
  const url = new URL(request.url);
  const isAccess = url.pathname === '/access';
  const destination = safeDestination(isAccess ? url.searchParams.get('next') : url.pathname + url.search);
  const namespace = `ppw:studio-access:v1:${deps.namespace}:${url.host}`;
  const cookie = (request.headers.get('cookie') ?? '').split(';').map((v) => v.trim()).find((v) => v.startsWith(`${ACCESS_COOKIE}=`))?.slice(ACCESS_COOKIE.length + 1);
  if (cookie && /^[a-f0-9]{64}$/.test(cookie)) {
    try {
      if (await deps.command(['GET', `${namespace}:session:${await digest(cookie)}`]) === 'unlocked') {
        if (isAccess) return new Response(null, { status: 303, headers: { Location: destination, 'Cache-Control': 'no-store' } });
        return null;
      }
    } catch { return page(destination, 'The studio is temporarily unavailable. Please try again shortly.', 503, { 'Retry-After': '30' }); }
  }
  if (!isAccess || request.method === 'GET' || request.method === 'HEAD') return page(destination);
  if (request.method !== 'POST') return page(destination, 'Enter the code below to open the studio.', 405, { Allow: 'GET, HEAD, POST' });
  // Prevent a third-party site silently submitting a shared code on a visitor's behalf.
  if (request.headers.get('origin') !== url.origin) return page(destination, 'Please enter your code from this page.', 403);
  if (!request.headers.get('content-type')?.startsWith('application/x-www-form-urlencoded')) return page(destination, 'Please enter the four-digit code below.', 400);
  if (Number(request.headers.get('content-length') ?? 0) > 512) return page(destination, 'Please enter the four-digit code below.', 400);
  try {
    const text = await request.text();
    if (text.length > 512) return page(destination, 'Please enter the four-digit code below.', 400);
    const bucket = Math.floor(deps.now() / 600_000);
    const ipKey = (await digest(deps.clientIp)).slice(0, 32);
    const rateKey = `${namespace}:attempts:${ipKey}:${bucket}`;
    const count = Number(await deps.command(['INCR', rateKey]));
    if (!Number.isFinite(count) || count < 1) throw new Error('Unavailable rate limit');
    if (count === 1) await deps.command(['EXPIRE', rateKey, 660]);
    if (count > 10) return page(destination, 'Too many attempts. Please try again in a few minutes.', 429, { 'Retry-After': String(600 - Math.floor(deps.now() / 1000) % 600) });
    const code = new URLSearchParams(text).get('code') ?? '';
    const expected = deps.codeHash ?? CODE_HASH;
    if (!/^[0-9]{4}$/.test(code) || !fixedEqual(await digest(code), expected)) return page(destination, 'That code does not match. Please try again.', 401);
    const token = randomHex();
    const stored = await deps.command(['SET', `${namespace}:session:${await digest(token)}`, 'unlocked', 'EX', SESSION_SECONDS, 'NX']);
    if (stored !== 'OK') throw new Error('Session was not saved');
    return new Response(null, { status: 303, headers: {
      Location: destination,
      'Cache-Control': 'private, no-store',
      // Partitioned supports the same access form inside merchant iframes.
      'Set-Cookie': `${ACCESS_COOKIE}=${token}; Path=/; Max-Age=${SESSION_SECONDS}; HttpOnly; Secure; SameSite=None; Partitioned`,
    } });
  } catch { return page(destination, 'The studio is temporarily unavailable. Please try again shortly.', 503, { 'Retry-After': '30' }); }
}

export function redisCommand(env: Record<string, string | undefined>): Command {
  return async (args) => {
    const url = env.KV_REST_API_URL;
    const token = env.KV_REST_API_TOKEN;
    if (!url || !token || !url.startsWith('https://')) throw new Error('Access storage is not configured');
    const response = await fetch(url, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(args), signal: AbortSignal.timeout(5000), cache: 'no-store' });
    if (!response.ok) throw new Error('Access storage unavailable');
    const data = await response.json() as { result?: unknown; error?: string };
    if (data.error) throw new Error('Access storage command failed');
    return data.result;
  };
}
