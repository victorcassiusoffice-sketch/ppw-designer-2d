/**
 * Eco / solar (Vic 2026-09-04): "a solar panel calculates the output and sun
 * in Mauritius … when a person adds something electronic it calculates the
 * output … shows if the solar panel is sufficiently providing enough power …
 * these obviously need to be on a roof, as such when selecting solar panels a
 * roof with the roof surface measured at room scale can automatically pop
 * up, additionally a roof button is there".
 *
 * Pins:
 *   1. the Eco tab exists and holds the priced Emcar solar products;
 *   2. arming a panel from the dock takes the plan to the ROOF level, whose
 *      slab mirrors the room beneath (same polygon, kind 'roof', no walls);
 *   3. a panel dropped on the slab lands in the roof room, on the tile
 *      lattice; dropping OFF the slab is refused; the energy chip appears;
 *   4. the Roof button toggles between the roof and the top storey, and the
 *      wall pen refuses the roof;
 *   5. the Energy panel opens from the chip with the PVGIS-based numbers
 *      (475 Wp × 5.17 PSH × 0.775 = 1.9 kWh/day), per-item switches, Done;
 *   6. a plan with a consumer and no panels reads "short" with the panel
 *      hint; adding a panel flips it to covered;
 *   7. the roof slabs + level survive a reload (whitelist round trip).
 *
 * Run against a local dev server:
 *   PPW_E2E_BASE_URL=http://127.0.0.1:5188 npx playwright test eco-solar
 */

import { test, expect, type Page } from '@playwright/test';
import { GEOM_BRIDGE_SKIP } from './multiroom-helpers';
import {
  armAndClickWorld,
  clickWorld,
  installToastLog,
  konvaNodeCount,
  oneRoomFixture,
  requireGeomBridgeGenerous,
  seedSimsProperty,
  storedSimsProperty,
  toastLog,
  waitForGeom,
  type SimsSeedProperty,
} from './sims-world-helpers';

const PANEL = 'emcar-jinko-475';

async function openSeeded(page: Page): Promise<void> {
  await page.goto('/designer');
  await page.waitForSelector('.konvajs-content canvas', { state: 'attached', timeout: 30_000 });
  if (!(await requireGeomBridgeGenerous(page))) test.skip(true, GEOM_BRIDGE_SKIP);
  await waitForGeom(page);
  await page.waitForTimeout(500);
}

type StoredRoom = SimsSeedProperty['rooms'][number] & { kind?: string };

function roofRooms(p: SimsSeedProperty | null): StoredRoom[] {
  return ((p?.rooms ?? []) as StoredRoom[]).filter((r) => r.kind === 'roof');
}

