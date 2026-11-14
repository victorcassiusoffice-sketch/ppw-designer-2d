import { test, expect } from '@playwright/test';
import { openCatalog } from './catalog-helpers';

test('Product details open in the shelf on request', async ({ page }) => {
  await page.addInitScript(() => {
    try { localStorage.setItem('ppw_designer_coach_v1', '1'); localStorage.removeItem('ppw_walls_v1'); } catch { /* private mode */ }
  });
  await page.goto('/designer?fresh=1');
  await page.waitForSelector('[data-testid="items-placed"]', { timeout: 15_000 });

  await openCatalog(page);
  const card = page.locator('[data-product-id]').first();
  await expect(card).toBeVisible();
  await card.hover();
  await expect(page.getByTestId('mobile-product-popup')).toHaveCount(0);
  await card.locator('..').getByRole('button', { name: /^Details for/ }).click();
  const details = page.getByTestId('sims-dock').getByTestId('mobile-product-popup');
  await expect(details).toContainText(/cm/);
  await expect(details).toContainText(/Supplier/);
  await expect(details.getByRole('button', { name: /choose position|lay this floor/i })).toBeVisible();
});
