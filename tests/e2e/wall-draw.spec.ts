/**
 * M2 — wall-draw acceptance test (Gaming Dept skill
 * `ppw-gaming-walls.md`, protocol-03-walls.md §Acceptance).
 *
 * Default BASE_URL in `playwright.config.ts` points at production. Until
 * M2 ships there, run this spec against a local dev server:
 *
 *   PPW_E2E_BASE_URL=http://localhost:5173 npx playwright test wall-draw
 *
 * The Wall mode is engaged via the TopBar "Wall" toggle (folded in from
 * the removed ModeStrip, 2026-06-01); the WallDrawLayer wires
 * `mousemove.walldraw` / `click.walldraw` directly on the Konva Stage,
 * so synthetic React events would not exercise the production path —
 * the spec uses `stage.click({ position })` which fires CDP-driven
 * pointer + click events on the locator.
 */

import { test, expect } from '@playwright/test';

test.describe('M2 wall draw', () => {
  test('4-click closed rectangle → 4 walls + room area populated', async ({ page }) => {
    await page.goto('/?fresh=1');

    // Clear any wall sketch from a prior session.
    await page.evaluate(() => {
      try { localStorage.removeItem('ppw_walls_v1'); } catch { /* ignore */ }
    });
    await page.reload();

    // Engage Wall mode from the TopBar "Wall" toggle.
    await page.getByRole('button', { name: /^Wall$/ }).click();
    await expect(page.locator('[data-testid="wall-draw-hud"]')).toBeVisible();
    await expect(page.locator('[data-testid="wall-count"]')).toHaveText('0');

    const stage = page.locator('.konva-stage').first();
    const box = await stage.boundingBox();
    if (!box) throw new Error('Stage has no layout box');

    const drop = async (xFrac: number, yFrac: number) => {
      await stage.click({
        position: { x: box.width * xFrac, y: box.height * yFrac },
      });
    };

    // 5 clicks: anchor + 3 segment commits + close back to start.
    await drop(0.30, 0.30); // anchor
    await drop(0.70, 0.30); // → 1 segment
    await drop(0.70, 0.65); // → 2 segments
    await drop(0.30, 0.65); // → 3 segments
    await drop(0.30, 0.30); // → 4 segments (closes onto anchor, FSM idles)

    await expect(page.locator('[data-testid="wall-count"]')).toHaveText('4');
    await expect(page.locator('[data-testid="room-area"]')).toContainText(/m²/);

    // Persistence: reload and verify the sketch survives.
    await page.reload();
    await page.getByRole('button', { name: /^Wall$/ }).click();
    await expect(page.locator('[data-testid="wall-count"]')).toHaveText('4');
    await expect(page.locator('[data-testid="room-area"]')).toContainText(/m²/);
  });

  test('Wall mode → click → Esc → mode returns to Move without committing the in-flight segment', async ({ page }) => {
    await page.goto('/?fresh=1');
    await page.evaluate(() => {
      try { localStorage.removeItem('ppw_walls_v1'); } catch { /* ignore */ }
    });
    await page.reload();

    await page.getByRole('button', { name: /^Wall$/ }).click();
    const stage = page.locator('.konva-stage').first();
    const box = await stage.boundingBox();
    if (!box) throw new Error('Stage has no layout box');

    // Drop the first anchor (no commit yet — needs the second click).
    await stage.click({ position: { x: box.width * 0.4, y: box.height * 0.4 } });

    // Esc → drop back to armed (still in wall mode, anchor cleared).
    await page.keyboard.press('Escape');
    await expect(page.locator('[data-testid="wall-count"]')).toHaveText('0');

    // Esc again → exit wall mode entirely.
    await page.keyboard.press('Escape');
    await expect(page.locator('[data-testid="wall-draw-hud"]')).toHaveCount(0);
  });
});
