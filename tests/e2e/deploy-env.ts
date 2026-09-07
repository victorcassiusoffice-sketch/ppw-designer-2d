import type { APIRequestContext } from '@playwright/test';

/**
 * Which deployment is under test, from `/api/healthcheck` (`env`:
 * "production" | "preview" | …). null when the target has no API (a dev
 * server) or the healthcheck is unreachable. Cache-busted: the route sits
 * behind the edge cache and a plain GET can answer for a stale build.
 */
export async function deployEnv(request: APIRequestContext): Promise<string | null> {
  try {
    const res = await request.get(`/api/healthcheck?cb=${Math.random().toString(36).slice(2)}`);
    if (!res.ok()) return null;
    const body = (await res.json()) as { env?: string };
    return body.env ?? null;
  } catch {
    return null;
  }
}

/**
 * Preview deployments carry no merchant-session secret, so the magic-link
 * route answers 503 there by design (`readMerchantSessionSecret` throws →
 * 503 "temporarily unavailable"). Environment, not code: skip on a preview
 * with the reason on the record, and stay strict on production.
 */
export const PREVIEW_NO_SECRET_SKIP =
  'preview deployments carry no merchant-session secret — magic-link answers 503 there by design (env, not code)';

export async function previewWithoutSecret(request: APIRequestContext, status: number): Promise<boolean> {
  return status === 503 && (await deployEnv(request)) === 'preview';
}
