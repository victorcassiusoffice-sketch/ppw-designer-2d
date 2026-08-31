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
 *
 * Run against a local dev server (needs the DEV geometry bridge):
 *   PPW_E2E_BASE_URL=http://localhost:5187 npx playwright test flooring
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

/**
 * Colour contract for the paper theme (2026-08-29, blueprintTheme.ts).
 *
 * BARE floor is paper-white — ROOM_FILL #F8F5EE / ROOM_FILL_ACTIVE #FDFBF6 —
 * so every channel is far above 200. The rubber floor `outdoor-1m` is
 * #8b3a2f painted at 0.9 opacity over that paper, which lands at roughly
 * rgb(150,77,67): clearly red-dominant and dark in blue. The two predicates
 * below are mutually exclusive, so a floor that is stored but never painted
 * (the original bug) cannot satisfy the "painted" one by accident.
 */
const isLightPaper = (p: { r: number; g: number; b: number }) => Math.min(p.r, p.g, p.b) > 200;
const isDarkRed = (p: { r: number; g: number; b: number }) =>
  p.r > 100 && p.b < 80 && p.r - p.b > 40;

/**
 * Sample points sit OFF the grid: the quiet charcoal grid is drawn over the
 * floor at 0.06 / 0.12 opacity, and a major-line crossing pulls the paper
 * down to ~208, which is too close to the 200 floor to be deterministic.
 * x.x5 / y.x5 metres is mid-cell for every grid tier the canvas can pick
 * (0.1 / 0.25 / 0.5 / 1 m).
 */
const R1_SAMPLE = { x: 2.55, y: 2.05 };
const R2_SAMPLE = { x: 7.05, y: 2.05 };

/**
 * Give the DEV geometry bridge a fair chance to arrive before deciding: it is
 * a dynamic import from main.tsx and on a loaded machine lands after the
 * canvas mounts, while `requireGeomBridge` polls for only 5 s. Without this
 * a slow run SKIPS instead of running. The skip decision is unchanged.
 */
async function bridgeOrSkip(page: import('@playwright/test').Page): Promise<boolean> {
  await page
    .waitForFunction(
      () => Boolean((window as unknown as { __ppwGeom?: unknown }).__ppwGeom),
      undefined,
      { timeout: 20_000 },
    )
    .catch(() => undefined);
  return requireGeomBridge(page);
}

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
  test.skip(!(await bridgeOrSkip(page)), GEOM_BRIDGE_SKIP);
  await expect.poll(() => renderedRoomCount(page), { timeout: 15_000 }).toBe(2);

  // Bare floor: the room reads as paper-white (every channel > 200), and is
  // NOT already dark red — otherwise the "painted" assertion below is vacuous.
  const bare = (await pixelAtWorld(page, R1_SAMPLE.x, R1_SAMPLE.y))!;
  expect(isLightPaper(bare), `bare floor should be paper-white, got ${JSON.stringify(bare)}`).toBe(true);
  expect(isDarkRed(bare)).toBe(false);

  // Lay a floor in the ACTIVE room (r1) with the ONE Floor tool (2026-08-30):
  // open the docked Floor panel, pick the material, then the Room scope chip
  // fills the active room in one action.
  await page.getByTestId('floor-paint-toggle').click();
  await expect(page.getByTestId('floor-paint-palette')).toBeVisible();
  await page.getByTestId('floor-paint-outdoor-1m').click();
  await page.getByTestId('floor-paint-scope-room').click();

  // It is persisted... A tileable material fills as ONE full-cover tile zone
  // (`fillRoomFloor`), not as the old whole-room `floorFinish`.
  await expect
    .poll(
      async () => {
        const r = await persistedRoom(page, 'r1');
        const zones = (r?.floorTiles ?? []) as Array<{ materialId: string }>;
        return zones.length === 1 ? zones[0].materialId : null;
      },
      { timeout: 10_000 },
    )
    .toBe('outdoor-1m');

  // ...and it is on the CANVAS. #8b3a2f is a dark red-brown, so the pixel
  // flips from paper-white to dark red. This is the assertion that would have
  // caught the original bug, where the store was written and nothing was ever
  // drawn. Poll the PIXEL, not just the store: the material is painted on the
  // next canvas frame after the store write, so a single immediate read can
  // catch the pre-paint frame and report bare paper. A build that writes the
  // store without ever drawing still fails on timeout.
  await expect
    .poll(
      async () => {
        const px = await pixelAtWorld(page, R1_SAMPLE.x, R1_SAMPLE.y);
        return px ? isDarkRed(px) : false;
      },
      {
        timeout: 10_000,
        message: 'the chosen floor material must actually be painted on the canvas',
      },
    )
    .toBe(true);
  const painted = (await pixelAtWorld(page, R1_SAMPLE.x, R1_SAMPLE.y))!;

  // The OTHER room is untouched — floor finish is per-room.
  const other = (await pixelAtWorld(page, R2_SAMPLE.x, R2_SAMPLE.y))!;
  expect(
    isLightPaper(other),
    `the neighbouring room must stay bare paper, got ${JSON.stringify(other)}`,
  ).toBe(true);
  expect(isDarkRed(other)).toBe(false);
  const r2 = await persistedRoom(page, 'r2');
  expect(r2?.floorFinish ?? null).toBeFalsy();
  expect((r2?.floorTiles ?? []).length).toBe(0);

  await page.screenshot({ path: 'docs/designer-build-2026-08-28/after/flooring.png' });
  console.log('FLOORING=true', JSON.stringify({ bare, painted, other }));
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
  test.skip(!(await bridgeOrSkip(page)), GEOM_BRIDGE_SKIP);
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
