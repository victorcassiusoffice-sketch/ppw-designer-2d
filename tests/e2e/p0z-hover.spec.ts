import { test, expect } from '@playwright/test';

test('P0-ζ — pointer enter catalog card shows floating DetailCard', async ({ page }) => {
  await page.addInitScript(() => {
    try { localStorage.setItem('ppw_designer_coach_v1', '1'); localStorage.removeItem('ppw_walls_v1'); } catch {}
  });
  await page.goto('/?fresh=1');
  await page.waitForSelector('[data-testid="items-placed"]', { timeout: 15_000 });

  const card = page.locator('[data-product-id]').first();
  await expect(card).toBeVisible();
  // No hover card before pointer enter
  await expect(page.locator('[data-testid="product-hover-card"]')).toHaveCount(0);

  await card.hover();
  // DetailCard renders a position:fixed <article role="dialog"> inside the
  // wrapper. The wrapper has 0-size so we target the dialog directly.
  const dialog = page.locator('[data-testid="product-hover-card"] article[role="dialog"]');
  await expect(dialog).toBeVisible({ timeout: 5_000 });
  await expect(dialog).toContainText(/Rs/);
  await expect(dialog).toContainText(/cm/);
  await expect(dialog).toContainText(/K1-Sport|Merchant/);
  await expect(dialog.getByRole('button', { name: /place on floor/i })).toBeVisible();
});
