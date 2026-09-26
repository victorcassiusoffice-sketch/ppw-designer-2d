/**
 * Phone pass (2026-09-16) — the Sofap demo on a 390 px phone, the way Vic
 * tested it. No DEV bridge needed: runs on a dev server, a preview or prod.
 *
 * Pins:
 *   1. the show flat opens with the catalog strip folded behind the Furnish
 *      launcher (2026-09-26: collapsed at every width), and opening it then
 *      tapping a category shows the strip;
 *   2. a tap on a thumbnail leaves the popup OPEN, and "+ Add to room"
 *      places the product (it used to flash shut on the tap's own click);
 *   3. arming Wall paint: the Products / Clear-all row, the cart pill and the
 *      "?" launcher step out, the HUD carries a colour row, a chip sets the
 *      tint, and Done brings the band back;
 *   4. the 3D view opens full-screen as the House Studio (its own header
 *      replaces the strip, the plan chrome is inert underneath) with the
 *      paint swatches at 40 px and no launcher floating over it.
 *
 * Every demo opens in 3D since 2026-09-26; these are PLAN journeys, so the
 * show flat is opened with `view=2d` (the supported way to ask for the plan).
 */
import { test, expect, type Page } from '@playwright/test';
import { openCatalog } from './catalog-helpers';

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

async function openDemo(page: Page): Promise<void> {
  await page.goto('/designer?demo=sofap&view=2d');
  await page.waitForSelector('.konvajs-content canvas', { state: 'attached', timeout: 30_000 });
  await page.waitForTimeout(800);
  await expect(page.locator('[data-testid="wallpaint-3d-overlay"]')).toHaveCount(0);
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
  // Collapsed: the Furnish launcher is the only catalogue control on the bar;
  // the strip's close button is not rendered until the strip is open.
  const launcher = page.locator('[data-testid="sims-catalog-open"]');
  await expect(launcher).toBeVisible();
  await expect(launcher).toHaveAttribute('aria-expanded', 'false');
  await expect(page.locator('[data-testid="sims-toolbar-minimize"]')).toHaveCount(0);
  await openCatalog(page);
  await expect(page.locator('[data-testid="sims-toolbar-minimize"]')).toHaveAttribute('aria-expanded', 'true');
  await page.locator('[data-testid="sims-cat-cardio"]').tap();
  await expect(page.locator('[data-testid="sims-thumb-strip"]')).toBeVisible();
});

test('a thumbnail tap keeps the popup open and "+ Add to room" places the product', async ({ page }) => {
  await openDemo(page);
  const before = await placedCount(page);
  await openCatalog(page, 'cardio');
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

test('the 3D view is full-screen with tappable controls and no launcher over it', async ({ page }) => {
  await openDemo(page);
  await page.getByRole('button', { name: 'Open menu' }).tap();
  await page.locator('[data-testid="wallpaint-mobile-permoglaze-soft-feel"]').tap();
  await page.locator('[data-testid="wallpaint-3d-mobile"]').tap();
  const overlay = page.locator('[data-testid="wallpaint-3d-overlay"]');
  await expect(overlay).toBeVisible();
  const box = (await overlay.boundingBox())!;
  expect(box.width).toBe(390);
  // House Studio (2026-09-26): the room owns the whole screen — its header
  // replaces the plan strip (inert underneath) and it runs to the bottom.
  expect(box.y).toBe(0);
  expect(box.y + box.height).toBe(844);
  await expect(overlay.getByRole('button', { name: '3D House' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: 'Open keyboard shortcuts help' })).toHaveCount(0);
  // The mode rail and the header switch are the primary controls: full touch targets.
  const rail = overlay.locator('[data-testid="house-mode-paint"]');
  await expect(rail).toHaveAttribute('aria-pressed', 'true');
  expect((await rail.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  const planSwitch = overlay.getByRole('button', { name: '2D Plan' });
  await expect(planSwitch).toBeVisible();
  // The camera dock's buttons are the shell's 34 px phone row (houseWorkspace.css @ 767 px).
  for (const id of ['wallpaint-3d-rotate-left', 'wallpaint-3d-fit']) {
    const b = (await overlay.locator(`[data-testid="${id}"]`).first().boundingBox())!;
    expect(b.height, id).toBeGreaterThanOrEqual(34);
  }
  // The paint swatches on the brush strip keep their 40 px.
  const swatch = (await page.locator('[data-testid="wallpaint-3d-colour-base"]').boundingBox())!;
  expect(swatch.width).toBeGreaterThanOrEqual(40);
  expect(swatch.height).toBeGreaterThanOrEqual(40);
  await planSwitch.tap();
  await expect(overlay).toHaveCount(0);
  // Back on the plan. In the House Studio a finish tool is dismissed by any
  // press on workspace chrome outside its panel / the scene / its brush strip
  // (TopBar's chrome-dismissal rule), and the header switch is chrome — so
  // the plan returns with the paint tool stood down and its HUD folded.
  await expect(page.locator('[data-testid="sims-bottom-toolbar"]')).toBeVisible();
  await expect(page.locator('[data-testid="wallpaint-hud"]')).toHaveCount(0);
  await expect(page.locator('[data-testid="cart-pill"]')).toBeVisible();
});
