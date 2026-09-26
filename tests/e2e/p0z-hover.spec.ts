import { test, expect } from '@playwright/test';
import { openCatalog } from './catalog-helpers';

test('P0-ζ — pointer enter catalog card shows floating DetailCard', async ({ page }) => {
  await page.addInitScript(() => {
    try { localStorage.setItem('ppw_designer_coach_v1', '1'); localStorage.removeItem('ppw_walls_v1'); } catch { /* private mode */ }
  });
  await page.goto('/designer?fresh=1');
  await page.waitForSelector('[data-testid="items-placed"]', { timeout: 15_000 });

  await openCatalog(page);
  const card = page.locator('[data-product-id]').first();
  await expect(card).toBeVisible();
  // The catalogue opened under the pointer that pressed its launcher (the
  // dock now starts collapsed, 2026-09-26), so a tile may already be hovered.
  // Rest the pointer on the plan first: no hover card before pointer enter.
  await page.mouse.move(640, 300);
  await expect(page.locator('[data-testid="product-hover-card"]')).toHaveCount(0);

  await card.hover();
  // DetailCard renders a position:fixed <article role="dialog"> inside the
  // wrapper. The wrapper has 0-size so we target the dialog directly.
  const dialog = page.locator('[data-testid="product-hover-card"] article[role="dialog"]');
  await expect(dialog).toBeVisible({ timeout: 5_000 });
  // The card prints the product's own catalogue price the way the tile does
  // ("150,000 MUR" via catalogPrice, 2026-09-26) — a rupee figure either way.
  await expect(dialog).toContainText(/Rs\s?[\d,]+|[\d,]+ MUR/);
  await expect(dialog).toContainText(/cm/);
  await expect(dialog).toContainText(/K1-Sport|Merchant/);
  await expect(dialog.getByRole('button', { name: /place on floor/i })).toBeVisible();
});
