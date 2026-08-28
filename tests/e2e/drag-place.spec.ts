/**
 * Sims drag-drop — desktop acceptance (Vic 2026-08-28).
 *
 * "drag and drop of products and useability similar to 'The Sims' game is
 * not there." It is now: press a dock tile, drag onto the plan, release.
 *
 * The mechanism is Pointer Events, not HTML5 drag-and-drop. HTML5 DnD was
 * removed from this repo deliberately — `RoomCanvas.tsx` records that the K1
 * audit proved it silently no-ops against the Konva stage — and its absence
 * is pinned by `customer-ui-fixes-2026-05-31.test.ts`. Playwright also cannot
 * drive it against Konva, per `placement-fsm.spec.ts`'s own header.
 *
 * Run against a local dev server:
 *   PPW_E2E_BASE_URL=http://localhost:5187 npx playwright test drag-place
 */

import { test, expect, type Page } from '@playwright/test';

/** blueprintTheme GHOST_VALID_FILL / GHOST_INVALID_FILL, verbatim. */
const GHOST_VALID = { r: 232, g: 163, b: 61 };
const GHOST_INVALID = { r: 224, g: 82, b: 82 };

async function openDesigner(page: Page): Promise<void> {
  await page.addInitScript(() => {
    try {
      localStorage.clear();
      localStorage.setItem('ppw_designer_coach_v1', '1');
    } catch {
      /* private mode */
    }
  });
  await page.goto('/designer');
  await page.locator('[data-testid="start-quick-rectangle"]').click();
  await page.waitForSelector('[data-testid="items-placed"]', { timeout: 15_000 });
}

async function placedCount(page: Page): Promise<number> {
  return page.evaluate(() => {
    try {
      const raw = localStorage.getItem('ppw_property_v2');
      if (!raw) return -1;
      const p = JSON.parse(raw).state.property;
      return p.rooms.reduce(
        (n: number, r: { placedItems: unknown[] }) => n + r.placedItems.length,
        0,
      );
    } catch {
      return -1;
    }
  });
}

/**
 * Count pixels of a ghost colour on the LAST Konva canvas, and their bounding
 * box. Counting MOUNTED paint is the only thing that proves the ghost Layer
 * actually rendered — the console breadcrumb only proves computeGhost ran,
 * and the ghost Layer has its own independent mount guard.
 */
async function ghostPaint(
  page: Page,
  colour: { r: number; g: number; b: number },
): Promise<{ count: number; minX: number; maxX: number } | null> {
  return page.evaluate((c) => {
    const canvases = Array.from(
      document.querySelectorAll('.konvajs-content canvas'),
    ) as HTMLCanvasElement[];
    if (!canvases.length) return null;
    for (let i = canvases.length - 1; i >= 0; i--) {
      const cv = canvases[i];
      const ctx = cv.getContext('2d');
      if (!ctx) continue;
      const { data, width } = ctx.getImageData(0, 0, cv.width, cv.height);
      let count = 0;
      let minX = Infinity;
      let maxX = -Infinity;
      for (let p = 0; p < data.length; p += 4) {
        if (
          Math.abs(data[p] - c.r) <= 6 &&
          Math.abs(data[p + 1] - c.g) <= 6 &&
          Math.abs(data[p + 2] - c.b) <= 6 &&
          data[p + 3] > 10
        ) {
          count++;
          const x = (p / 4) % width;
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
        }
      }
      if (count > 0) return { count, minX, maxX };
    }
    return { count: 0, minX: 0, maxX: 0 };
  }, colour);
}

