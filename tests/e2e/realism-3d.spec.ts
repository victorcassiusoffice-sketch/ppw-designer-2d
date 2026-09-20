/**
 * 3D MODE P3 REALISM (2026-09-19/20) — Vic: "make sure the 3D version is
 * super high level. Just like the game The Sims … upgrade them to the
 * highest level, similar to higher level gaming."
 *
 * Pins (through the DEV bridge; all numbers are what the stage draws):
 *   1. colour truth holds on the NEW rig: a #808080 wall reads 0.78–1.04 of
 *      its hex on the far face; a laid #3A3A3A floor reads within ±8 of its
 *      swatch (the audit measured floors ×1.14 and a light floor clipped);
 *   2. the OUTSIDE of a room wall wears the exterior render, not the paint
 *      (the audit found the interior bleeding onto both faces);
 *   3. every wall is dressed — skirting, door leaves and frames, window
 *      frames and sills, corner shading — bodies stand on contact shadows,
 *      lamps exist, and floors carry their laid kind;
 *   4. the sun: off = the studio rig (no sun position); on = a real
 *      elevation for the hour, night below the horizon, and off again
 *      restores the studio rig;
 *   5. the Sims price on hover: with the brush armed the caption names the
 *      brush and what the click would buy (m² · L · money).
 *
 * Runs on a dev server (the bridge is DEV-only): PPW_E2E_BASE_URL=http://127.0.0.1:5199
 */
import { test, expect, type Page } from '@playwright/test';

test.describe.configure({ timeout: 180_000 });
const STAGE_TIMEOUT = 90_000;

type Hit = { kind: 'edge'; roomId: string; edgeIndex: number };
type Pt = { x: number; y: number } | null;
interface Bridge {
  backend: () => string;
  faceCount: () => number;
  wallScreenPoint: (h: Hit) => Pt;
  floorScreenPoint: (x: number, y: number) => Pt;
  hitAt: (x: number, y: number) => Hit | null;
  wallMaterial: (h: Hit) => { hex: string; baseHex: string; finish: string | null; show: string } | null;
  samplePixel: (x: number, y: number) => { r: number; g: number; b: number } | null;
  dressing: () => { joinery: number; shades: number; lamps: number; contactShadows: number; floors: Array<{ key: string; kind: string }> } | null;
  debug: () => { frames: number; hour: number | null; sun: { elevationDeg: number; azimuthDeg: number } | null };
}
// Inside page.evaluate only what the page has exists — spell the bridge out each time.

const GREY = [0, 1, 2, 3].map((edgeIndex) => ({ edgeIndex, paintId: 'permoglaze-matt-emulsion', colourHex: '#808080', colourName: 'Grey' }));

async function seedGreyRoom(page: Page): Promise<void> {
  await page.addInitScript((p) => {
    if (localStorage.getItem('__ppw_seeded') === '1') return;
    localStorage.clear();
    localStorage.setItem('__ppw_seeded', '1');
    localStorage.setItem('ppw_designer_coach_v1', '1');
    localStorage.setItem('ppw_property_v2', JSON.stringify({ state: { property: p, showGrid: true, pxPerMetre: 100 }, version: 2 }));
  }, {
    id: 'p',
    name: 'Vic',
    activeRoomId: 'r1',
    wallHeightM: 2.7,
    rooms: [{ id: 'r1', name: 'Room 1', polygon: [{ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 5, y: 4 }, { x: 0, y: 4 }], openings: [], placedItems: [], wallPaint: GREY, floorFinish: { materialId: 'gym-interlock' } }],
  });
}

