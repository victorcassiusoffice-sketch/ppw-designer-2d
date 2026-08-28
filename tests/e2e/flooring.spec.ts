/**
 * Flooring — Vic: "the flooring doesn't work" and "people need to place things
 * on top of the flooring."
 *
 * Both were true and both had concrete causes:
 *   3. There was no flooring feature at all. `floorZoneStore.addZone` had zero
 *      production callers and RoomCanvas never rendered a zone, so nothing a
 *      user did could ever put a floor on the canvas.
 *   4. The only way to get "flooring" down was to place the flooring SKUs as
 *      ordinary items, and the collision check was category-blind — so a mat
 *      blocked everything on top of it and the blocked product was silently
 *      teleported elsewhere by findFreeSlot.
 *
 * These assert the FIX for both, on the real canvas.
 */
import { test, expect } from '@playwright/test';
import {
  TWO_ROOM_FIXTURE,
  cloneFixture,
  seedProperty,
  worldToScreen,
  renderedRoomCount,
  requireGeomBridge,
  GEOM_BRIDGE_SKIP,
} from './multiroom-helpers';

test.use({ viewport: { width: 1600, height: 900 } });

/** The rendered pixel colour at a world point. */
async function pixelAtWorld(page: import('@playwright/test').Page, xM: number, yM: number) {
  const p = (await worldToScreen(page, xM, yM))!;
  return page.evaluate(
    ([px, py]) => {
      const c = document.querySelector('.konvajs-content canvas') as HTMLCanvasElement | null;
      if (!c) return null;
      const ctx = c.getContext('2d');
      if (!ctx) return null;
      const rect = c.getBoundingClientRect();
      const scale = c.width / rect.width;
      const d = ctx.getImageData(
        Math.round((px - rect.x) * scale),
        Math.round((py - rect.y) * scale),
        1,
        1,
      ).data;
      return { r: d[0], g: d[1], b: d[2], a: d[3] };
    },
    [p.x, p.y],
  );
}

async function persistedRoom(page: import('@playwright/test').Page, roomId: string) {
  return page.evaluate((id) => {
    const raw = localStorage.getItem('ppw_property_v2');
    if (!raw) return null;
    const env = JSON.parse(raw);
    return env.state?.property?.rooms?.find((r: { id: string }) => r.id === id) ?? null;
  }, roomId);
}

test('a floor material can be chosen and it actually renders', async ({ page }) => {
  await seedProperty(page, TWO_ROOM_FIXTURE);
  await page.goto('/designer');
  await page.waitForSelector('.konvajs-content canvas', { state: 'attached' });
  test.skip(!(await requireGeomBridge(page)), GEOM_BRIDGE_SKIP);
  await expect.poll(() => renderedRoomCount(page), { timeout: 15_000 }).toBe(2);

  // Bare floor: the room reads as the blueprint fill, a cool navy (b > r).
  const bare = await pixelAtWorld(page, 2.5, 2);
  expect(bare!.b).toBeGreaterThan(bare!.r);

  // Choose a floor for the ACTIVE room (r1).
  await page.getByTestId('floor-tool-toggle').click();
  await page.getByTestId('floor-material-outdoor-1m').click();

  // It is persisted...
  await expect
    .poll(async () => (await persistedRoom(page, 'r1'))?.floorFinish?.materialId ?? null, {
      timeout: 10_000,
    })
    .toBe('outdoor-1m');

  // ...and it is on the CANVAS. #8b3a2f is a warm red-brown, so the pixel
  // flips from cool to warm. This is the assertion that would have caught the
  // original bug, where the store was written and nothing was ever drawn.
  // Poll the PIXEL, not just the store. The material is painted on the next
  // canvas frame after the store write, so a single immediate read can catch
  // the pre-paint frame and report the bare ROOM_FILL navy. The assertion is
  // unchanged in strength - the pixel must still become warm, and a build that
  // writes the store without ever drawing still fails on timeout.
  await expect
    .poll(
      async () => {
        const px = await pixelAtWorld(page, 2.5, 2);
        return px ? px.r - px.b : -1;
      },
      {
        timeout: 10_000,
        message: 'the chosen floor material must actually be painted on the canvas',
      },
    )
    .toBeGreaterThan(0);

  // The OTHER room is untouched — floor finish is per-room.
  const other = await pixelAtWorld(page, 7, 2);
  expect(other!.b).toBeGreaterThan(other!.r);
  expect((await persistedRoom(page, 'r2'))?.floorFinish ?? null).toBeFalsy();

  await page.screenshot({ path: 'docs/designer-build-2026-08-28/after/flooring.png' });
  console.log('FLOORING=true');
});

test('equipment can be placed ON TOP of a flooring product', async ({ page }) => {
  // Seed room 1 already carpeted with flooring SKUs laid as items — the exact
  // situation that used to make the room unusable.
  const f = cloneFixture(TWO_ROOM_FIXTURE);
  f.rooms[0].placedItems = [
    { instanceId: 'm1', productId: 'k1-floor-rubber-interlock', x: 1.0, y: 1.0, rotation: 0 },
    { instanceId: 'm2', productId: 'k1-floor-rubber-interlock', x: 2.0, y: 1.0, rotation: 0 },
    { instanceId: 'm3', productId: 'k1-floor-rubber-interlock', x: 3.0, y: 1.0, rotation: 0 },
  ];
  await seedProperty(page, f);
  await page.goto('/designer');
  await page.waitForSelector('.konvajs-content canvas', { state: 'attached' });
  test.skip(!(await requireGeomBridge(page)), GEOM_BRIDGE_SKIP);
  await expect.poll(() => renderedRoomCount(page), { timeout: 15_000 }).toBe(2);

  const before = (await persistedRoom(page, 'r1'))!.placedItems.length;
  expect(before).toBe(3);

  // Arm a piece of equipment and drop it squarely on top of a mat.
  // Arming sequence mirrors placement-fsm: click the card, then CONFIRM the
  // FSM actually armed before clicking the canvas. Without that check a
  // missed card click looks identical to a refused placement.
  const card = page.locator('[data-product-id="k1-schwinn-700ic"]').first();
  await card.scrollIntoViewIfNeeded();
  await expect(card).toBeVisible();
  await card.click();
  await expect(page.locator('[data-armed="true"]').first()).toBeVisible({ timeout: 5_000 });

  const target = (await worldToScreen(page, 2.0, 1.0))!;
  await page.mouse.move(target.x, target.y, { steps: 10 });
  await page.mouse.click(target.x, target.y);

  await expect
    .poll(async () => (await persistedRoom(page, 'r1'))?.placedItems.length ?? 0, {
      timeout: 10_000,
    })
    .toBe(before + 1);

  // And it landed WHERE IT WAS DROPPED, rather than being teleported away by
  // findFreeSlot — the silent relocation was as bad as the refusal.
  const room = (await persistedRoom(page, 'r1'))!;
  const placed = room.placedItems.find(
    (i: { productId: string }) => i.productId === 'k1-schwinn-700ic',
  );
  expect(placed, 'the equipment should have been placed').toBeTruthy();
  expect(Math.abs(placed.x - 2.0)).toBeLessThan(1.0);
  expect(Math.abs(placed.y - 1.0)).toBeLessThan(1.0);

  console.log('ON_TOP_OF_FLOORING=true', JSON.stringify({ x: placed.x, y: placed.y }));
});
