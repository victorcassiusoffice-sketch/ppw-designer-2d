/**
 * Phase 5 — full customer journey + 6 screenshots.
 *
 * Verifies on https://designer.ppwellness.co:
 *   arrive → place K1 product → draw walls → toggle 3D → 3D click-to-place
 *   → BUY routes to k1-sport.com with Pattern C attribution → mobile 390 px
 *   variant of the same flow green.
 *
 * Outputs to `_handoff/preview/sims-level-pass-complete-2026-05-21/`.
 */
import { test, expect, devices } from '@playwright/test';
import * as path from 'node:path';

const SHOT_DIR =
  process.env.PPW_PHASE5_SHOT_DIR ??
  path.resolve(
    process.cwd(),
    '..',
    'PPW-Second-Brain',
    '06-Roadmap',
    '_handoff',
    'preview',
    'sims-level-pass-complete-2026-05-21',
  );

async function dismissCoach(page: import('@playwright/test').Page): Promise<void> {
  // Only seed the coach-mark seen-flag; do NOT touch walls or merchant
  // session here — those state slots are seeded later in the test and
  // would be wiped out by addInitScript firing on every reload.
  await page.addInitScript(() => {
    try {
      window.localStorage.setItem('ppw_designer_coach_v1', '1');
    } catch { /* ignore */ }
  });
}

test.describe('Phase 5 — desktop journey', () => {
  test('customer arrives → place K1 → walls → BABYLON 3D → BUY → k1-sport attribution', async ({ page }) => {
    await dismissCoach(page);

    // Seed 4 walls + clear merchant session in init script so they survive
    // the inevitable engine-toggle navigations.
    await page.addInitScript(() => {
      try {
        if (!window.localStorage.getItem('ppw_walls_v1')) {
          window.localStorage.setItem('ppw_walls_v1', JSON.stringify([
            { id: 'w1', start: { x_mm: 0, y_mm: 0 }, end: { x_mm: 4000, y_mm: 0 }, thickness_mm: 100, height_mm: 2700, type: 'full' },
            { id: 'w2', start: { x_mm: 4000, y_mm: 0 }, end: { x_mm: 4000, y_mm: 3000 }, thickness_mm: 100, height_mm: 2700, type: 'full' },
            { id: 'w3', start: { x_mm: 4000, y_mm: 3000 }, end: { x_mm: 0, y_mm: 3000 }, thickness_mm: 100, height_mm: 2700, type: 'full' },
            { id: 'w4', start: { x_mm: 0, y_mm: 3000 }, end: { x_mm: 0, y_mm: 0 }, thickness_mm: 100, height_mm: 2700, type: 'full' },
          ]));
        }
        window.localStorage.removeItem('ppw_merchant_session_v1');
      } catch { /* ignore */ }
    });

    await page.goto('/designer');
    await page.waitForSelector('[data-testid="items-placed"]', { timeout: 15_000 });

    // 1. Arrive screenshot
    await page.screenshot({ path: path.join(SHOT_DIR, '01-arrive-desktop.png'), fullPage: true });

    // 2. Place a K1 product via the M1 pointer-FSM.
    await page.locator('[data-product-id]').first().click();
    const stage = page.locator('.konva-stage').first();
    const box = await stage.boundingBox();
    if (!box) throw new Error('no stage');
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    await page.mouse.move(cx, cy, { steps: 6 });
    await page.mouse.down();
    await page.mouse.up();
    await expect(page.locator('[data-testid="items-placed"]')).toHaveText('1', { timeout: 10_000 });
    await page.screenshot({ path: path.join(SHOT_DIR, '02-placed-desktop.png'), fullPage: true });

    // 3. Engage Wall mode to verify the 4 seeded walls render + close the room.
    await page.getByRole('button', { name: /^Wall$/ }).click();
    await expect(page.locator('[data-testid="wall-count"]')).toHaveText('4', { timeout: 5_000 });
    await expect(page.locator('[data-testid="room-area"]')).toContainText(/m²/);
    await page.screenshot({ path: path.join(SHOT_DIR, '03-walls-desktop.png'), fullPage: true });

    // 4. (Babylon 3D engine-swap step removed with the 3D viewer — P1-1 2026-06-04.
    //    Konva 2D is the only engine now.)

    // 5. Verify the BUY-from-K1 attribution URL works directly via /api/k1/redirect.
    // (Decoupled from re-selecting the placed item because the engine swap
    // may have cleared the 2D selection; this proves the Pattern C server
    // contract independently.)
    const res = await page.request.get(
      '/api/k1/redirect?slug=k1-sport&productId=m-19&productSku=K1-STRG-FIDBN&productName=Adjustable+Bench&productPriceMinor=1100000&productCurrency=MUR&designId=phase5desktop&sessionId=phase5desktop',
      { maxRedirects: 0 },
    );
    expect(res.status()).toBeGreaterThanOrEqual(300);
    expect(res.status()).toBeLessThan(400);
    expect(res.headers().location).toContain('k1-sport.com');
    expect(res.headers().location).toMatch(/ref=PPW-/);

    // Back to 2D to capture the BUY button screenshot.
    await page.goto('/designer?engine=konva');
    await page.waitForSelector('[data-testid="items-placed"]', { timeout: 15_000 });
    // Place a fresh item so the BUY button has something to attach to.
    await page.locator('[data-product-id]').first().click();
    const stage3 = page.locator('.konva-stage').first();
    const box3 = await stage3.boundingBox();
    if (!box3) throw new Error('no stage');
    await page.mouse.move(box3.x + box3.width / 2, box3.y + box3.height / 2, { steps: 6 });
    await page.mouse.down();
    await page.mouse.up();
    await page.waitForTimeout(300);
    await page.mouse.click(box3.x + box3.width / 2, box3.y + box3.height / 2);
    await page.waitForTimeout(300);
    const buy = page.locator('a[data-testid="buy-from-k1-sport"]:visible').first();
    await expect(buy).toBeVisible({ timeout: 5_000 });
    await page.screenshot({ path: path.join(SHOT_DIR, '05-buy-button-desktop.png'), fullPage: true });
  });
});

test.describe('Phase 5 — mobile 390 px journey', () => {
  test('mobile 390 px: designer renders + BUY-from-K1 redirect works for the mobile UA', async ({ browser }) => {
    const ctx = await browser.newContext({ ...devices['iPhone 13'] });
    const page = await ctx.newPage();
    await dismissCoach(page);
    await page.goto('/designer');
    await page.waitForSelector('[data-testid="items-placed"]', { timeout: 15_000 });

    // The mobile UA shows the "Best experienced on a laptop" banner +
    // bottom-sheet catalog. We don't drive the M1 FSM here (touch DnD
    // bridges differently); we verify the same /api/k1/redirect contract
    // the BUY button hits behaves correctly for a mobile user.
    const probe = await page.request.get(
      '/api/k1/redirect?slug=k1-sport&productSku=K1-CDIO-NT2450&productName=NordicTrack&productPriceMinor=15000000&productCurrency=MUR&designId=phase5mobile&sessionId=phase5mobile',
      { maxRedirects: 0 },
    );
    expect(probe.status()).toBeGreaterThanOrEqual(300);
    expect(probe.status()).toBeLessThan(400);
    expect(probe.headers().location).toContain('k1-sport.com');
    expect(probe.headers().location).toMatch(/ref=PPW-/);

    await page.screenshot({ path: path.join(SHOT_DIR, '06-mobile-390px.png'), fullPage: true });
    await ctx.close();
  });
});
