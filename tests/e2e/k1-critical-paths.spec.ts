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
// 2026-07-26 (WD rework, Vic directive 5): "/" is now the SHOP
// (PublicProductsPage). The room designer these PCFs cover moved to /designer,
// so every UI test below must target that, not the site root.
const DESIGNER_URL = `${BASE_URL}/designer`;
// The 3-step CoachMark (App.tsx, flag `ppw_designer_coach_v1`) is a
// full-screen role=dialog on first visit and intercepts pointer events on the
// chrome. Seeding the flag = arriving as a returning user; it changes no
// assertion, it just gets the modal out of the way.
const seedReturningUser = (page: import('@playwright/test').Page) =>
  page.addInitScript(() => window.localStorage.setItem('ppw_designer_coach_v1', '1'));

test.describe('K1 critical paths — desktop', () => {
  // RETIRED: V4Banner.tsx was DELETED in ef5817c (2026-05-19) - "the dev-only
  // 'V4 is on' banner served no remaining purpose", aligning with Final-State
  // #17 "no V4 dev banner visible". Nothing renders that role=status any more,
  // so this PCF pins a surface Vic deliberately removed. Deleted rather than
  // skipped: unlike the Babylon toggle there is no dormant code path to
  // un-skip - the component is gone from the repo.

  test('PCF-2: room KPIs (area · zoom · items · value) render on the designer', async ({ page }) => {
    // Was the floating StatusCard at top-right. Vic un-mounted it 2026-05-22
    // (8b7a6d3, "Fix 2.5 - right-side floating banner removed") and the same
    // KPIs moved into the canvas chrome + RoomList rows. Same numbers, new
    // home - so this still pins that the customer can see them.
    await seedReturningUser(page);
    await page.goto(DESIGNER_URL);
    await expect(page.locator('[data-testid="items-placed"]')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('[data-testid="cost-readout"]')).toBeVisible();
  });

  test('PCF-2: Help "?" launcher renders + opens HelpOverlay', async ({ page }) => {
    await seedReturningUser(page);
    await page.goto(DESIGNER_URL);
    const help = page.getByRole('button', { name: /open keyboard shortcuts help/i });
    await expect(help).toBeVisible();
    await help.click();
    await expect(page.getByRole('dialog', { name: /keyboard shortcuts/i })).toBeVisible();
    await page.keyboard.press('Escape');
  });

  test('PCF-1: customer catalog shows rows blended in from /api/products', async ({ page }) => {
    // Was a SKU-NAME check on DEMO-MC-01. Two things moved: DEMO-* is hidden
    // from the public catalog since 412913e (2026-07-05 catalog hygiene), and
    // every live API SKU is ALSO in the bundled products.json - so a name
    // check would go green with the API completely dead, proving nothing.
    // Pin the `m-<dbId>` namespace instead, which ONLY apiCatalogAdapter
    // produces: that is a real proof the blend happened.
    await seedReturningUser(page);
    await page.goto(DESIGNER_URL);
    await expect(page.locator('[data-product-id^="m-"]').first())
      .toBeVisible({ timeout: 25_000 });
  });

  test('PCF-1: /api/products returns >= 5 active rows', async ({ request }) => {
    // include_demo=1 since 412913e (2026-07-05): DEMO-* rows are hidden from
    // the public catalog. limit=100 (endpoint max) because the sort is
    // created_at DESC and the DEMO rows are the oldest - at limit=20 they fall
    // off the end and the SKU assertions below would fail for the wrong reason.
    const res = await request.get(`${BASE_URL}/api/products?limit=100&include_demo=1`);
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

  // RETIRED with its desktop twin: V4Banner.tsx was deleted in ef5817c.
  test('PCF-4: the designer canvas renders on an iPhone 12 viewport', async ({ page }) => {
    await seedReturningUser(page);
    await page.goto(DESIGNER_URL);
    await expect(page.locator('.konvajs-content canvas').first()).toBeVisible({ timeout: 15_000 });
  });

  test('PCF-4: customer catalog renders merchant SKUs on mobile', async ({ page }) => {
    // Was asserted via the V4 banner's "N merchant SKUs" text; that banner was
    // deleted in ef5817c. Assert the blended rows directly instead - stronger,
    // because it reads the catalog itself rather than a label about it.
    await seedReturningUser(page);
    await page.goto(DESIGNER_URL);
    // toBeAttached, not toBeVisible: the mobile strip scrolls horizontally, so
    // a mounted row can legitimately sit off-screen (confirmed on production -
    // the locator resolves to m-6 but reports hidden). 25s because
    // fetchApiProducts() resolves noticeably slower under mobile emulation
    // (measured 3-8s), and the merged catalog only gains m- rows once it lands.
    await expect(page.locator('[data-product-id^="m-"]').first())
      .toBeAttached({ timeout: 25_000 });
  });

  test('PCF-4: merchant agent loads on mobile', async ({ page }) => {
    await page.goto(`${BASE_URL}/merchant/${DEMO_SLUG}/agent`);
    await expect(page.locator('body')).toBeVisible();
  });
});
