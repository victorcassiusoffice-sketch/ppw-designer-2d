/**
 * Sims drag-drop — desktop acceptance (Vic 2026-08-28; Sims world 2026-08-29).
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
 * Sims world (2026-08-29) changed what "outside the room" means: with no
 * land plot locked, everything outside the house is GARDEN, so an off-room
 * drop lands in the level's Outdoors container instead of being refused.
 * The refusal path ("not teleported") is still pinned below — via a drop
 * onto a spot that is already occupied.
 *
 * Run against a local dev server:
 *   PPW_E2E_BASE_URL=http://localhost:5187 npx playwright test drag-place
 */

import { test, expect, type Page } from '@playwright/test';
import { worldToScreen } from './multiroom-helpers';

/**
 * blueprintTheme GHOST_VALID_FILL rgba(121,199,173,0.35) / GHOST_INVALID_FILL
 * rgba(201,85,63,0.30) — RGB only. The ghost Layer is its own transparent
 * Konva canvas, so the fill's alpha never blends with the paper below it:
 * `getImageData` un-premultiplies and hands back the theme RGB to within a
 * couple of units (premultiply rounding at alpha 0.30–0.35), which is what
 * the tolerance in `ghostPaint` covers.
 */
const GHOST_VALID = { r: 121, g: 199, b: 173 };
const GHOST_INVALID = { r: 201, g: 85, b: 63 };
/** Per-channel slack: un-premultiply rounding (<= 3) plus AA on the dashed stroke. */
const GHOST_TOLERANCE = 6;

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

interface StoredRoom {
  kind?: 'room' | 'outdoor';
  polygon: unknown[];
  placedItems: unknown[];
}

async function storedRooms(page: Page): Promise<StoredRoom[]> {
  return page.evaluate(() => {
    try {
      const raw = localStorage.getItem('ppw_property_v2');
      if (!raw) return [];
      return JSON.parse(raw).state.property.rooms as StoredRoom[];
    } catch {
      return [];
    }
  });
}

async function placedCount(page: Page): Promise<number> {
  const rooms = await storedRooms(page);
  if (rooms.length === 0) return -1;
  return rooms.reduce((n, r) => n + r.placedItems.length, 0);
}

/** Items living in the level's Outdoors container(s). */
async function outdoorCount(page: Page): Promise<number> {
  const rooms = await storedRooms(page);
  return rooms.filter((r) => r.kind === 'outdoor').reduce((n, r) => n + r.placedItems.length, 0);
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
  return page.evaluate(
    ([c, tol]) => {
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
            Math.abs(data[p] - c.r) <= tol &&
            Math.abs(data[p + 1] - c.g) <= tol &&
            Math.abs(data[p + 2] - c.b) <= tol &&
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
    },
    [colour, GHOST_TOLERANCE] as const,
  );
}

/**
 * Press the first dock tile and carry it to `target` in several steps (the
 * hook promotes to a drag only past its threshold). Leaves the button DOWN
 * so the caller can inspect the ghost before releasing.
 */
async function dragFirstTileTo(page: Page, target: { x: number; y: number }): Promise<void> {
  const tile = page.locator('[data-testid="dock-strip"] [data-product-id]').first();
  const tileBox = await tile.boundingBox();
  if (!tileBox) throw new Error('no dock tile');
  await page.mouse.move(tileBox.x + tileBox.width / 2, tileBox.y + tileBox.height / 2);
  await page.mouse.down();
  for (let i = 1; i <= 5; i++) {
    await page.mouse.move(
      tileBox.x + (target.x - tileBox.x) * (i / 5),
      tileBox.y + (target.y - tileBox.y) * (i / 5),
    );
  }
  await page.waitForTimeout(150);
}

/**
 * A fixed WORLD point inside the quick 5x4 m room, in page px — via the DEV
 * geometry bridge when it is there, else the stage centre (which the
 * auto-centre fit puts on the room centre anyway).
 */
