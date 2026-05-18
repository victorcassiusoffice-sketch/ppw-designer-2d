/**
 * Sims-Parity DT-24 — Babylon bundle-size budget gate (L2.10).
 *
 * Asserts:
 *   • The marketing-route main bundle hasn't ballooned (delta ≤ 250 KB
 *     vs the pre-Babylon baseline).
 *   • The Babylon chunk is dynamically imported (NOT shipped on /).
 *
 * Skipped on CI until Vic provides PPW_E2E_DESIGNER_URL (defaults
 * to designer.ppwellness.co).
 */

import { test, expect } from '@playwright/test';

const BASE_URL = process.env.PPW_E2E_DESIGNER_URL ?? 'https://designer.ppwellness.co';
const MARKETING_ROUTE_BUNDLE_MAX_BYTES = 1_400_000; // 1.4 MB ceiling

test.describe('DT-24 — Babylon bundle budget', () => {
  test('marketing-route main bundle stays under 1.4 MB', async ({ page }) => {
    const responses: Array<{ url: string; size: number }> = [];
    page.on('response', async (res) => {
      const url = res.url();
      if (!url.includes('/assets/') || !url.endsWith('.js')) return;
      try {
        const body = await res.body();
        responses.push({ url, size: body.length });
      } catch {
        // ignore
      }
    });
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    const mainBundle = responses.find((r) => /index-[A-Za-z0-9_-]+\.js$/.test(r.url));
    expect(mainBundle).toBeDefined();
    if (mainBundle) {
      expect(mainBundle.size).toBeLessThanOrEqual(MARKETING_ROUTE_BUNDLE_MAX_BYTES);
    }
  });

  test('BabylonRoom chunk is NOT loaded on / (proves the dynamic boundary holds)', async ({ page }) => {
    const requested: string[] = [];
    page.on('request', (req) => {
      requested.push(req.url());
    });
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    const babylonChunk = requested.find((u) => u.includes('BabylonRoom') && u.endsWith('.js'));
    expect(babylonChunk).toBeUndefined();
  });

  test('?engine=babylon DOES load the BabylonRoom chunk', async ({ page }) => {
    const requested: string[] = [];
    page.on('request', (req) => {
      requested.push(req.url());
    });
    await page.goto(`${BASE_URL}/?engine=babylon`, { waitUntil: 'networkidle' });
    const babylonChunk = requested.find((u) => u.includes('BabylonRoom') && u.endsWith('.js'));
    expect(babylonChunk).toBeDefined();
  });
});
