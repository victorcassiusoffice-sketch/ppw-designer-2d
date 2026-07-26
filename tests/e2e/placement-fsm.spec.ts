/**
 * M1 / M1.5 — pointer-FSM placement acceptance test (Gaming Dept
 * enrichment 2026-05-19, ppw-gaming-object-placement-and-rotate.md).
 *
 * Uses real CDP mouse events (`page.mouse.*`) rather than synthetic
 * React DragEvent, because DragEvent silently no-ops on `.konva-stage`
 * and that exact failure mode masked the bug through DT-11..18 audits.
 *
 * Default `BASE_URL` in `playwright.config.ts` points at production
 * (`designer.ppwellness.co`). Until M1.5 is live there, run this spec
 * against a local dev server:
 *
 *   PPW_E2E_BASE_URL=http://localhost:5173 npx playwright test placement-fsm
 *
 * Or against a Vercel preview deploy:
 *
 *   PPW_E2E_BASE_URL=https://ppw-designer-2d-<sha>.vercel.app \
 *   VERCEL_PROTECTION_BYPASS=<token> npx playwright test placement-fsm
 */

import { test, expect } from '@playwright/test';

test.describe('M1.5 pointer-FSM placement', () => {
  test('click catalog card to arm, click floor to commit → items-placed = 1', async ({ page }) => {
    await page.goto('/designer?fresh=1');

    const itemsPlaced = page.locator('[data-testid="items-placed"]');
    await expect(itemsPlaced).toBeVisible({ timeout: 10_000 });
    const before = (await itemsPlaced.textContent())?.trim() ?? '';

    // Open the catalog (mobile sheet on narrow viewports, no-op on desktop).
    const catalogToggle = page.getByRole('button', { name: /catalog/i }).first();
    if (await catalogToggle.isVisible().catch(() => false)) {
      await catalogToggle.click().catch(() => undefined);
    }

    // Pick the first available product card. The catalog adapter merges
    // bundled seeds with /api/products rows so the IDs vary by env; use
    // the data attribute the FSM already exposes.
    const card = page.locator('[data-product-id]').first();
    await expect(card).toBeVisible();

    const stage = page.locator('.konva-stage').first();
    await expect(stage).toBeVisible();
    const stageBox = await stage.boundingBox();
    if (!stageBox) throw new Error('Stage has no layout box');

    // Arm: click the card → sets pendingProductId on pointerdown.
    await card.click();

    // The Stage container should reflect the armed state.
    const armed = page.locator('[data-armed="true"]');
    await expect(armed).toHaveCount(2); // catalog card + canvas container

    // Move the cursor into the canvas — ghost preview should follow.
    const centerX = stageBox.x + stageBox.width / 2;
    const centerY = stageBox.y + stageBox.height / 2;
    await page.mouse.move(centerX, centerY, { steps: 12 });

    // Commit: click on the floor.
    await page.mouse.click(centerX, centerY);

    // The items-placed pill should have incremented by 1.
    await expect(itemsPlaced).not.toHaveText(before);
    const after = (await itemsPlaced.textContent())?.trim() ?? '';
    expect(Number(after)).toBeGreaterThan(Number(before || '0'));

    // The canvas should no longer be armed after the commit.
    await expect(page.locator('[data-armed="true"]')).toHaveCount(0);
  });

  test('Escape during armed phase cancels without committing', async ({ page }) => {
    await page.goto('/designer?fresh=1');
    const itemsPlaced = page.locator('[data-testid="items-placed"]');
    const before = (await itemsPlaced.textContent())?.trim() ?? '';

    const card = page.locator('[data-product-id]').first();
    await card.click();

    await page.keyboard.press('Escape');

    // No commit should have happened.
    const after = (await itemsPlaced.textContent())?.trim() ?? '';
    expect(after).toBe(before);
    await expect(page.locator('[data-armed="true"]')).toHaveCount(0);
  });
});
