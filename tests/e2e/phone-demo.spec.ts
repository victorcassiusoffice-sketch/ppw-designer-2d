/**
 * Phone pass (2026-09-16) — the Sofap demo on a 390 px phone, the way Vic
 * tested it. No DEV bridge needed: runs on a dev server, a preview or prod.
 *
 * Pins:
 *   1. the show flat opens with the catalog strip folded to its category
 *      row, and a category tap unfolds it;
 *   2. a tap on a thumbnail leaves the popup OPEN, and "+ Add to room"
 *      places the product (it used to flash shut on the tap's own click);
 *   3. arming Wall paint: the Products / Clear-all row, the cart pill and the
 *      "?" launcher step out, the HUD carries a colour row, a chip sets the
 *      tint, and Done brings the band back;
 *   4. the 3D view opens full-screen with 40 px controls and no launcher
 *      floating over it.
 */
import { test, expect, type Page } from '@playwright/test';

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

async function openDemo(page: Page): Promise<void> {
  await page.goto('/designer?demo=sofap');
  await page.waitForSelector('.konvajs-content canvas', { state: 'attached', timeout: 30_000 });
  await page.waitForTimeout(800);
}

async function placedCount(page: Page): Promise<number> {
  return page.evaluate(() => {
    const raw = localStorage.getItem('ppw_property_v2');
    if (!raw) return -1;
    const p = JSON.parse(raw).state.property;
    return p.rooms.reduce((n: number, r: { placedItems: unknown[] }) => n + r.placedItems.length, 0);
  });
}

test('the show flat opens with the strip folded; a category tap unfolds it', async ({ page }) => {
  await openDemo(page);
  await expect(page.locator('[data-testid="sims-bottom-toolbar"]')).toBeVisible();
  await expect(page.locator('[data-testid="sims-thumb-strip"]')).toHaveCount(0);
  await expect(page.locator('[data-testid="sims-toolbar-minimize"]')).toHaveAttribute('aria-expanded', 'false');
  await page.locator('[data-testid="sims-cat-cardio"]').tap();
  await expect(page.locator('[data-testid="sims-thumb-strip"]')).toBeVisible();
});

test('a thumbnail tap keeps the popup open and "+ Add to room" places the product', async ({ page }) => {
  await openDemo(page);
  const before = await placedCount(page);
  await page.locator('[data-testid="sims-cat-cardio"]').tap();
  await page.locator('[data-testid="sims-thumb"]:visible').first().tap();
  const popup = page.locator('[data-testid="mobile-product-popup"]');
  await expect(popup).toBeVisible();
  // Still there after the compatibility click would have landed.
  await page.waitForTimeout(400);
  await expect(popup).toBeVisible();
  await page.locator('[data-testid="popup-add-to-room"]').tap();
  await expect(popup).toHaveCount(0);
  await expect.poll(() => placedCount(page)).toBe(before + 1);
});

test('Wall paint on the phone: the band steps out, the HUD carries colours, Done brings it back', async ({ page }) => {
  await openDemo(page);
  await expect(page.locator('[data-testid="cart-pill"]')).toBeVisible();
  await expect(page.locator('[data-testid="clear-controls"]')).toBeVisible();
  await page.getByRole('button', { name: 'Open menu' }).tap();
  await page.locator('[data-testid="wallpaint-mobile-permoglaze-soft-feel"]').tap();
  const hud = page.locator('[data-testid="wallpaint-hud"]');
  await expect(hud).toBeVisible();
  await expect(page.locator('[data-testid="cart-pill"]')).toHaveCount(0);
  await expect(page.locator('[data-testid="clear-controls"]')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Open keyboard shortcuts help' })).toHaveCount(0);
  // The strip folded to its category row under the card.
  await expect(page.locator('[data-testid="sims-thumb-strip"]')).toHaveCount(0);
  // Colours on the plan: a chip sets the tint, the HUD names it.
  const strip = page.locator('[data-testid="wallpaint-hud-colours"]');
  await expect(strip).toBeVisible();
  await page.locator('[data-testid="wallpaint-hud-colour-sofap-alc-morning-haze"]').tap();
  await expect(page.locator('[data-testid="wallpaint-hud-colour"]')).toHaveText('Morning Haze');
  // The HUD sits flush on the folded strip — nothing between them.
  const hudBox = (await hud.boundingBox())!;
  const barBox = (await page.locator('[data-testid="sims-bottom-toolbar"]').boundingBox())!;
  expect(barBox.y - (hudBox.y + hudBox.height)).toBeLessThan(24);
  await page.locator('[data-testid="wallpaint-done-mobile"]').tap();
  await expect(hud).toHaveCount(0);
  await expect(page.locator('[data-testid="cart-pill"]')).toBeVisible();
  await expect(page.locator('[data-testid="clear-controls"]')).toBeVisible();
});

test('the 3D view is full-screen with 40 px controls and no launcher over it', async ({ page }) => {
  await openDemo(page);
  await page.getByRole('button', { name: 'Open menu' }).tap();
  await page.locator('[data-testid="wallpaint-mobile-permoglaze-soft-feel"]').tap();
  await page.locator('[data-testid="wallpaint-3d-mobile"]').tap();
  const overlay = page.locator('[data-testid="wallpaint-3d-overlay"]');
  await expect(overlay).toBeVisible();
  const box = (await overlay.boundingBox())!;
  expect(box.width).toBe(390);
  expect(box.height).toBe(844);
  await expect(page.getByRole('button', { name: 'Open keyboard shortcuts help' })).toHaveCount(0);
  for (const id of ['wallpaint-3d-rotate-left', 'wallpaint-3d-fit', 'wallpaint-3d-close']) {
    const b = (await page.locator(`[data-testid="${id}"]`).first().boundingBox())!;
    expect(b.height, id).toBeGreaterThanOrEqual(40);
  }
  const swatch = (await page.locator('[data-testid="wallpaint-3d-colour-base"]').boundingBox())!;
  expect(swatch.width).toBeGreaterThanOrEqual(40);
  await page.locator('[data-testid="wallpaint-3d-close"]').tap();
  await expect(overlay).toHaveCount(0);
  await expect(page.locator('[data-testid="wallpaint-hud"]')).toBeVisible();
});
