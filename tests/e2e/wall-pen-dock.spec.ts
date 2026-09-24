import { test, expect } from '@playwright/test';
import { oneRoomFixture, seedSimsProperty } from './sims-world-helpers';

test.use({ viewport: { width: 1366, height: 800 } });

test('desktop wall pen reserves a compact row and gives its space back when closed', async ({ page }) => {
  await seedSimsProperty(page, oneRoomFixture());
  await page.goto('/designer');
  await page.getByRole('button', { name: '2D Plan', exact: true }).click();
  const viewport = page.getByTestId('plan-drawing-viewport');
  await expect(viewport).toBeVisible();
  const before = await viewport.boundingBox();
  await page.getByTestId('room-draw-toggle').click();
  const dock = page.getByTestId('room-draw-hud');
  await expect(dock).toBeVisible();
  const controls = await dock.boundingBox();
  const drawing = await viewport.boundingBox();
  expect(controls!.height).toBeLessThanOrEqual(100);
  expect(controls!.width).toBeGreaterThan(1000);
  expect(drawing!.y).toBeGreaterThanOrEqual(controls!.y + controls!.height - 1);
  expect(drawing!.height).toBeGreaterThan(350);
  expect(await viewport.evaluate((node) => node.contains(document.querySelector('[data-testid="room-draw-hud"]')))).toBe(false);
  await expect(page.getByTestId('snap-unit-stepper')).toBeVisible();
  await expect(page.getByTestId('draw-segment-length')).toBeVisible();
  await page.getByTestId('room-draw-cancel').click();
  await expect(dock).toHaveCount(0);
  const after = await viewport.boundingBox();
  expect(after!.y).toBeCloseTo(before!.y, 0);
  expect(after!.height).toBeCloseTo(before!.height, 0);
});
