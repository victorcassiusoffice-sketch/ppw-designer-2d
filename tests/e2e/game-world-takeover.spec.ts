import { expect, test } from '@playwright/test';
import { openCatalog } from './catalog-helpers';

for (const [width, height] of [[313, 567], [390, 844]]) {
  test(`carrying a product keeps the plan and Cancel reachable at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.goto('/demo?view=2d&pitch=1');
    const viewport = page.getByTestId('plan-drawing-viewport');
    await expect(viewport.locator('canvas').first()).toBeVisible();
    await openCatalog(page);
    const product = page.locator('[data-testid="sims-thumb"][aria-label*="choose position"]:visible, [data-testid="dock-strip"] [aria-label^="Place "]:visible').first();
    await product.click();
    const controls = page.locator('.object-placement-controls:visible');
    await expect(controls).toBeVisible();
    const position = await controls.boundingBox();
    const drawing = await viewport.boundingBox();
    expect(position!.y).toBeGreaterThanOrEqual(drawing!.y + drawing!.height - 1);
    expect(position!.height).toBeLessThanOrEqual(60);
    await controls.getByRole('button', { name: 'Settings' }).click();
    await controls.getByRole('button', { name: '25 cm' }).click();
    await expect(controls.getByRole('button', { name: '25 cm' })).toHaveAttribute('aria-pressed', 'true');
    await controls.getByRole('button', { name: 'Cancel' }).click();
    await expect(controls).toBeHidden();
  });
}

test('City redo restores the same placed asset after undo', async ({ page }) => {
  await page.setViewportSize({ width: 313, height: 567 });
  await page.goto('/demo?view=2d&pitch=1&panel=city');
  const city = page.getByTestId('city-workspace');
  const map = city.getByTestId('city-plan');
  await expect(map).toBeVisible();
  await city.locator('.city-tool-asset').click();
  const before = await map.locator('[data-city-id]').evaluateAll(elements => elements.map(el => el.getAttribute('data-city-id')));
  await map.click();
  const marks = map.locator('[data-city-id]');
  await expect(marks).toHaveCount(before.length + 1);
  const newId = await marks.evaluateAll((elements, previous) => elements.map(el => el.getAttribute('data-city-id')).find(id => !previous.includes(id)), before);
  expect(newId).toBeTruthy();
  await city.locator('.city-tool-undo').click();
  await expect(marks).toHaveCount(before.length);
  const redo = city.locator('.city-tool-redo');
  const size = await redo.boundingBox();
  expect(size!.width).toBeGreaterThanOrEqual(48);
  expect(size!.height).toBeGreaterThanOrEqual(48);
  await redo.click();
  await expect(map.locator(`[data-city-id="${newId}"]`)).toBeVisible();
});
