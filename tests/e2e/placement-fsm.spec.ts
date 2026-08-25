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

import { test, expect, type Page } from '@playwright/test';

/**
 * 2026-08-25 REPAIR — this spec was red on `main` for two reasons that
 * have nothing to do with what it is testing. Both are fixed in SETUP
 * only; every assertion in the tests below is untouched.
 *
 *  1. It never seeded `ppw_designer_coach_v1`, so the first-visit coach
 *     dialog intercepted the very first `card.click()`
 *     ("<div role=dialog aria-labelledby=ppw-coach-title> intercepts
 *     pointer events"). Every other spec in this suite already seeds it.
 *
 *  2. It assumed a room was already on the canvas. Since the
 *     blank-canvas-on-open change (2026-06-09) a fresh context opens with
 *     an EMPTY polygon, so `validatePlacement` correctly refuses every
 *     drop and `items-placed` can never increment. The `?fresh=1` query
 *     param it passed is not read anywhere in the app — it did nothing.
 *
 * Verified pre-existing: `git checkout main && npx playwright test
 * placement-fsm` fails the same 2/2 with the same coach-dialog
 * interception.
 *
 * Fresh designer with the coach dialog pre-dismissed and a 5 x 4 m room
 * on the canvas — the preconditions this spec's assertions assume.
 */
async function openDesignerWithRoom(page: Page): Promise<void> {
  await page.addInitScript(() => {
    localStorage.clear();
    localStorage.setItem('ppw_designer_coach_v1', '1');
  });
  await page.goto('/designer');
  await page.locator('[data-testid="start-quick-rectangle"]').click();
  await expect(page.locator('[data-testid="items-placed"]')).toHaveText('0');
}

test.describe('M1.5 pointer-FSM placement', () => {
  test('click catalog card to arm, click floor to commit → items-placed = 1', async ({ page }) => {
    await openDesignerWithRoom(page);

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
    await openDesignerWithRoom(page);
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
