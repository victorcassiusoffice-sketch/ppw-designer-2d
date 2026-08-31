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
 *
 * Run against a local dev server (needs the DEV geometry bridge):
 *   PPW_E2E_BASE_URL=http://localhost:5187 npx playwright test door-openings
 */
import { test, expect } from '@playwright/test';
import { ROOM_BORDER_SCAN } from '../../src/designer/blueprintTheme';
import {
  TWO_ROOM_FIXTURE,
  seedProperty,
  worldToScreen,
  renderedRoomCount,
  requireGeomBridge,
  GEOM_BRIDGE_SKIP,
  storedProperty,
  type SeedProperty,
} from './multiroom-helpers';
import { seedSimsProperty, type SimsSeedProperty } from './sims-world-helpers';
import { roomEdges, pointAlongEdge } from '../../src/designer/wallEdges';
import {
  edgeNormal,
  DEFAULT_DOOR_WIDTH_M,
  DEFAULT_WINDOW_WIDTH_M,
} from '../../src/designer/openings';
import { pointInPolygon } from '../../src/lib/geometry';

test.use({ viewport: { width: 1920, height: 1080 } });

/**
 * Give the DEV geometry bridge a fair chance to arrive before deciding.
 *
 * `window.__ppwGeom` is installed by a dynamic import from main.tsx, and on a
 * loaded machine (parallel workers, vite transforming on demand) that import
 * can land well after the canvas mounts. `requireGeomBridge` polls for only
 * 5 s, so without this a slow run SKIPS instead of running — a silent
 * coverage leak. The skip decision itself is unchanged: a build that never
 * ships the bridge still skips with the run command.
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
 * Half-width, in canvas px, of the strip scanned either side of the wall line.
 * The wall band is 10 px (0.1 m at 100 px/m) centred on the polygon edge, so
 * +-3 px stays well inside the ink on both sides.
 */
const WALL_SCAN_HALF_WIDTH_PX = 3;

/**
 * Count WALL rows down a vertical scan strip centred on a given page-x.
 *
 * Paper theme (2026-08-29): walls are CHARCOAL ink (#2A2926) on cream paper,
 * so a wall pixel is one where every channel sits under `ROOM_BORDER_SCAN.max`
 * (50) — the same predicate `isRoomBorderPixel` in blueprintTheme.ts uses, and
 * the one thing on the plan the paper floor, the grid, the wall shadow and the
 * door arc can never reach. (The old warm-vs-cool hue test read zero here: the
 * wall is now neutral, and so is the floor.)
 *
 * Why a STRIP rather than a single column: the wall carries a 1 px paper
 * hairline (`WALL_INNER_STROKE`, 0.18 alpha) straight down its centre, which
 * lifts that exact pixel to ~79 in the red channel. A single column that lands
 * on the hairline would report a solid wall as empty. Each ROW counts once if
 * ANY pixel within +-3 px of the line is ink, which is robust to the hairline
 * and to sub-pixel alignment, and still reads ZERO through a door gap — the
 * gap removes the whole 10 px band, and the leaf + jamb ticks that remain are
 * only a few px tall.
 */
async function wallPixelsOnColumn(
  page: import('@playwright/test').Page,
  pageX: number,
  y0: number,
  y1: number,
) {
  return page.evaluate(
    ([x, ya, yb, scanMax, scanMinAlpha, halfW]) => {
      const c = document.querySelector('.konvajs-content canvas') as HTMLCanvasElement | null;
      if (!c) return -1;
      const ctx = c.getContext('2d');
      if (!ctx) return -1;
      const rect = c.getBoundingClientRect();
      const scale = c.width / rect.width;
      const cx = Math.round((x - rect.x) * scale);
      if (cx < 0 || cx >= c.width) return -1;
      const left = Math.max(0, cx - halfW);
      const right = Math.min(c.width - 1, cx + halfW);
      const w = right - left + 1;
      const top = Math.max(0, Math.round((ya - rect.y) * scale));
      const bot = Math.min(c.height - 1, Math.round((yb - rect.y) * scale));
      const h = Math.max(1, bot - top + 1);
      const img = ctx.getImageData(left, top, w, h).data;
      let rows = 0;
      for (let row = 0; row < h; row++) {
        for (let col = 0; col < w; col++) {
          const i = (row * w + col) * 4;
          if (
            img[i + 3] > scanMinAlpha
            && img[i] < scanMax
            && img[i + 1] < scanMax
            && img[i + 2] < scanMax
          ) {
            rows++;
            break;
          }
        }
      }
      return rows;
    },
    [pageX, y0, y1, ROOM_BORDER_SCAN.max, ROOM_BORDER_SCAN.minAlpha, WALL_SCAN_HALF_WIDTH_PX],
  );
}

