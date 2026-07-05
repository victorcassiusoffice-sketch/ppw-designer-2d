/**
 * Server-side PayPal REST client - raw fetch, no SDK.
 *
 * Why raw fetch instead of @paypal/checkout-server-sdk:
 *   - Zero extra deps in the Vercel bundle (cold-start size matters).
 *   - The SDK adds ~1.5MB to the lambda for three calls.
 *   - We only need three calls: OAuth, Create Order, Capture Order.
 *
 * Env contract:
 *   - PAYPAL_CLIENT_ID
 *   - PAYPAL_CLIENT_SECRET
 *   - PAYPAL_ENV ('sandbox' | 'live')
 *
 * The access token is cached in module memory until 60s before expiry.
 * Multiple lambda instances each maintain their own cache - PayPal
 * allows many concurrent tokens per app so that's fine.
 */

const SANDBOX_BASE = 'https://api-m.sandbox.paypal.com';
const LIVE_BASE = 'https://api-m.paypal.com';

export type PaypalEnv = 'sandbox' | 'live';

export interface PaypalEnvConfig {
  clientId: string;
  clientSecret: string;
  env: PaypalEnv;
  baseUrl: string;
}

/** Read + validate PayPal env vars. Throws if anything is missing. */
export function readPaypalEnv(): PaypalEnvConfig {
  const clientId = (process.env.PAYPAL_CLIENT_ID ?? '').trim();
  const clientSecret = (process.env.PAYPAL_CLIENT_SECRET ?? '').trim();
  const rawEnv = (process.env.PAYPAL_ENV ?? 'sandbox').trim().toLowerCase();
  if (!clientId || !clientSecret) {
    throw new Error('PayPal not configured');
  }
  const env: PaypalEnv = rawEnv === 'live' ? 'live' : 'sandbox';
  const baseUrl = env === 'live' ? LIVE_BASE : SANDBOX_BASE;
  return { clientId, clientSecret, env, baseUrl };
}

interface CachedToken {
  token: string;
  expiresAt: number;
}

let _cached: CachedToken | null = null;

/** Test hook - wipe the in-memory token cache. */
export function _resetPaypalTokenCacheForTests(): void {
  _cached = null;
}

/**
 * Fetch and cache an OAuth2 access token via PayPal's
 * client-credentials grant. Returns a cached value if it's still good
 * for at least another 60s.
 *
 * The `fetchFn` parameter lets tests inject a stub. Defaults to global
 * `fetch` (Node 18+ on Vercel).
 */
export async function getPaypalAccessToken(
  cfg: PaypalEnvConfig,
  fetchFn: typeof fetch = fetch,
): Promise<string> {
  const now = Date.now();
  if (_cached && _cached.expiresAt - 60_000 > now) {
    return _cached.token;
  }
  const basic = Buffer.from(`${cfg.clientId}:${cfg.clientSecret}`).toString('base64');
  const res = await fetchFn(`${cfg.baseUrl}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: 'grant_type=client_credentials',
  });
  if (!res.ok) {
    throw new Error(`PayPal OAuth failed: ${res.status}`);
  }
  const body = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!body.access_token || typeof body.access_token !== 'string') {
    throw new Error('PayPal OAuth returned no access_token');
  }
  const expiresInSec =
    typeof body.expires_in === 'number' && body.expires_in > 0 ? body.expires_in : 3600;
  _cached = { token: body.access_token, expiresAt: now + expiresInSec * 1000 };
  return body.access_token;
}

/**
 * Authenticated PayPal REST call. Caller passes a path (e.g.
 * '/v2/checkout/orders') and standard fetch init. We attach the auth
 * header and resolve `baseUrl` from env.
 */
export async function paypalFetch(
  path: string,
  init: RequestInit = {},
  cfg: PaypalEnvConfig = readPaypalEnv(),
  fetchFn: typeof fetch = fetch,
): Promise<Response> {
  const token = await getPaypalAccessToken(cfg, fetchFn);
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...((init.headers as Record<string, string> | undefined) ?? {}),
  };
  return fetchFn(`${cfg.baseUrl}${path}`, { ...init, headers });
}