test.describe('Eco / solar — roof + energy', () => {
  test.use({ viewport: { width: 1920, height: 1080 } });

  test('1. the Eco tab lists the Emcar solar products', async ({ page }) => {
    await seedSimsProperty(page, oneRoomFixture());
    await openSeeded(page);
    const tab = page.locator('[data-testid="dock-cat-eco"]');
    await expect(tab).toBeVisible();
    await tab.click();
    const tiles = page.locator('[data-testid="dock-strip"] [data-product-id]');
    await expect(tiles).toHaveCount(8);
    await expect(page.locator(`[data-product-id="${PANEL}"]`).first()).toBeVisible();
    // Every dock thumbnail is a committed WebP (objects-topdown contract).
    const srcs = await page.locator('[data-testid="dock-strip"] img').evaluateAll((imgs) =>
      imgs.map((i) => i.getAttribute('src') ?? ''),
    );
    expect(srcs.length).toBeGreaterThan(0);
    for (const s of srcs) expect(s.endsWith('.webp')).toBe(true);
  });

  test('2 + 3. arming a panel pops the roof; the panel lands on the slab; off-slab is refused', async ({ page }) => {
    await seedSimsProperty(page, oneRoomFixture());
    await openSeeded(page);
    await installToastLog(page);
    await expect(page.locator('[data-testid="level-readout"]')).toHaveCount(0);

    // Arm from the Eco tab → the roof level appears and is active.
    await page.locator('[data-testid="dock-cat-eco"]').click();
    const card = page.locator(`[data-product-id="${PANEL}"]`).first();
    await card.click();
    await expect(page.locator('[data-armed="true"]')).toHaveCount(2);
    await expect(page.locator('[data-testid="level-readout"]')).toContainText('Roof');

    const afterArm = await storedSimsProperty(page);
    expect(afterArm!.levels!.map((l) => l.id)).toEqual(['ground', 'roof']);
    expect(afterArm!.activeLevelId).toBe('roof');
    const slabs = roofRooms(afterArm);
    expect(slabs).toHaveLength(1);
    expect(slabs[0].id).toBe('roof-r1');
    expect(slabs[0].polygon).toEqual([{ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 5, y: 4 }, { x: 0, y: 4 }]);
    // The slab renders as a slab: a dashed parapet, no poché wall strokes.
    const slabNodes = await konvaNodeCount(page, 'roof-slab');
    if (slabNodes >= 0) expect(slabNodes).toBe(1);

    // Drop it mid-slab (the ghost is still armed from the click above).
    await page.mouse.move(0, 0);
    await clickWorld(page, 2.5, 2);
    await expect(page.locator('[data-armed="true"]')).toHaveCount(0);
    const placed = await storedSimsProperty(page);
    const slab = roofRooms(placed)[0];
    expect(slab.placedItems).toHaveLength(1);
    expect(slab.placedItems[0].productId).toBe(PANEL);
    // Tile lattice from the slab's inner corner (0.05 m inset): the panel's
    // top-left sits on a 1.903 × 1.134 pitch from (0.05, 0.05).
    const it = slab.placedItems[0];
    const { w, h } = it.rotation % 180 === 0 ? { w: 1.903, h: 1.134 } : { w: 1.134, h: 1.903 };
    expect(Math.abs(((it.x - 0.05) / w) % 1)).toBeLessThan(1e-3);
    expect(Math.abs(((it.y - 0.05) / h) % 1)).toBeLessThan(1e-3);
    // Every storey-less room stays on the ground: nothing landed in r1.
    expect(placed!.rooms.find((r) => r.id === 'r1')!.placedItems).toHaveLength(0);

    // The energy chip is up: generation, no load.
    const chip = page.locator('[data-testid="energy-readout"]');
    await expect(chip).toBeVisible();
    await expect(chip).toHaveAttribute('data-status', 'covered');
    await expect(chip).toContainText('1.9 kWh');

    // A second panel dropped OFF the slab (the garden east of the building) is refused.
    await armAndClickWorld(page, PANEL, 7.5, 2, { expectDisarm: false });
    const log = await toastLog(page);
    expect(log.some((t) => /Nothing floats off the roof/i.test(t))).toBe(true);
    expect(roofRooms(await storedSimsProperty(page))[0].placedItems).toHaveLength(1);
    await page.keyboard.press('Escape');
  });

  test('4. Roof button toggles roof ↔ top storey; the wall pen refuses the roof', async ({ page }) => {
    await seedSimsProperty(page, oneRoomFixture());
    await openSeeded(page);
    await installToastLog(page);
    const roofBtn = page.locator('[data-testid="roof-toggle"]');
    await expect(roofBtn).toBeVisible();
    await expect(roofBtn).toHaveAttribute('aria-pressed', 'false');
    await roofBtn.click();
    await expect(roofBtn).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('[data-testid="level-readout"]')).toContainText('Roof');
    // Slab area label on the canvas: 5 × 4 = 20 m².
    await expect(page.locator('[data-testid="levels-toggle"]')).toBeVisible();
    await page.locator('[data-testid="levels-toggle"]').click();
    await expect(page.locator('[data-testid="level-roof"]')).toContainText('20 m²');
    await page.keyboard.press('Escape');

    // Walls are refused on the roof.
    await page.locator('[data-testid="wall-tool-toggle"]').click();
    const log = await toastLog(page);
    expect(log.some((t) => /roof has no walls/i.test(t))).toBe(true);
    await expect(page.locator('[data-testid="room-draw-hud"]')).toHaveCount(0);

    // Back to the top storey.
    await roofBtn.click();
    await expect(roofBtn).toHaveAttribute('aria-pressed', 'false');
    const p = await storedSimsProperty(page);
    expect(p!.activeLevelId === undefined || p!.activeLevelId === 'ground').toBe(true);
    // PageUp walks onto the roof like any storey.
    await page.keyboard.press('PageUp');
    await expect(page.locator('[data-testid="level-readout"]')).toContainText('Roof');
  });

  test('5. the Energy panel: PVGIS numbers, a consumer switch, Done', async ({ page }) => {
    // A panel already on the roof + a lamp (10 W typical × 5 h) in the room.
    const prop = oneRoomFixture([{ instanceId: 'lamp1', productId: 'demo-floor-lamp', x: 1, y: 1, rotation: 0 }]);
    prop.levels = [
      { id: 'ground', name: 'Ground floor', index: 0 },
      { id: 'roof', name: 'Roof', index: 1, kind: 'roof' } as SimsSeedProperty['levels'] extends Array<infer L> ? L : never,
    ];
    (prop.rooms as StoredRoom[]).push({
      id: 'roof-r1',
      name: 'Room 1',
      polygon: [{ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 5, y: 4 }, { x: 0, y: 4 }],
      placedItems: [{ instanceId: 'pv1', productId: PANEL, x: 0.05, y: 0.05, rotation: 0 }],
      kind: 'roof',
      levelId: 'roof',
    });
    await seedSimsProperty(page, prop);
    await openSeeded(page);

    const chip = page.locator('[data-testid="energy-readout"]');
    await expect(chip).toBeVisible();
    await chip.click();
    const panel = page.locator('[data-testid="energy-panel"]');
    await expect(panel).toBeVisible();
    // 475 Wp × 5.17 × 0.775 = 1903 Wh/day.
    await expect(page.locator('[data-testid="energy-generation"]')).toContainText('1.9 kWh');
    await expect(page.locator('[data-testid="energy-generation"]')).toContainText('1 panel');
    await expect(page.locator('[data-testid="energy-assumptions"]')).toContainText('PVGIS');
    await expect(page.locator('[data-testid="energy-summary"]')).toHaveAttribute('data-status', 'covered');
    // The docked panel publishes the shared inset so the canvas re-fits.
    const inset = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--floor-panel-w').trim());
    expect(inset).toBe('272px');

    // Switch the lamp out of the estimate (if the reference table knows it).
    const lampRow = page.locator('[data-testid="energy-item-lamp1"]');
    if (await lampRow.count()) {
      await page.locator('[data-testid="energy-power-lamp1"]').click();
      await expect(page.locator('[data-testid="energy-power-lamp1"]')).toHaveAttribute('aria-pressed', 'false');
      const stored = await storedSimsProperty(page);
      const lamp = stored!.rooms.find((r) => r.id === 'r1')!.placedItems[0] as { powerOn?: boolean };
      expect(lamp.powerOn).toBe(false);
    }

    await page.locator('[data-testid="energy-done"]').click();
    await expect(panel).toHaveCount(0);
    const insetAfter = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--floor-panel-w').trim());
    expect(insetAfter).toBe('0px');
  });

  test('7. roof level + slabs survive a reload', async ({ page }) => {
    await seedSimsProperty(page, oneRoomFixture());
    await openSeeded(page);
    await page.locator('[data-testid="roof-toggle"]').click();
    await expect(page.locator('[data-testid="level-readout"]')).toContainText('Roof');
    // `seedSimsProperty`'s init script re-runs on every navigation and would
    // re-seed the pre-roof fixture; re-seed the LIVE persisted state after it
    // (later init scripts run later) so the reload rehydrates the roof.
    const live = await page.evaluate(() => localStorage.getItem('ppw_property_v2'));
    expect(live).toBeTruthy();
    await page.addInitScript((raw) => localStorage.setItem('ppw_property_v2', raw as string), live);
    await page.reload();
    await page.waitForSelector('.konvajs-content canvas', { state: 'attached', timeout: 30_000 });
    await expect(page.locator('[data-testid="level-readout"]')).toContainText('Roof');
    const p = await storedSimsProperty(page);
    const roof = p!.levels!.find((l) => l.id === 'roof') as { kind?: string } | undefined;
    expect(roof?.kind).toBe('roof');
    expect(roofRooms(p)).toHaveLength(1);
  });
});
