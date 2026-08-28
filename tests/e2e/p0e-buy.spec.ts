import { test, expect } from '@playwright/test';

test('P0-ε — BUY button visible for K1 product + /api/k1/redirect 302 with attribution', async ({ page }) => {
  await page.addInitScript(() => {
    try { localStorage.setItem('ppw_designer_coach_v1', '1'); localStorage.removeItem('ppw_walls_v1'); } catch { /* private mode */ }
  });
  await page.goto('/designer');
  // A fresh canvas holds ONE room with an EMPTY polygon (makeBlankRoom), so
  // findRoomAt returns null and every drop is rejected as "outside the plan".
  // Give it the explicit quick 5 x 4 m rectangle - the same precondition
  // placement-fsm and wall-aware-placement use. (The old `?fresh=1` was never
  // read by the app.)
  await page.locator('[data-testid="start-quick-rectangle"]').click();
  await page.waitForSelector('[data-testid="items-placed"]', { timeout: 15_000 });

  await page.locator('[data-product-id]').first().click();
  const stage = page.locator('.konva-stage').first();
  const box = await stage.boundingBox();
  if (!box) throw new Error('no stage');
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 6 });
  await page.mouse.down();
  await page.mouse.up();
  await expect(page.locator('[data-testid="items-placed"]')).toHaveText('1', { timeout: 10_000 });
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForTimeout(300);

  // DetailsPanel renders twice (desktop + mobile-modal). Assert *some* copy is visible.
  const buy = page.locator('a[data-testid="buy-from-k1-sport"]:visible').first();
  await expect(buy).toBeVisible({ timeout: 5_000 });
  const href = await buy.getAttribute('href');
  expect(href).toContain('/api/k1/redirect');
  expect(href).toContain('slug=k1-sport');
  expect(href).toMatch(/productSku=K1-/);
  expect(href).toMatch(/designId=s-/);

  // Probe the redirect endpoint returns a 302 to k1-sport.com with ref code.
  const url = new URL(href!, 'https://designer.ppwellness.co').toString();
  const res = await page.request.get(url, { maxRedirects: 0 });
  expect(res.status()).toBeGreaterThanOrEqual(300);
  expect(res.status()).toBeLessThan(400);
  expect(res.headers().location).toContain('k1-sport.com');
  expect(res.headers().location).toContain('ref=');
});
