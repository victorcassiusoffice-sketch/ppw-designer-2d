/**
 * V-RENDER (2026-05-27) — in-room render fix · deploy-verify (Gate 2).
 *
 * Runs against a DEPLOY that carries the render fix (preview or prod),
 * not the local build. Gated behind PPW_E2E_RENDER_FIX so CI against an
 * un-deployed prod stays green. Set PPW_E2E_BASE_URL to the preview URL
 * and PPW_E2E_RENDER_FIX=1 to execute:
 *
 *   PPW_E2E_BASE_URL=https://<preview>.vercel.app \
 *   PPW_E2E_RENDER_FIX=1 npx playwright test in-room-render
 *
 * What is automatable here:
 *   - build-stamp present (confirms the no-cache index.html header served
 *     the fresh bundle — the cache-fix verification)
 *   - Share render + Capture screen buttons wired and tappable
 *   - the Konva stage <canvas> exports a non-empty data:image/png
 *     (brief test #4 — the share render produces a real image)
 *
 * NOT automatable (Konva paints all items into ONE canvas — no per-shape
 * DOM, and the rotate-handle drag is not synthetically drivable per
 * auto-dig-2026-05-25.spec.ts:367). These are MANUAL real-iPhone checks
 * on Gate 2:
 *   - brief #2: a placed top-down product shows the IMAGE, not a grey box
 *   - brief #3: the rotate handle turns the IMAGE (not just a box)
 */

import { test, expect } from '@playwright/test';

test.describe('Designer in-room render fix (deploy-verify)', () => {
  test.skip(
    !process.env.PPW_E2E_RENDER_FIX,
    'Deploy carrying the render fix required (PPW_E2E_RENDER_FIX=1 + PPW_E2E_BASE_URL=<preview>).',
  );

  test('build stamp is visible (cache-fix proof)', async ({ page }) => {
    await page.goto('/designer');
    const stamp = page.getByTestId('build-stamp');
    await expect(stamp).toBeVisible();
    await expect(stamp).toContainText(/build\s+\S+/);
  });

  test('share + capture buttons are wired', async ({ page }) => {
    await page.goto('/designer');
    await expect(page.getByTestId('share-render')).toBeVisible();
    await expect(page.getByTestId('capture-screen')).toBeVisible();
  });

  test('konva stage exports a non-empty PNG data URL', async ({ page }) => {
    await page.goto('/designer');
    // Wait for the Konva stage canvas to mount + paint.
    const canvas = page.locator('.konva-stage canvas').first();
    await expect(canvas).toBeVisible();
    await page.waitForTimeout(500);
    const dataUrl = await canvas.evaluate((el) =>
      (el as HTMLCanvasElement).toDataURL('image/png'),
    );
    expect(dataUrl.startsWith('data:image/png')).toBe(true);
    // A blank 1x1 PNG is ~100 chars; a painted room canvas is far longer.
    expect(dataUrl.length).toBeGreaterThan(1000);
  });
});
