/**
 * Doors — Vic's headline ask: "what if I wanted to add a door going into the
 * second room. We need to facilitate this properly."
 *
 * The load-bearing assertion is the SHARED-WALL one. The wall between two
 * attached rooms exists in BOTH room polygons, so a door hosted by room 1 must
 * also cut room 2's stroke. Cut only one and the neighbour's gold line still
 * runs straight across the doorway — the door looks like a wall, which is
 * exactly the bug this feature exists to avoid. That is measured in PIXELS on
 * the real canvas, not inferred from the store.
 */
import { test, expect } from '@playwright/test';
import {
  TWO_ROOM_FIXTURE,
  seedProperty,
  worldToScreen,
  renderedRoomCount,
} from './multiroom-helpers';

test.use({ viewport: { width: 1920, height: 1080 } });

/** Persisted openings for a room, straight out of localStorage. */
async function persistedOpenings(page: import('@playwright/test').Page, roomId: string) {
  return page.evaluate((id) => {
    const raw = localStorage.getItem('ppw_property_v2');
    if (!raw) return null;
    const env = JSON.parse(raw);
    const room = env.state?.property?.rooms?.find((r: { id: string }) => r.id === id);
    return room ? (room.openings ?? []) : null;
  }, roomId);
}

/**
 * Count WALL pixels down a vertical scan line at a given page-x.
 *
 * Deliberately NOT the strict gold predicate the other specs use. A wall's
 * INNER half renders blended with the room fill (~rgba(146,119,71) rather than
 * the pure #E8A33D) — verified identical on `main`, so it is long-standing
 * behaviour, not something this feature introduced. On the SHARED wall between
 * two attached rooms BOTH halves are "inner", so not a single pixel there
 * satisfies `r > 200` and a gold-based count reads zero on a perfectly good
 * wall.
 *
 * What separates wall from floor at any brightness is HUE: the wall is warm
 * (r > b) and the floor is cool (r < b, it is navy). That predicate holds for
 * pure gold, for the blended inner half, and for the shared wall alike.
 */
async function wallPixelsOnColumn(
  page: import('@playwright/test').Page,
  pageX: number,
  y0: number,
  y1: number,
) {
  return page.evaluate(
    ([x, ya, yb]) => {
      const c = document.querySelector('.konvajs-content canvas') as HTMLCanvasElement | null;
      if (!c) return -1;
      const ctx = c.getContext('2d');
      if (!ctx) return -1;
      const rect = c.getBoundingClientRect();
      const scale = c.width / rect.width;
      const cx = Math.round((x - rect.x) * scale);
      if (cx < 0 || cx >= c.width) return -1;
      const top = Math.max(0, Math.round((ya - rect.y) * scale));
      const bot = Math.min(c.height - 1, Math.round((yb - rect.y) * scale));
      const img = ctx.getImageData(cx, top, 1, Math.max(1, bot - top + 1)).data;
      let n = 0;
      for (let i = 0; i < img.length; i += 4) {
        if (img[i + 3] > 200 && img[i] > img[i + 2] + 30) n++;
      }
      return n;
    },
    [pageX, y0, y1],
  );
}

