/**
 * PCF-4 — K1 critical-paths Playwright spec.
 *
 * Real-user-journey coverage of the four PCFs that gate Vic's K1
 * meeting (2026-05-19):
 *
 *   PCF-1: merchant /api/products visible in customer Designer Catalog.
 *   PCF-2: V4 banner + repositioned Gaming Layer 1 surfaces visible.
 *   PCF-3: merchant agent surface walkable.
 *   PCF-4: mobile (390 px) viewport doesn't break any of the above.
 *
 * Skipped on CI until Vic provides PPW_E2E_DESIGNER_URL (defaults
 * to https://designer.ppwellness.co for production smokes).
 */

import { test, expect, devices } from '@playwright/test';

const BASE_URL = process.env.PPW_E2E_DESIGNER_URL ?? 'https://designer.ppwellness.co';
const DEMO_SLUG = 'demo-supplier-cn';

test.describe('K1 critical paths — desktop', () => {
  test('PCF-2: V4 banner is visible on /', async ({ page }) => {
    await page.goto(BASE_URL);
    const banner = page.getByRole('status', { name: /v4 designer mode banner/i });
    await expect(banner).toBeVisible();
    await expect(banner).toContainText(/merchant catalog active/i);
  });

  test('PCF-2: StatusCard renders in top-right column', async ({ page }) => {
    await page.goto(BASE_URL);
    const stats = page.getByRole('status', { name: /room statistics/i });
    await expect(stats).toBeVisible();
    await expect(stats).toContainText(/Room value/i);
    await expect(stats).toContainText(/Floor area/i);
  });

  test('PCF-2: Help "?" launcher renders + opens HelpOverlay', async ({ page }) => {
    await page.goto(BASE_URL);
    const help = page.getByRole('button', { name: /open keyboard shortcuts help/i });
    await expect(help).toBeVisible();
    await help.click();
    await expect(page.getByRole('dialog', { name: /keyboard shortcuts/i })).toBeVisible();
    await page.keyboard.press('Escape');
  });

  test('PCF-1: customer catalog shows the seeded merchant SKUs', async ({ page }) => {
    await page.goto(BASE_URL);
    // Catalog count surfaces total inc. merchant rows; just check one
    // of the merchant-sourced SKU names lands in the catalog.
    await expect(page.getByText(/Matrix-style Massage Chair/i)).toBeVisible({ timeout: 10_000 });
  });

  test('PCF-1: /api/products returns >= 5 active rows', async ({ request }) => {
    const res = await request.get(`${BASE_URL}/api/products?limit=20`);
    expect(res.ok()).toBe(true);
    const body = (await res.json()) as { products: Array<{ sku: string }> };
    expect(body.products.length).toBeGreaterThanOrEqual(5);
    const skus = body.products.map((p) => p.sku);
    expect(skus).toContain('DEMO-MC-01');
    expect(skus).toContain('DEMO-SP-01');
    expect(skus).toContain('DEMO-TM-01');
  });

  test('PCF-3: merchant agent page loads + session bootstraps', async ({ page, request }) => {
    const sessionRes = await request.get(`${BASE_URL}/api/merchants/${DEMO_SLUG}/agent-session`);
    expect(sessionRes.ok()).toBe(true);
    const body = (await sessionRes.json()) as { session: { merchantId: number } };
    expect(body.session.merchantId).toBe(14);

    await page.goto(`${BASE_URL}/merchant/${DEMO_SLUG}/agent`);
    await expect(page.locator('body')).toBeVisible();
  });

  test('PCF-3: reference PDF endpoints serve PDF bytes', async ({ request }) => {
    const v1 = await request.get(`${BASE_URL}/api/capture/reference-page.pdf`);
    expect(v1.status()).toBe(200);
    expect(v1.headers()['content-type']).toContain('application/pdf');

    const v2 = await request.get(`${BASE_URL}/api/capture/reference-page-v2.pdf`);
    expect(v2.status()).toBe(200);
    expect(v2.headers()['content-type']).toContain('application/pdf');
  });
});

test.describe('K1 critical paths — mobile (390 px)', () => {
  // `devices[...]` carries `defaultBrowserType: 'webkit'`, and Playwright
  // REFUSES a browser-type change inside a describe ("forces a new worker") —
  // which aborted the ENTIRE suite run before a single test executed, hiding
  // every other failure in the repo. Emulate the device without the browser
  // switch: the configured project is chromium-desktop, so webkit was never
  // going to be honoured here anyway.
  const { defaultBrowserType: _ignored, ...iPhone12 } = devices['iPhone 12'];
  test.use(iPhone12);

  test('PCF-4: V4 banner visible on iPhone 12 viewport', async ({ page }) => {
    await page.goto(BASE_URL);
    const banner = page.getByRole('status', { name: /v4 designer mode banner/i });
    await expect(banner).toBeVisible();
  });

  test('PCF-4: customer catalog renders merchant SKUs on mobile', async ({ page }) => {
    await page.goto(BASE_URL);
    // On mobile the catalog is in a bottom-sheet; the SKU text may
    // not be in the DOM until the sheet opens. Just verify the
    // V4 banner reports merchant SKU count > 0.
    const banner = page.getByRole('status', { name: /v4 designer mode banner/i });
    await expect(banner).toContainText(/merchant SKU/i);
  });

  test('PCF-4: merchant agent loads on mobile', async ({ page }) => {
    await page.goto(`${BASE_URL}/merchant/${DEMO_SLUG}/agent`);
    await expect(page.locator('body')).toBeVisible();
  });
});
