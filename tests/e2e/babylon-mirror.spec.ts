/**
 * M3 — 3D Babylon scene mirrors 2D placedItems + walls (Gaming Dept
 * skill `ppw-gaming-3d-mirror.md`).
 *
 * Replaces the DT-22 demo behaviour where Babylon rendered 3 hardcoded
 * boxes regardless of placement state. After M3 the Babylon scene is a
 * *camera mode* over the same state Konva reads — no parallel scene
 * file, no hardcoded item names.
 *
 * Default BASE_URL is prod; run against a local dev server until M3 is
 * deployed:
 *
 *   PPW_E2E_BASE_URL=http://localhost:5173 npx playwright test babylon-mirror
 *
 * The spec uses URL navigation (`?engine=babylon` / `?engine=konva`)
 * because the EngineToggle pill hard-refreshes on flip — that's the
 * production toggle UX, no `data-mode-toggle` attribute yet.
 */

import { test, expect } from '@playwright/test';

interface BabylonProbe {
  itemMeshes: number;
  wallMeshes: number;
  productMeshNames: string[];
}

declare global {
  interface Window {
    __ppwBabylonScene?: { meshes: Array<{ name: string }> };
  }
}

async function probeBabylon(page: import('@playwright/test').Page): Promise<BabylonProbe> {
  return page.evaluate<BabylonProbe>(() => {
    const scene = window.__ppwBabylonScene;
    if (!scene) return { itemMeshes: 0, wallMeshes: 0, productMeshNames: [] };
    const meshes = scene.meshes ?? [];
    const items = meshes.filter((m) => m.name.startsWith('product-'));
    const walls = meshes.filter((m) => m.name.startsWith('wall-seg-'));
    return {
      itemMeshes: items.length,
      wallMeshes: walls.length,
      productMeshNames: items.map((m) => m.name),
    };
  });
}

test.describe('M3 Babylon ↔ Konva mirror', () => {
  test('empty room: Babylon renders zero product meshes', async ({ page }) => {
    await page.goto('/?fresh=1&engine=babylon');
    await page.waitForFunction(() => Boolean(window.__ppwBabylonScene), null, { timeout: 15_000 });
    const probe = await probeBabylon(page);
    expect(probe.itemMeshes).toBe(0);
    expect(probe.productMeshNames).toEqual([]);
  });

  test('place 1 item in 2D, switch to Babylon → exactly 1 product mesh', async ({ page }) => {
    // Reset state first.
    await page.goto('/?fresh=1');
    await page.evaluate(() => {
      try {
        localStorage.removeItem('ppw_walls_v1');
      } catch { /* ignore */ }
    });
    await page.reload();

    // 2D placement via the M1.5 pointer-FSM.
    const card = page.locator('[data-product-id]').first();
    await expect(card).toBeVisible();
    await card.click();
    const stage = page.locator('.konva-stage').first();
    const box = await stage.boundingBox();
    if (!box) throw new Error('Stage missing layout box');
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 8 });
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await expect(page.locator('[data-testid="items-placed"]')).toHaveText('1');

    // Switch to Babylon. EngineToggle hard-refreshes, so URL is the
    // production-equivalent path.
    await page.goto('/?engine=babylon');
    await page.waitForFunction(() => Boolean(window.__ppwBabylonScene), null, { timeout: 15_000 });
    const probe = await probeBabylon(page);
    expect(probe.itemMeshes).toBe(1);
  });

  test('draw 4 walls in 2D, switch to Babylon → 4 wall slabs', async ({ page }) => {
    await page.goto('/?fresh=1');
    await page.evaluate(() => {
      try {
        localStorage.removeItem('ppw_walls_v1');
      } catch { /* ignore */ }
    });
    await page.reload();

    await page.getByRole('button', { name: /^Wall$/ }).click();
    const stage = page.locator('.konva-stage').first();
    const box = await stage.boundingBox();
    if (!box) throw new Error('Stage missing layout box');
    const drop = (xFrac: number, yFrac: number) =>
      stage.click({ position: { x: box.width * xFrac, y: box.height * yFrac } });
    await drop(0.30, 0.30);
    await drop(0.70, 0.30);
    await drop(0.70, 0.65);
    await drop(0.30, 0.65);
    await drop(0.30, 0.30);
    await expect(page.locator('[data-testid="wall-count"]')).toHaveText('4');

    await page.goto('/?engine=babylon');
    await page.waitForFunction(() => Boolean(window.__ppwBabylonScene), null, { timeout: 15_000 });
    const probe = await probeBabylon(page);
    expect(probe.wallMeshes).toBe(4);
  });
});
