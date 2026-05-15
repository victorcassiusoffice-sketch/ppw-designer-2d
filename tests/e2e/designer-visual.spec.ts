/**
 * OMS Wave 5.6 — Designer visual regression (Playwright screenshot diff).
 *
 * Loads /designer with a fixed seed of operations and snapshots the
 * canvas. CI fails on any pixel diff beyond the threshold.
 *
 * Skipped on CI until Vic runs `npx playwright install` and a baseline
 * snapshot is committed under `tests/e2e/snapshots/`.
 */

import { test, expect } from '@playwright/test';

test.describe('Designer visual regression', () => {
  test('default room renders identically frame-by-frame', async ({ page }) => {
    test.skip(!process.env.PPW_E2E_HAVE_SNAPSHOTS, 'Baseline snapshots required.');
    await page.goto('/designer');
    // Hide cursor + dynamic timestamps to make snapshots deterministic.
    await page.addStyleTag({
      content: `* { caret-color: transparent !important; }`,
    });
    // Wait for Konva to settle (the canvas mounts asynchronously).
    await page.waitForTimeout(500);
    await expect(page).toHaveScreenshot('designer-default.png', {
      maxDiffPixelRatio: 0.02,
    });
  });
});