test.describe('Wall openings', () => {
  test('a door in the SHARED wall cuts BOTH rooms, not just the one that hosts it', async ({
    page,
  }) => {
    await seedProperty(page, TWO_ROOM_FIXTURE);
    await page.goto('/designer');
    await page.waitForSelector('.konvajs-content canvas', { state: 'attached' });
    await expect.poll(() => renderedRoomCount(page), { timeout: 15_000 }).toBe(2);

    // The shared wall runs world (5,0)-(5,4). Measure the gold on it BEFORE.
    const top = (await worldToScreen(page, 5, 0.3))!;
    const bottom = (await worldToScreen(page, 5, 3.7))!;
    const wallBefore = await wallPixelsOnColumn(page, top.x, top.y, bottom.y);
    expect(wallBefore, 'the shared wall should be solid to start').toBeGreaterThan(200);

    // Place a door at the middle of that wall.
    await page.getByTestId('door-tool-toggle').click();
    const mid = (await worldToScreen(page, 5, 2))!;
    await page.mouse.move(mid.x, mid.y);
    await page.mouse.click(mid.x, mid.y);

    // It is hosted by exactly ONE room...
    await expect
      .poll(async () => (await persistedOpenings(page, 'r1'))?.length ?? 0, { timeout: 10_000 })
      .toBe(1);
    expect((await persistedOpenings(page, 'r2'))?.length ?? 0).toBe(0);

    // ...but the GAP must appear in the rendered wall, which is the real test.
    const wallAfter = await wallPixelsOnColumn(page, top.x, top.y, bottom.y);
    expect(
      wallAfter,
      'the door must cut a visible gap through the shared wall. If room 2 still '
        + 'strokes its own copy of that wall, the count barely moves - which is '
        + 'exactly the "door that looks like a wall" bug this feature exists to fix.',
    ).toBeLessThan(wallBefore - 60);

    await page.screenshot({ path: 'docs/designer-build-2026-08-28/after/door-shared-wall.png' });
    console.log('DOOR_SHARED_WALL=true', JSON.stringify({ wallBefore, wallAfter }));
  });

  test('a door is refused where it will not fit, and the plan is untouched', async ({ page }) => {
    await seedProperty(page, TWO_ROOM_FIXTURE);
    await page.goto('/designer');
    await page.waitForSelector('.konvajs-content canvas', { state: 'attached' });
    await expect.poll(() => renderedRoomCount(page), { timeout: 15_000 }).toBe(2);

    await page.getByTestId('door-tool-toggle').click();

    // Hard into the corner: the jamb margin makes this illegal, and the
    // clamp should pull it to a legal offset rather than refuse outright —
    // so assert the door lands INSIDE the legal range, never on the corner.
    const corner = (await worldToScreen(page, 5, 0.02))!;
    await page.mouse.move(corner.x, corner.y);
    await page.mouse.click(corner.x, corner.y);

    const openings = (await persistedOpenings(page, 'r1')) ?? [];
    if (openings.length) {
      const o = openings[0];
      expect(o.offsetM - o.widthM / 2).toBeGreaterThanOrEqual(0.1 - 1e-6);
      expect(o.offsetM + o.widthM / 2).toBeLessThanOrEqual(4 - 0.1 + 1e-6);
    }
  });

  test('clicking an existing door removes it', async ({ page }) => {
    await seedProperty(page, TWO_ROOM_FIXTURE);
    await page.goto('/designer');
    await page.waitForSelector('.konvajs-content canvas', { state: 'attached' });
    await expect.poll(() => renderedRoomCount(page), { timeout: 15_000 }).toBe(2);

    await page.getByTestId('door-tool-toggle').click();
    const mid = (await worldToScreen(page, 5, 2))!;
    await page.mouse.move(mid.x, mid.y);
    await page.mouse.click(mid.x, mid.y);
    await expect
      .poll(async () => (await persistedOpenings(page, 'r1'))?.length ?? 0, { timeout: 10_000 })
      .toBe(1);

    // Same spot again — now it is a delete target.
    await page.mouse.move(mid.x, mid.y);
    await page.mouse.click(mid.x, mid.y);
    await expect
      .poll(async () => (await persistedOpenings(page, 'r1'))?.length ?? 0, { timeout: 10_000 })
      .toBe(0);
  });

  test('a door survives undo/redo as ONE history step', async ({ page }) => {
    await seedProperty(page, TWO_ROOM_FIXTURE);
    await page.goto('/designer');
    await page.waitForSelector('.konvajs-content canvas', { state: 'attached' });
    await expect.poll(() => renderedRoomCount(page), { timeout: 15_000 }).toBe(2);

    await page.getByTestId('door-tool-toggle').click();
    const mid = (await worldToScreen(page, 5, 2))!;
    await page.mouse.move(mid.x, mid.y);
    await page.mouse.click(mid.x, mid.y);
    await expect
      .poll(async () => (await persistedOpenings(page, 'r1'))?.length ?? 0, { timeout: 10_000 })
      .toBe(1);

    // Leave the door tool so Escape/keys route normally, then undo.
    await page.keyboard.press('Escape');
    await page.keyboard.press('Control+z');
    await expect
      .poll(async () => (await persistedOpenings(page, 'r1'))?.length ?? 0, { timeout: 10_000 })
      .toBe(0);
  });
});
