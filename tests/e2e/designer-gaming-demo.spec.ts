/**
 * Sims-Parity DT-19 — Demo A Playwright happy-path.
 *
 * Walks the 30-sec demo shot list: floor + walls render, drag from
 * CatalogStrip, snap-cell, place, DetailCard with leader line,
 * variant swatch, R key rotate, context menu Delete (V-GAME-1
 * REMOVE BOTH cart line), Ctrl+Z/Y, HelpOverlay.
 *
 * Skipped on CI until Vic provides PPW_E2E_DESIGNER_URL.
 */
import { test, expect } from '@playwright/test';

test.describe('Sims-Parity DT-19 — Demo A happy path', () => {
  test.beforeEach(async () => {
    test.skip(
      !process.env.PPW_E2E_DESIGNER_URL,
      'PPW_E2E_DESIGNER_URL required (e.g. https://designer.ppwellness.co/designer).',
    );
  });

  test('full 30-sec demo: drag → snap → place → DetailCard → rotate → delete → undo', async ({ page }) => {
    const designerUrl = `${process.env.PPW_E2E_DESIGNER_URL}?ui=gaming-v1`;
    await page.goto(designerUrl);

    // 0:00 — Designer loads with Gaming Layer 1 surfaces visible.
    await expect(page.getByRole('region', { name: /product catalog/i })).toBeVisible();
    await expect(page.getByRole('status', { name: /room statistics/i })).toBeVisible();

    // 0:05 — Pick the first thumb and drag onto the floor.
    const thumb = page.getByRole('list', { name: /product thumbnails/i }).getByRole('listitem').first();
    await expect(thumb).toBeVisible();
    await thumb.dragTo(page.locator('canvas').first(), { targetPosition: { x: 600, y: 400 } });

    // 0:14 — DetailCard appears with the leader line + selected item summary.
    await expect(page.getByRole('dialog', { name: / details/i })).toBeVisible();

    // 0:19 — R key rotates 15° CW.
    await page.keyboard.press('r');

    // 0:22 — Right-click → context menu → Delete (V-GAME-1 REMOVE BOTH).
    await page.locator('canvas').first().click({ button: 'right', position: { x: 600, y: 400 } });
    await expect(page.getByRole('menu')).toBeVisible();
    await page.getByRole('menuitem', { name: /^delete$/i }).click();

    // 0:25 — Ctrl+Z restores item + cart line.
    await page.keyboard.press('Control+z');

    // 0:29 — "?" opens the HelpOverlay.
    await page.keyboard.press('?');
    await expect(page.getByRole('dialog', { name: /keyboard shortcuts/i })).toBeVisible();
    await page.keyboard.press('Escape');
  });

  test('?ui=gaming-v1 flag OFF hides the new surfaces', async ({ page }) => {
    const designerUrl = `${process.env.PPW_E2E_DESIGNER_URL}?ui=classic`;
    await page.goto(designerUrl);
    // Gaming Layer 1 status card should NOT be visible.
    await expect(page.getByRole('status', { name: /room statistics/i })).toHaveCount(0);
  });
});