async function roomPoint(page: Page): Promise<{ x: number; y: number }> {
  const viaGeom = await worldToScreen(page, 2.5, 2.0);
  if (viaGeom) return viaGeom;
  const stageBox = await page.locator('.konva-stage').first().boundingBox();
  if (!stageBox) throw new Error('no stage');
  return { x: stageBox.x + stageBox.width / 2, y: stageBox.y + stageBox.height / 2 };
}

test.describe('Sims drag-drop — desktop', () => {
  test.use({ viewport: { width: 1920, height: 1080 } });

  test('drag a dock tile onto the plan and it places where the ghost was', async ({ page }) => {
    const logs: string[] = [];
    page.on('console', (m) => logs.push(m.text()));

    await openDesigner(page);
    expect(await placedCount(page)).toBe(0);

    const stage = page.locator('.konva-stage').first();
    const stageBox = await stage.boundingBox();
    if (!stageBox) throw new Error('no stage');

    const target = { x: stageBox.x + stageBox.width / 2, y: stageBox.y + stageBox.height / 2 };
    await dragFirstTileTo(page, target);

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

  test('a drop outside every room lands outdoors — the house is not a cage', async ({ page }) => {
    const logs: string[] = [];
    page.on('console', (m) => logs.push(m.text()));

    await openDesigner(page);
    const before = await placedCount(page);
    expect(await outdoorCount(page)).toBe(0);

    const stage = page.locator('.konva-stage').first();
    const stageBox = (await stage.boundingBox())!;

    // Top-left of the stage is canvas but well outside the centred room.
    const target = { x: stageBox.x + 60, y: stageBox.y + 60 };
    await dragFirstTileTo(page, target);
    await page.waitForTimeout(50);

    // No land plot is locked, so the garden is unbounded: the ghost says
    // VALID, in the teal GHOST_VALID_FILL, and never the terracotta.
    const good = await ghostPaint(page, GHOST_VALID);
    expect(good!.count).toBeGreaterThan(0);
    const bad = await ghostPaint(page, GHOST_INVALID);
    expect(bad!.count).toBe(0);

    await page.mouse.up();
    await page.waitForTimeout(400);

    // Committed into the level's Outdoors container — not refused, and not
    // teleported into the room either.
    expect(await placedCount(page)).toBe(before + 1);
    expect(await outdoorCount(page)).toBe(1);
    const rooms = await storedRooms(page);
    const outdoors = rooms.filter((r) => r.kind === 'outdoor');
    expect(outdoors).toHaveLength(1);
    expect(outdoors[0].polygon).toEqual([]);
    expect(logs.some((l) => l.includes('drop-commit'))).toBe(true);
    expect(logs.some((l) => l.includes('drop-rejected'))).toBe(false);
    expect(await page.locator('[data-armed="true"]').count()).toBe(0);
  });

  test('a blocked drop is refused where it is, not teleported to a free slot', async ({ page }) => {
    const logs: string[] = [];
    page.on('console', (m) => logs.push(m.text()));

    await openDesigner(page);
    expect(await placedCount(page)).toBe(0);

    // Drop 1 at a fixed world point: lands.
    await dragFirstTileTo(page, await roomPoint(page));
    await page.mouse.up();
    await page.waitForTimeout(400);
    expect(await placedCount(page)).toBe(1);
    expect(logs.some((l) => l.includes('drop-commit'))).toBe(true);

    // Deselect (closes the details rail) and re-read the point: opening the
    // rail can re-fit the viewport.
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);

    // Drop 2 of the SAME tile at the SAME world point: the footprint now
    // collides with drop 1, so the ghost goes terracotta...
    await dragFirstTileTo(page, await roomPoint(page));
    await page.waitForTimeout(50);
    const bad = await ghostPaint(page, GHOST_INVALID);
    expect(bad!.count).toBeGreaterThan(0);
    expect((await ghostPaint(page, GHOST_VALID))!.count).toBe(0);

    await page.mouse.up();
    await page.waitForTimeout(400);

    // ...and the release is refused, NOT relocated to a free slot somewhere
    // else in the room (you carried it HERE; teleporting it reads as a bug).
    expect(await placedCount(page)).toBe(1);
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
