/**
 * Sims drag-drop — pick a placed item back up (Vic 2026-08-28).
 *
 * The last Sims mechanic: an object already on the plan can be picked up and
 * moved, including ACROSS a shared wall into an attached room. Before this,
 * `PlacedItemGroup` was handed its OWNING room's polygon, so a release over a
 * neighbour failed the inside-polygon test and bounced back with a toast —
 * while a FRESH placement at the identical point routed correctly. That
 * asymmetry was the bug.
 *
 * Run against a local dev server:
 *   PPW_E2E_BASE_URL=http://localhost:5187 npx playwright test item-pickup
 */

import { test, expect, type Page } from '@playwright/test';
import { TWO_ROOM_FIXTURE, renderedRoomCount, worldToScreen, type SeedProperty } from './multiroom-helpers';

/** One item sitting in room r1, well clear of the shared x = 5 wall. */
function fixtureWithItem(): SeedProperty {
  const p = JSON.parse(JSON.stringify(TWO_ROOM_FIXTURE)) as SeedProperty;
  p.rooms[0].placedItems = [
    { instanceId: 'keep-me-1', productId: 'k1-schwinn-700ic', x: 1, y: 1, rotation: 0 },
  ];
  return p;
}

async function seed(page: Page, prop: SeedProperty): Promise<void> {
  await page.addInitScript((pp) => {
    localStorage.clear();
    localStorage.setItem('ppw_designer_coach_v1', '1');
    localStorage.setItem(
      'ppw_property_v2',
      JSON.stringify({
        state: { property: pp, showGrid: true, pxPerMetre: 100 },
        version: 2,
      }),
    );
  }, prop);
}

async function rooms(page: Page): Promise<SeedProperty['rooms']> {
  return page.evaluate(() => {
    const raw = localStorage.getItem('ppw_property_v2');
    return JSON.parse(raw!).state.property.rooms;
  });
}

async function waitForGeom(page: Page): Promise<void> {
  await page.waitForFunction(
    () => {
      const g = (window as unknown as { __ppwGeom?: { ready: () => boolean } }).__ppwGeom;
      return !!g && g.ready();
    },
    undefined,
    { timeout: 15_000 },
  );
}

/**
 * Wait until both rooms are mounted AND the auto-centre fit has stopped
 * moving the stage: two reads of world (0,0) 150 ms apart must agree. A
 * fixed sleep is not load-proof — with several Playwright runs sharing one
 * vite dev server the fit can land well after 600 ms, and a grab computed
 * from the pre-fit transform misses the item entirely.
 */
async function waitForViewportSettled(page: Page): Promise<void> {
  await expect.poll(() => renderedRoomCount(page), { timeout: 15_000 }).toBe(2);
  await expect
    .poll(
      async () => {
        const a = await worldToScreen(page, 0, 0);
        await page.waitForTimeout(150);
        const b = await worldToScreen(page, 0, 0);
        return !!a && !!b && a.x === b.x && a.y === b.y;
      },
      { timeout: 15_000 },
    )
    .toBe(true);
}

test.describe('Sims drag-drop — pick up a placed item', () => {
  test.use({ viewport: { width: 1920, height: 1080 } });

  test('drags across a shared wall into the neighbouring room, keeping its identity', async ({
    page,
  }) => {
    const logs: string[] = [];
    page.on('console', (m) => logs.push(m.text()));

    await seed(page, fixtureWithItem());
    await page.goto('/designer');
    await page.waitForSelector('.konvajs-content canvas', { state: 'attached' });
    await waitForGeom(page);
    await waitForViewportSettled(page);

    const before = await rooms(page);
    expect(before[0].placedItems).toHaveLength(1);
    expect(before[1].placedItems).toHaveLength(0);
    const originalId = before[0].placedItems[0].instanceId;

    // The item's centre is at world (1,1) + half its footprint. Grab near its
    // origin corner and carry it across the x = 5 wall into room 2.
    const from = await worldToScreen(page, 1.3, 1.3);
    const to = await worldToScreen(page, 7, 2);
    if (!from || !to) throw new Error('geom bridge unavailable');

    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    for (let i = 1; i <= 6; i++) {
      await page.mouse.move(from.x + (to.x - from.x) * (i / 6), from.y + (to.y - from.y) * (i / 6));
    }
    await page.mouse.up();
    // The drag-end commit is synchronous in the handler, but poll the
    // persisted store rather than sleeping a fixed 600 ms.
    await expect.poll(async () => (await rooms(page))[1].placedItems.length, { timeout: 10_000 }).toBe(1);

    const after = await rooms(page);

    // It left room A and arrived in room B.
    expect(after[0].placedItems).toHaveLength(0);
    expect(after[1].placedItems).toHaveLength(1);

    // THE assertion: identity survived. A remove-then-add composition cannot
    // satisfy this, because addItem mints a fresh instanceId - so a build that
    // "solved" the move the obvious way goes red here rather than silently
    // orphaning the selection, the history reference and the cart line item.
    expect(after[1].placedItems[0].instanceId).toBe(originalId);

    expect(logs.some((l) => l.includes('cross-room'))).toBe(true);

    // And one undo puts it back.
    await page.keyboard.press('Control+z');
    await expect.poll(async () => (await rooms(page))[0].placedItems.length, { timeout: 10_000 }).toBe(1);
    const undone = await rooms(page);
    expect(undone[0].placedItems).toHaveLength(1);
    expect(undone[1].placedItems).toHaveLength(0);
    expect(undone[0].placedItems[0].instanceId).toBe(originalId);
  });

  test('a same-room drag still just moves the item', async ({ page }) => {
    await seed(page, fixtureWithItem());
    await page.goto('/designer');
    await page.waitForSelector('.konvajs-content canvas', { state: 'attached' });
    await waitForGeom(page);
    await waitForViewportSettled(page);

    const from = await worldToScreen(page, 1.3, 1.3);
    const to = await worldToScreen(page, 3.2, 2.6);
    if (!from || !to) throw new Error('geom bridge unavailable');

    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    for (let i = 1; i <= 6; i++) {
      await page.mouse.move(from.x + (to.x - from.x) * (i / 6), from.y + (to.y - from.y) * (i / 6));
    }
    await page.mouse.up();
    await expect.poll(async () => (await rooms(page))[0].placedItems[0]?.x, { timeout: 10_000 }).not.toBe(1);

    const after = await rooms(page);
    // Still one item, still in room A, still the same identity.
    expect(after[0].placedItems).toHaveLength(1);
    expect(after[1].placedItems).toHaveLength(0);
    expect(after[0].placedItems[0].instanceId).toBe('keep-me-1');
    // ...and it actually moved.
    expect(after[0].placedItems[0].x).not.toBe(1);
  });
});