async function open3D(page: Page, url: string): Promise<void> {
  await page.goto(url);
  await page.waitForSelector('.konvajs-content canvas', { state: 'attached', timeout: 30_000 });
  await page.waitForTimeout(600);
  await page.locator('[data-testid="view-mode-3d"]').click();
  await expect(page.locator('[data-testid="wallpaint-3d-overlay"]')).toBeVisible();
  await expect.poll(() => page.evaluate(() => (window as unknown as { __ppwRoomView3d: Bridge }).__ppwRoomView3d.faceCount()), { timeout: STAGE_TIMEOUT }).toBeGreaterThan(0);
  expect(await page.evaluate(() => (window as unknown as { __ppwRoomView3d: Bridge }).__ppwRoomView3d.backend())).toBe('gl');
  await expect.poll(() => page.evaluate(() => (window as unknown as { __ppwRoomView3d: Bridge }).__ppwRoomView3d.debug().frames), { timeout: STAGE_TIMEOUT }).toBeGreaterThan(0);
}

const settle = (page: Page) => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(1)))));

test.describe('3D Mode — P3 realism (desktop)', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('colour truth holds on walls AND floors; the outside of a wall is render, not paint; the room is dressed', async ({ page }) => {
    await seedGreyRoom(page);
    await open3D(page, '/designer?demo=off');
    await page.locator('[data-testid="view3d-walls-up"]').click();
    await page.waitForTimeout(500);
    await settle(page);
    // 1. The far wall (edge 0, its inner face towards the camera) reads its hex, lit.
    const wall = await page.evaluate(() => {
      const b = (window as unknown as { __ppwRoomView3d: Bridge }).__ppwRoomView3d;
      const h = { kind: 'edge' as const, roomId: 'r1', edgeIndex: 0 };
      const pt = b.wallScreenPoint(h)!;
      return { mat: b.wallMaterial(h), px: b.samplePixel(pt.x, pt.y) };
    });
    expect(wall.mat?.baseHex).toBe('#808080');
    for (const c of [wall.px!.r, wall.px!.g, wall.px!.b]) {
      expect(c).toBeGreaterThanOrEqual(Math.round(0x80 * 0.78));
      expect(c).toBeLessThanOrEqual(Math.round(0x80 * 1.04) + 3);
    }
    // 2. The near wall's OUTSIDE (edge 2's anchor faces the camera from outside in Walls Up) is the exterior render — light, not grey.
    const outside = await page.evaluate(() => {
      const b = (window as unknown as { __ppwRoomView3d: Bridge }).__ppwRoomView3d;
      const pt = b.wallScreenPoint({ kind: 'edge', roomId: 'r1', edgeIndex: 2 })!;
      return b.samplePixel(pt.x, pt.y + 30);
    });
    expect(outside!.r).toBeGreaterThan(170);
    // 1b. The floor (Walls Down, the room centre) reads its laid swatch #3A3A3A within ±8.
    await page.locator('[data-testid="view3d-walls-down"]').click();
    await page.waitForTimeout(500);
    await settle(page);
    const floor = await page.evaluate(() => {
      const b = (window as unknown as { __ppwRoomView3d: Bridge }).__ppwRoomView3d;
      const pt = b.floorScreenPoint(2.5, 2)!;
      return b.samplePixel(pt.x, pt.y);
    });
    for (const c of [floor!.r, floor!.g, floor!.b]) {
      expect(Math.abs(c - 0x3a)).toBeLessThanOrEqual(8);
    }
    // 3. Dressed: skirting on every wall, corner shading, the laid floor's kind.
    const d = (await page.evaluate(() => (window as unknown as { __ppwRoomView3d: Bridge }).__ppwRoomView3d.dressing()))!;
    expect(d.joinery).toBeGreaterThanOrEqual(4);
    expect(d.shades).toBeGreaterThanOrEqual(4);
    expect(d.floors).toEqual([{ key: 'floor-r1', kind: 'interlock' }]);
  });

  test('the show flat is dressed (doors, windows, lamps, contact shadows); the sun rig turns on, moves the sun, goes dark, and turns off', async ({ page }) => {
    await open3D(page, '/designer?demo=tintex');
    const d = (await page.evaluate(() => (window as unknown as { __ppwRoomView3d: Bridge }).__ppwRoomView3d.dressing()))!;
    expect(d.joinery).toBeGreaterThanOrEqual(12); // 12 skirtings + doors + windows shown
    expect(d.lamps).toBeGreaterThanOrEqual(3); // floor lamp, pendants, sconce
    expect(d.contactShadows).toBeGreaterThanOrEqual(1);
    expect(d.floors.map((f) => f.kind)).toEqual(['screed', 'screed', 'screed']);
    // Studio rig by default: no sun position.
    expect((await page.evaluate(() => (window as unknown as { __ppwRoomView3d: Bridge }).__ppwRoomView3d.debug())).sun).toBeNull();
    // Sun on: an afternoon sun, west of the flat, above the horizon.
    await page.locator('[data-testid="view3d-sun-toggle"]').click();
    await expect(page.locator('[data-testid="view3d-sun-hour"]')).toBeVisible();
    await expect(page.locator('[data-testid="view3d-sun-label"]')).toHaveText('15:30');
    await page.waitForTimeout(400);
    await settle(page);
    const afternoon = (await page.evaluate(() => (window as unknown as { __ppwRoomView3d: Bridge }).__ppwRoomView3d.debug())).sun!;
    expect(afternoon.elevationDeg).toBeGreaterThan(20);
    expect(afternoon.azimuthDeg).toBeGreaterThan(240);
    // Night: the sun is below the horizon.
    await page.locator('[data-testid="view3d-sun-hour"]').evaluate((el) => {
      const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
      set.call(el, '19.5');
      el.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await expect(page.locator('[data-testid="view3d-sun-label"]')).toHaveText('19:30');
    await page.waitForTimeout(400);
    const night = (await page.evaluate(() => (window as unknown as { __ppwRoomView3d: Bridge }).__ppwRoomView3d.debug())).sun!;
    expect(night.elevationDeg).toBeLessThan(-5);
    // Off: the studio rig again.
    await page.locator('[data-testid="view3d-sun-toggle"]').click();
    await expect(page.locator('[data-testid="view3d-sun-hour"]')).toHaveCount(0);
    expect((await page.evaluate(() => (window as unknown as { __ppwRoomView3d: Bridge }).__ppwRoomView3d.debug())).sun).toBeNull();
  });

  test('the Sims price on hover: with the brush armed the caption names the brush and the cost of the wall', async ({ page }) => {
    await open3D(page, '/designer?demo=tintex');
    await page.locator('[data-testid="wallpaint-tool-toggle"]').click();
    await page.waitForSelector('[data-testid="wallpaint-palette"]');
    await page.locator('[data-testid="wallpaint-tintex-vip-satin"]').click();
    await page.locator('[data-testid="wallpaint-colour-ral-7035"]').click();
    // A full wall of the bedroom whose hit test lands on it.
    const target = await page.evaluate(() => {
      const b = (window as unknown as { __ppwRoomView3d: Bridge }).__ppwRoomView3d;
      for (let e = 0; e < 4; e++) {
        const h = { kind: 'edge' as const, roomId: 'bedroom', edgeIndex: e };
        if (b.wallMaterial(h)?.show !== 'full') continue;
        const pt = b.wallScreenPoint(h);
        const hit = pt && b.hitAt(pt.x, pt.y);
        if (pt && hit && hit.roomId === 'bedroom' && hit.edgeIndex === e) return { e, ...pt };
      }
      return null;
    });
    expect(target).not.toBeNull();
    await page.mouse.move(target!.x, target!.y);
    await page.waitForTimeout(250);
    const caption = page.locator('[data-testid="wallpaint-3d-overlay"] [data-testid="wallpaint-3d-caption"]');
    await expect(caption).toContainText(`Bedroom · Wall ${target!.e + 1} → TintEX VIP Satin · Light grey ≈`);
    await expect(caption).toContainText(/≈ \d+\.\d m² · \d+\.\d L · Rs [\d,]+ — click to paint/);
  });
});
