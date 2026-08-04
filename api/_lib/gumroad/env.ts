/**
 * Gumroad rail env — Phase 0 interim direct-sale rail (2026-08-04).
 *
 * Three server-side vars, all set by Vic in the Vercel project env
 * (see docs/GUMROAD-RAIL.md for the exact setup steps):
 *
 *   GUMROAD_ACCESS_TOKEN         — Settings → Advanced → Applications →
 *                                  Generate access token. Used ONLY for
 *                                  server-side sale verification
 *                                  (GET /v2/sales/:id). Never shipped to
 *                                  the client, never hardcoded.
 *   GUMROAD_DESIGNER_PRODUCT_ID  — the "Designer Order" product's id, read
 *                                  from the labelled licence-key block in
 *                                  the product editor (skill §5.9 — never
 *                                  guessed from page base64).
 *   GUMROAD_DESIGNER_PRODUCT_URL — full product URL, e.g.
 *                                  https://victorix08.gumroad.com/l/ppw-designer-order
 *                                  (the PWYW checkout URL params are
 *                                  appended to this).
 *
 * All three unset/blank → the rail is NOT configured; endpoints answer a
 * clear 503 instead of building broken checkout URLs (fail graceful, per
 * the gumroad-gateway-build skill §7 "an app with no product id configured
 * must be unbuyable by design").
 */

export interface GumroadEnv {
  accessToken: string;
  productId: string;
  productUrl: string;
}

export class GumroadNotConfiguredError extends Error {
  constructor(missing: string[]) {
    super(`Gumroad rail not configured (missing: ${missing.join(', ')})`);
    this.name = 'GumroadNotConfiguredError';
  }
}

export function readGumroadEnv(env: NodeJS.ProcessEnv = process.env): GumroadEnv {
  const accessToken = (env.GUMROAD_ACCESS_TOKEN ?? '').trim();
  const productId = (env.GUMROAD_DESIGNER_PRODUCT_ID ?? '').trim();
  const productUrl = (env.GUMROAD_DESIGNER_PRODUCT_URL ?? '').trim();
  const missing: string[] = [];
  if (!accessToken) missing.push('GUMROAD_ACCESS_TOKEN');
  if (!productId) missing.push('GUMROAD_DESIGNER_PRODUCT_ID');
  if (!productUrl) missing.push('GUMROAD_DESIGNER_PRODUCT_URL');
  if (missing.length > 0) throw new GumroadNotConfiguredError(missing);
  if (!/^https:\/\//.test(productUrl)) {
    throw new GumroadNotConfiguredError(['GUMROAD_DESIGNER_PRODUCT_URL (must be https)']);
  }
  return { accessToken, productId, productUrl };
}