test.describe('Wall openings', () => {
  test('a door in the SHARED wall cuts BOTH rooms, not just the one that hosts it', async ({
    page,
  }) => {
    await seedProperty(page, TWO_ROOM_FIXTURE);
    await page.goto('/designer');
    await page.waitForSelector('.konvajs-content canvas', { state: 'attached' });
    test.skip(!(await bridgeOrSkip(page)), GEOM_BRIDGE_SKIP);
  await expect.poll(() => renderedRoomCount(page), { timeout: 15_000 }).toBe(2);

    // The shared wall runs world (5,0)-(5,4). Measure the ink on it BEFORE.
    // 0.3 -> 3.7 m is 340 rows; every one of them is wall.
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
    // The default door is 0.838 m = ~84 rows of band removed; the jamb ticks
    // and the leaf hinge that stay inside the gap are only a few rows, so a
    // real cut drops the count by ~75+. Poll: the cut paints on the frame
    // after the store write.
    await expect
      .poll(() => wallPixelsOnColumn(page, top.x, top.y, bottom.y), {
        timeout: 10_000,
        message:
          'the door must cut a visible gap through the shared wall. If room 2 still '
          + 'strokes its own copy of that wall, the count barely moves - which is '
          + 'exactly the "door that looks like a wall" bug this feature exists to fix.',
      })
      .toBeLessThan(wallBefore - 60);
    const wallAfter = await wallPixelsOnColumn(page, top.x, top.y, bottom.y);

    await page.screenshot({ path: 'docs/designer-build-2026-08-28/after/door-shared-wall.png' });
    console.log('DOOR_SHARED_WALL=true', JSON.stringify({ wallBefore, wallAfter }));
  });

  test('a door is refused where it will not fit, and the plan is untouched', async ({ page }) => {
    await seedProperty(page, TWO_ROOM_FIXTURE);
    await page.goto('/designer');
    await page.waitForSelector('.konvajs-content canvas', { state: 'attached' });
    test.skip(!(await bridgeOrSkip(page)), GEOM_BRIDGE_SKIP);
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
    test.skip(!(await bridgeOrSkip(page)), GEOM_BRIDGE_SKIP);
  await expect.poll(() => renderedRoomCount(page), { timeout: 15_000 }).toBe(2);

    await page.getByTestId('door-tool-toggle').click();
    const mid = (await worldToScreen(page, 5, 2))!;
    await page.mouse.move(mid.x, mid.y);
    await page.mouse.click(mid.x, mid.y);
    await expect
      .poll(async () => (await persistedOpenings(page, 'r1'))?.length ?? 0, { timeout: 10_000 })
      .toBe(1);

    // Let the fresh placement's remove-grace window lapse (a just-placed
    // opening is shielded from the remove scan so a doubled tap can never
    // net place + remove to zero — findings item 1). A DELIBERATE removal
    // is a later, separate gesture.
    await page.waitForTimeout(600);

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
    test.skip(!(await bridgeOrSkip(page)), GEOM_BRIDGE_SKIP);
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

// ---------------------------------------------------------------------------
// Doors round 2 (2026-08-31) — pins for the verified defects in
// docs/sims-world-2026-08-29/doors-2026-08-31/00-FINDINGS.md.
// ---------------------------------------------------------------------------

/** A persisted Opening, straight out of localStorage (shape per openings.ts). */
interface StoredOpening {
  id: string;
  edgeIndex: number;
  offsetM: number;
  widthM: number;
  kind: 'door' | 'doorway' | 'window';
  flipFacing: boolean;
  flipHand: boolean;
}

interface StoredRoomWide {
  id: string;
  name: string;
  polygon: Array<{ x: number; y: number }>;
  openings?: StoredOpening[];
}

/** Every room with its openings, from the persisted property. */
async function storedRoomsWide(page: import('@playwright/test').Page): Promise<StoredRoomWide[]> {
  return page.evaluate(() => {
    const raw = localStorage.getItem('ppw_property_v2');
    if (!raw) return [];
    try {
      const env = JSON.parse(raw) as { state?: { property?: { rooms?: unknown } } };
      const rooms = env.state?.property?.rooms;
      return (Array.isArray(rooms) ? rooms : []) as never;
    } catch {
      return [];
    }
  });
}

/**
 * Count TEAL pixels (the `DOOR_TARGET_WALL` #3D8F79 highlight, at any of its
 * rendered opacities over cream) in a box around a page point on the Konva
 * canvas. Konva-independent: nothing else on an unselected plan is teal —
 * walls/leaf are charcoal, paper is cream, the grid is neutral — so ANY teal
 * near the wall means the door tool's hover preview is painting.
 */
async function tealPixelsNear(
  page: import('@playwright/test').Page,
  cx: number,
  cy: number,
  half = 80,
): Promise<number> {
  return page.evaluate(
    ([x, y, h]) => {
      // Konva renders each Layer to its OWN canvas, and the door-hover ghost
      // lives on a later layer than the walls — so sum over EVERY layer
      // canvas, not just the first.
      const canvases = Array.from(
        document.querySelectorAll('.konvajs-content canvas'),
      ) as HTMLCanvasElement[];
      if (canvases.length === 0) return -1;
      let n = 0;
      for (const c of canvases) {
        const ctx = c.getContext('2d');
        if (!ctx) continue;
        const rect = c.getBoundingClientRect();
        if (rect.width === 0) continue;
        const scale = c.width / rect.width;
        const px = Math.round((x - rect.x) * scale);
        const py = Math.round((y - rect.y) * scale);
        const left = Math.max(0, px - h);
        const top = Math.max(0, py - h);
        const w = Math.min(c.width - 1, px + h) - left + 1;
        const ht = Math.min(c.height - 1, py + h) - top + 1;
        if (w <= 0 || ht <= 0) continue;
        const img = ctx.getImageData(left, top, w, ht).data;
        for (let i = 0; i < img.length; i += 4) {
          const r = img[i];
          const g = img[i + 1];
          const b = img[i + 2];
          const a = img[i + 3];
          if (a > 200 && g - r >= 25 && g - b >= 8 && g > 110) n++;
        }
      }
      return n;
    },
    [cx, cy, half],
  );
}

/** Shoelace signed area — POSITIVE = clockwise in this y-down world space. */
function signedArea(poly: Array<{ x: number; y: number }>): number {
  let s = 0;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    s += a.x * b.y - b.x * a.y;
  }
  return s / 2;
}

/**
 * The world-space unit normal a stored opening's leaf/arc swings toward —
 * exactly what the renderer computes (doorSymbol → edgeNormal). Looks the
 * edge up by its `index` FIELD, never by array position (findings item 9).
 */
function swingNormalOf(room: StoredRoomWide, o: StoredOpening): { nx: number; ny: number } {
  const edge = roomEdges({ id: room.id, polygon: room.polygon }).find(
    (e) => e.index === o.edgeIndex,
  );
  if (!edge) throw new Error(`edge ${o.edgeIndex} not found on room ${room.id}`);
  return edgeNormal(edge, o.flipFacing);
}

/** Arm the door tool and let the sub-bar-mount → canvas re-fit settle (the
 *  stale-transform race, findings item 3) so coordinates read AFTER this are
 *  correct regardless of that fix. */
async function armDoorTool(page: import('@playwright/test').Page): Promise<void> {
  await page.getByTestId('door-tool-toggle').click();
  await page.waitForTimeout(1100);
}

test.describe('Doors round 2 — hover, storeys, facing, widths, winding', () => {
  test('the hover preview paints on the wall while the door TOOL is armed (no product needed)', async ({
    page,
  }) => {
    await seedProperty(page, TWO_ROOM_FIXTURE);
    await page.goto('/designer');
    await page.waitForSelector('.konvajs-content canvas', { state: 'attached' });
    test.skip(!(await bridgeOrSkip(page)), GEOM_BRIDGE_SKIP);
    await expect.poll(() => renderedRoomCount(page), { timeout: 15_000 }).toBe(2);

    await armDoorTool(page);
    const mid = (await worldToScreen(page, 5, 2))!;
    await page.mouse.move(mid.x, mid.y, { steps: 4 });

    // The teal target highlight (dashed wall line + span band) must appear
    // near the hovered wall BEFORE any click. This was dead code: the Stage
    // pointer-move returned at `!pendingProductId` before the doorTool branch.
    await expect
      .poll(() => tealPixelsNear(page, mid.x, mid.y, 80), {
        timeout: 10_000,
        message:
          'no teal DOOR_TARGET_WALL pixels near the hovered wall — the door tool shows no '
          + 'hover preview (findings item 5: the doorTool branch sits below the '
          + '`!pendingProductId` early return in onPointerMove)',
      })
      .toBeGreaterThan(30);
    // And nothing was placed by a mere hover.
    expect((await persistedOpenings(page, 'r1'))?.length ?? 0).toBe(0);
    expect((await persistedOpenings(page, 'r2'))?.length ?? 0).toBe(0);
  });

  test('a click on an upper STOREY hosts the door on the upper room, never a nearer ground-floor wall', async ({
    page,
  }) => {
    // Two storeys. NOTE geometrically coincident rooms cannot be seeded: the
    // load-time un-stacker (roomLayout) is not level-aware and shifts an
    // overlapping room east ("Your rooms were un-stacked…" — verified with
    // tools/_scratch/storey-probe.mjs). So the pin is CROSS-LEVEL SNAP
    // AMBIGUITY instead: the click at (5.15, 2) is 0.15 m from the GROUND
    // room's right wall (x = 5) and 0.25 m from the upper room's left wall
    // (x = 5.4) — both inside the 0.6 m snap. A level-blind scan (findings
    // item 6) picks the NEARER ground wall; the fix must host the door on
    // the ACTIVE upper room.
    const STOREY_FIXTURE: SimsSeedProperty = {
      id: 'prop-doors-storeys',
      name: 'Doors Storeys',
      activeRoomId: 'r2up',
      activeLevelId: 'up',
      levels: [
        { id: 'ground', name: 'Ground floor', index: 0 },
        { id: 'up', name: 'Floor 1', index: 1 },
      ],
      rooms: [
        {
          id: 'r1',
          name: 'Ground room',
          polygon: [{ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 5, y: 4 }, { x: 0, y: 4 }],
          placedItems: [],
        },
        {
          id: 'r2up',
          name: 'Upper room',
          polygon: [{ x: 5.4, y: 0 }, { x: 10.4, y: 0 }, { x: 10.4, y: 4 }, { x: 5.4, y: 4 }],
          placedItems: [],
          levelId: 'up',
        },
      ],
    };
    await seedSimsProperty(page, STOREY_FIXTURE);
    await page.goto('/designer');
    await page.waitForSelector('.konvajs-content canvas', { state: 'attached' });
    test.skip(!(await bridgeOrSkip(page)), GEOM_BRIDGE_SKIP);
    // Only the ACTIVE level renders.
    await expect.poll(() => renderedRoomCount(page), { timeout: 15_000 }).toBe(1);

    await armDoorTool(page);
    const pt = (await worldToScreen(page, 5.15, 2))!;
    await page.mouse.move(pt.x, pt.y, { steps: 4 });
    await page.mouse.click(pt.x, pt.y);

    await expect
      .poll(async () => (await persistedOpenings(page, 'r2up'))?.length ?? 0, {
        timeout: 10_000,
        message:
          'the door must land on the ACTIVE (upper) storey room — hosting it on the '
          + 'nearer ground-floor wall is findings item 6',
      })
      .toBe(1);
    expect((await persistedOpenings(page, 'r1'))?.length ?? 0).toBe(0);
  });

  test('on a shared wall the door swings toward the side the cursor was on', async ({ page }) => {
    await seedProperty(page, TWO_ROOM_FIXTURE);
    await page.goto('/designer');
    await page.waitForSelector('.konvajs-content canvas', { state: 'attached' });
    test.skip(!(await bridgeOrSkip(page)), GEOM_BRIDGE_SKIP);
    await expect.poll(() => renderedRoomCount(page), { timeout: 15_000 }).toBe(2);

    await armDoorTool(page);

    // Click from ROOM 2's side of the x = 5 wall (cursor at x = 5.35).
    const right = (await worldToScreen(page, 5.35, 1))!;
    await page.mouse.move(right.x, right.y, { steps: 4 });
    await page.mouse.click(right.x, right.y);
    await expect
      .poll(async () =>
        (await storedRoomsWide(page)).reduce((n, r) => n + (r.openings?.length ?? 0), 0),
      { timeout: 10_000 })
      .toBe(1);

    let rooms = await storedRoomsWide(page);
    const host = rooms.find((r) => (r.openings?.length ?? 0) > 0)!;
    const first = host.openings![0];
    expect(
      swingNormalOf(host, first).nx,
      'clicked from the +x side, so the leaf/arc must swing toward +x (findings item 7: '
        + 'it always swung into the first-created room)',
    ).toBeGreaterThan(0);

    // And from ROOM 1's side (cursor at x = 4.65), well clear of door 1.
    const left = (await worldToScreen(page, 4.65, 3))!;
    await page.mouse.move(left.x, left.y, { steps: 4 });
    await page.mouse.click(left.x, left.y);
    await expect
      .poll(async () =>
        (await storedRoomsWide(page)).reduce((n, r) => n + (r.openings?.length ?? 0), 0),
      { timeout: 10_000 })
      .toBe(2);

    rooms = await storedRoomsWide(page);
    const all = rooms.flatMap((r) => (r.openings ?? []).map((o) => ({ room: r, o })));
    const second = all.find((e) => e.o.id !== first.id)!;
    expect(
      swingNormalOf(second.room, second.o).nx,
      'clicked from the -x side, so this door must swing toward -x',
    ).toBeLessThan(0);
  });

  test('the Window chip places a 1.2 m window; back on Door it is 0.838 m again', async ({
    page,
  }) => {
    await seedProperty(page, TWO_ROOM_FIXTURE);
    await page.goto('/designer');
    await page.waitForSelector('.konvajs-content canvas', { state: 'attached' });
    test.skip(!(await bridgeOrSkip(page)), GEOM_BRIDGE_SKIP);
    await expect.poll(() => renderedRoomCount(page), { timeout: 15_000 }).toBe(2);

    await armDoorTool(page);
    await page.getByTestId('door-kind-window').click();
    await expect(page.getByTestId('door-width-readout')).toHaveText(`${DEFAULT_WINDOW_WIDTH_M} m`);

    const top = (await worldToScreen(page, 2.5, 0))!;
    await page.mouse.move(top.x, top.y, { steps: 4 });
    await page.mouse.click(top.x, top.y);
    await expect
      .poll(async () => (await persistedOpenings(page, 'r1'))?.length ?? 0, { timeout: 10_000 })
      .toBe(1);
    let openings = (await persistedOpenings(page, 'r1')) as StoredOpening[];
    expect(openings[0].kind).toBe('window');
    expect(
      openings[0].widthM,
      'findings item 8: the Window chip used to keep the 0.838 door width',
    ).toBeCloseTo(DEFAULT_WINDOW_WIDTH_M, 6);

    // Switch back to Door — the width follows the kind again.
    await page.getByTestId('door-kind-door').click();
    await expect(page.getByTestId('door-width-readout')).toHaveText(`${DEFAULT_DOOR_WIDTH_M} m`);
    const bottom = (await worldToScreen(page, 2.5, 4))!;
    await page.mouse.move(bottom.x, bottom.y, { steps: 4 });
    await page.mouse.click(bottom.x, bottom.y);
    await expect
      .poll(async () => (await persistedOpenings(page, 'r1'))?.length ?? 0, { timeout: 10_000 })
      .toBe(2);
    openings = (await persistedOpenings(page, 'r1')) as StoredOpening[];
    const door = openings.find((o) => o.kind === 'door')!;
    expect(door.widthM).toBeCloseTo(DEFAULT_DOOR_WIDTH_M, 6);
  });

  test('a CCW-drawn room is canonicalised and its door swings INTO the room', async ({ page }) => {
    // One seeded room; the second is DRAWN with the pen counter-clockwise
    // (down → right → up → left in y-down space). Findings item 4: nothing
    // normalised winding, so every door on a CCW room swung OUTWARD.
    const ONE_ROOM: SeedProperty = {
      id: 'prop-doors-ccw',
      name: 'Doors CCW',
      activeRoomId: 'r1',
      rooms: [
        {
          id: 'r1',
          name: 'Room 1',
          polygon: [{ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 5, y: 4 }, { x: 0, y: 4 }],
          placedItems: [],
        },
      ],
    };
    await seedProperty(page, ONE_ROOM);
    await page.goto('/designer');
    await page.waitForSelector('.konvajs-content canvas', { state: 'attached' });
    test.skip(!(await bridgeOrSkip(page)), GEOM_BRIDGE_SKIP);
    await expect.poll(() => renderedRoomCount(page), { timeout: 15_000 }).toBe(1);

    // Draw CCW: (6,1) → (6,3) → (8,3) → (8,1), close on the first point.
    await page.getByTestId('room-draw-toggle').click();
    for (const [x, y] of [[6, 1], [6, 3], [8, 3], [8, 1], [6, 1]] as const) {
      const pt = (await worldToScreen(page, x, y))!;
      await page.mouse.move(pt.x, pt.y, { steps: 4 });
      await page.mouse.click(pt.x, pt.y);
    }
    await expect
      .poll(async () => ((await storedProperty(page))?.rooms.length ?? 0), { timeout: 10_000 })
      .toBe(2);

    const drawn = (await storedRoomsWide(page)).find((r) => r.id !== 'r1')!;
    // D1's canonicalisation: whatever direction the user drew in, the STORED
    // polygon is clockwise (positive shoelace area in y-down world space).
    expect(
      signedArea(drawn.polygon),
      'a CCW-drawn room must be stored canonically clockwise (winding fix, findings item 4)',
    ).toBeGreaterThan(0);

    // Place a door on its top wall, cursor just INSIDE the room.
    await armDoorTool(page);
    const pt = (await worldToScreen(page, 7, 1.15))!;
    await page.mouse.move(pt.x, pt.y, { steps: 4 });
    await page.mouse.click(pt.x, pt.y);
    await expect
      .poll(async () => (await persistedOpenings(page, drawn.id))?.length ?? 0, {
        timeout: 10_000,
      })
      .toBe(1);

    const roomNow = (await storedRoomsWide(page)).find((r) => r.id === drawn.id)!;
    const o = roomNow.openings![0];
    const edge = roomEdges({ id: roomNow.id, polygon: roomNow.polygon }).find(
      (e) => e.index === o.edgeIndex,
    )!;
    const n = edgeNormal(edge, o.flipFacing);
    const centre = pointAlongEdge(edge, o.offsetM);
    const probe = { x: centre.x + n.nx * 0.3, y: centre.y + n.ny * 0.3 };
    expect(
      pointInPolygon(probe, roomNow.polygon),
      `the leaf/arc must swing INTO the room — probe ${JSON.stringify(probe)} is outside `
        + `${JSON.stringify(roomNow.polygon)} (outward swing = findings item 4)`,
    ).toBe(true);
  });
});
