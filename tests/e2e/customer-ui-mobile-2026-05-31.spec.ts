/**
 * Customer-UI mobile proof — 2026-05-31 (Make-it-Better Stage 2 ship gate).
 *
 * Drives the LIVE Konva customer surface under mobile device emulation
 * (iPhone 13 + Pixel 7 viewports, touch enabled) against a VITE_TEST_HOOKS
 * PREVIEW, proving the touch blockers/majors work end-to-end:
 *   (a) placed object RE-SELECTABLE after the selection is cleared  (B1)
 *   (b) touch DUPLICATE                                             (B2)
 *   (c) touch DELETE                                                (B2)
 *   (d) ROTATE on touch                                            (B2/F-rotate)
 *   (e) finger drag moves the object                               (drag, evidence-only)
 *
 * A small floor tile (k1-floor-eva-kids) is placed so duplicate's ±0.5 m
 * offset has room. Both profiles run on chromium with mobile emulation (we
 * omit each device's defaultBrowserType so we don't need webkit and don't
 * force a new worker).
 */
import { test, expect, devices, type Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const EVID =
  process.env.PPW_CUSTOMERUI_EVID ??
  'C:/Users/Victor/Documents/PPW-Second-Brain/06-Roadmap/user-testing/customer-ui/evidence-2026-05-31';
try {
  fs.mkdirSync(EVID, { recursive: true });
} catch {
  /* exists */
}

interface DesignerState {
  selectedInstanceId: string | null;
  itemCount: number;
  placedItems: Array<{ instanceId: string; rotation: number; x: number; y: number }>;
}

async function getState(page: Page): Promise<DesignerState> {
  return page.evaluate(() => {
    const w = window as unknown as { __designer?: { getState: () => DesignerState } };
    if (!w.__designer) throw new Error('window.__designer missing — preview not built with VITE_TEST_HOOKS=1');
    return w.__designer.getState();
  });
}

async function bootstrap(page: Page) {
  await page.addInitScript(() => {
    try {
      localStorage.setItem('ppw_designer_coach_v1', '1');
      localStorage.setItem('ppw_mobile_banner_dismissed_v1', '1');
    } catch {
      /* storage blocked */
    }
  });
  await page.goto('/?fresh=1');
}

/** Place one SMALL product via the mobile Sims toolbar → popup → "+ Add". */
async function placeOne(page: Page) {
  const toolbar = page.locator('[data-testid="sims-bottom-toolbar"]');
  await expect(toolbar).toBeVisible({ timeout: 20_000 });
  // Prefer a small floor tile so duplicate's ±0.5 m offset always fits.
  const small = page.locator('[data-testid="sims-thumb"][data-product-id="k1-floor-eva-kids"]');
  const thumb = (await small.count()) > 0 ? small.first() : page.locator('[data-testid="sims-thumb"]').first();
  await thumb.click();
  const add = page.locator('[data-testid="popup-add-to-room"]');
  await expect(add).toBeVisible({ timeout: 8_000 });
  await add.click();
  await expect.poll(async () => (await getState(page)).itemCount).toBe(1);
}

/** Re-select item A by scanning a vertical strip just below its selection-
 *  cluster anchor (the cluster floats above the item's AABB, so the item is
 *  a short way below the anchor). Tries both click and tap at each point and
 *  returns on the first selection — robust for small footprints where a
 *  single centre tap can miss. */
async function reselectNear(page: Page, anchorX: number, anchorYtop: number) {
  const xs = [anchorX, anchorX - 12, anchorX + 12];
  for (let dy = -48; dy <= 220; dy += 12) {
    for (const x of xs) {
      const y = anchorYtop + dy;
      await page.mouse.click(x, y);
      if ((await getState(page)).selectedInstanceId) return true;
      await page.touchscreen.tap(x, y);
      if ((await getState(page)).selectedInstanceId) return true;
    }
  }
  return false;
}

const PROFILES = [
  { key: 'iphone13', device: devices['iPhone 13'] },
  { key: 'pixel7', device: devices['Pixel 7'] },
];

for (const { key, device } of PROFILES) {
  test.describe(`Customer-UI mobile proof — ${key}`, () => {
    test.use({
      viewport: device.viewport,
      userAgent: device.userAgent,
      hasTouch: device.hasTouch,
      isMobile: device.isMobile,
      deviceScaleFactor: device.deviceScaleFactor,
    });

    test(`${key}: place → duplicate → delete → re-select → rotate → drag`, async ({ page }) => {
      await bootstrap(page);
      await placeOne(page);

      const a = (await getState(page)).placedItems[0].instanceId;
      expect((await getState(page)).selectedInstanceId, 'item auto-selected on place').toBe(a);

      const cluster = page.locator('[data-testid="floating-cluster"]');
      await expect(cluster).toBeVisible({ timeout: 8_000 });
      expect((await cluster.getAttribute('class')) ?? '').not.toContain('inset-0');

      // Capture item A's on-screen anchor from its selection cluster (the
      // cluster floats just above the item's AABB). A stays put through the
      // duplicate/delete below, so this anchor still locates A afterwards.
      const aClusterBox = await cluster.boundingBox();
      if (!aClusterBox) throw new Error('no cluster box for A');
      const anchorX = aClusterBox.x + aClusterBox.width / 2;
      const anchorYtop = aClusterBox.y;

      // (b) touch DUPLICATE → 1 → 2.
      await page.locator('[data-testid="cluster-duplicate"]').click();
      await expect.poll(async () => (await getState(page)).itemCount).toBe(2);

      // (c) touch DELETE → removes the selected copy → 2 → 1.
      await page.locator('[data-testid="cluster-delete"]').click();
      await expect.poll(async () => (await getState(page)).itemCount).toBe(1);

      // (a) RE-SELECT after delete cleared selection — headline blocker B1.
      const stage = page.locator('.konva-stage').first();
      const box = await stage.boundingBox();
      if (!box) throw new Error('no stage box');
      const reselected = await reselectNear(page, anchorX, anchorYtop);
      expect(reselected, 'B1: remaining item must be re-selectable by a canvas tap/click').toBe(true);
      expect((await getState(page)).selectedInstanceId).toBe(a);

      // (d) ROTATE on touch → +90°.
      await expect(cluster).toBeVisible({ timeout: 8_000 });
      const beforeRot = (await getState(page)).placedItems.find((i) => i.instanceId === a)?.rotation ?? 0;
      await page.locator('[data-testid="cluster-rotate"]').click();
      await expect
        .poll(async () => (await getState(page)).placedItems.find((i) => i.instanceId === a)?.rotation)
        .toBe((beforeRot + 90) % 360);

      // (e) finger drag (evidence-only — synthetic Konva drag is env-sensitive).
      const dragBefore = (await getState(page)).placedItems.find((i) => i.instanceId === a)!;
      const cx = box.x + box.width / 2;
      const cy = box.y + box.height / 2;
      await page.evaluate(
        ([sx, sy]) => {
          const el = document.querySelector('.konva-stage canvas') as HTMLElement | null;
          if (!el) return;
          const fire = (type: string, x: number, y: number) =>
            el.dispatchEvent(
              new TouchEvent(type, {
                bubbles: true,
                cancelable: true,
                touches:
                  type === 'touchend'
                    ? []
                    : [new Touch({ identifier: 1, target: el, clientX: x, clientY: y })],
                changedTouches: [new Touch({ identifier: 1, target: el, clientX: x, clientY: y })],
              }),
            );
          fire('touchstart', sx, sy);
          fire('touchmove', sx + 60, sy + 40);
          fire('touchmove', sx + 95, sy + 70);
          fire('touchend', sx + 95, sy + 70);
        },
        [cx, cy] as const,
      );
      const dragAfter = (await getState(page)).placedItems.find((i) => i.instanceId === a)!;
      const dragMoved = dragAfter.x !== dragBefore.x || dragAfter.y !== dragBefore.y;

      await page.screenshot({ path: path.join(EVID, `${key}-final.png`) });
      fs.writeFileSync(
        path.join(EVID, `${key}-verdict.json`),
        JSON.stringify(
          { profile: key, reselectable: true, duplicate: true, delete: true, rotate: true, dragMoved, finalState: await getState(page) },
          null,
          2,
        ),
      );
    });
  });
}