test.describe('Sims drag-drop — desktop', () => {
  test.use({ viewport: { width: 1920, height: 1080 } });

  test('drag a dock tile onto the plan and it places where the ghost was', async ({ page }) => {
    const logs: string[] = [];
    page.on('console', (m) => logs.push(m.text()));

    await openDesigner(page);
    expect(await placedCount(page)).toBe(0);

    const tile = page.locator('[data-testid="dock-strip"] [data-product-id]').first();
    const tileBox = await tile.boundingBox();
    if (!tileBox) throw new Error('no dock tile');

    const stage = page.locator('.konva-stage').first();
    const stageBox = await stage.boundingBox();
    if (!stageBox) throw new Error('no stage');

    const target = { x: stageBox.x + stageBox.width / 2, y: stageBox.y + stageBox.height / 2 };

    await page.mouse.move(tileBox.x + tileBox.width / 2, tileBox.y + tileBox.height / 2);
    await page.mouse.down();
    // Several steps: the hook promotes to a drag only past its threshold.
    for (let i = 1; i <= 5; i++) {
      await page.mouse.move(
        tileBox.x + (target.x - tileBox.x) * (i / 5),
        tileBox.y + (target.y - tileBox.y) * (i / 5),
      );
    }
    await page.waitForTimeout(150);

    // Mid-drag: exactly two elements report armed, never three.
    expect(await page.locator('[data-armed="true"]').count()).toBe(2);

    // GHOST PAINT — the assertion the breadcrumb cannot make.
    const paintA = await ghostPaint(page, GHOST_VALID);
    expect(paintA).not.toBeNull();
    expect(paintA!.count).toBeGreaterThan(0);

    // ...and it FOLLOWS the pointer rather than being painted once.
    await page.mouse.move(target.x + 120, target.y);
    await page.waitForTimeout(150);
    const paintB = await ghostPaint(page, GHOST_VALID);
    expect(paintB!.count).toBeGreaterThan(0);
    expect(Math.abs(paintB!.minX - paintA!.minX)).toBeGreaterThan(20);

    await page.mouse.up();
    await page.waitForTimeout(400);

    expect(await placedCount(page)).toBe(1);
    expect(logs.some((l) => l.includes('drop-commit'))).toBe(true);
    // Vic Q2: the hand empties after a successful drop.
    expect(await page.locator('[data-armed="true"]').count()).toBe(0);
  });

  test('a drop outside every room is refused, not teleported', async ({ page }) => {
    const logs: string[] = [];
    page.on('console', (m) => logs.push(m.text()));

    await openDesigner(page);
    const before = await placedCount(page);

    const tile = page.locator('[data-testid="dock-strip"] [data-product-id]').first();
    const tileBox = (await tile.boundingBox())!;
    const stage = page.locator('.konva-stage').first();
    const stageBox = (await stage.boundingBox())!;

    // Top-left of the stage is canvas but well outside the centred room.
    const target = { x: stageBox.x + 60, y: stageBox.y + 60 };

    await page.mouse.move(tileBox.x + tileBox.width / 2, tileBox.y + tileBox.height / 2);
    await page.mouse.down();
    for (let i = 1; i <= 5; i++) {
      await page.mouse.move(
        tileBox.x + (target.x - tileBox.x) * (i / 5),
        tileBox.y + (target.y - tileBox.y) * (i / 5),
      );
    }
    await page.waitForTimeout(200);

    // The ghost says invalid, in the exact GHOST_INVALID_FILL red.
    const bad = await ghostPaint(page, GHOST_INVALID);
    expect(bad!.count).toBeGreaterThan(0);

    await page.mouse.up();
    await page.waitForTimeout(400);

    // Refused, NOT relocated to a free slot somewhere else in the room.
    expect(await placedCount(page)).toBe(before);
    expect(logs.some((l) => l.includes('drop-rejected'))).toBe(true);
  });

  test('a wobble on a tile is a click, not a drag, and the arm survives', async ({ page }) => {
    await openDesigner(page);
    const before = await placedCount(page);

    const tile = page.locator('[data-testid="dock-strip"] [data-product-id]').first();
    const box = (await tile.boundingBox())!;
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;

    await page.mouse.move(cx, cy);
    await page.mouse.down();
    // 10 px — under the desktop 14 px threshold, over the mobile 8 px one.
    await page.mouse.move(cx + 10, cy);
    await page.mouse.up();
    await page.waitForTimeout(250);

    // Nothing placed, and the product is still in hand.
    expect(await placedCount(page)).toBe(before);
    expect(await page.locator('[data-armed="true"]').count()).toBe(2);
  });
});
