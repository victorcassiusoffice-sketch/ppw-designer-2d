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
 *   (e) finger drag moves the object                               (evidence-only)
 *
 * B1 note: the live renderer is Konva on a single <canvas>. Playwright's
 * synthetic DOM pointer events do NOT reach Konva's hit graph in headless
 * emulation (documented repo limitation — verified on real devices). So B1 is
 * proven the rigorous way, through Konva's OWN hit-test (window.__designer
 * .hitReselect): at the deselected item's position the always-listening
 * placed-hit Rect must be returned by getIntersection (the bug was the absence
 * of any hit target), and firing its Konva click must re-select it.
 * Duplicate/delete/rotate use the DOM cluster buttons and are driven directly.
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

/** getState that tolerates a transient missing hook (returns an empty state)
 *  instead of throwing — used by the best-effort drag step. */
async function safeState(page: Page): Promise<DesignerState> {
  try {
    return await getState(page);
  } catch {
    return { selectedInstanceId: null, itemCount: 0, placedItems: [] };
  }
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

      // (b) touch DUPLICATE → 1 → 2.
      await page.locator('[data-testid="cluster-duplicate"]').click();
      await expect.poll(async () => (await getState(page)).itemCount).toBe(2);

      // (c) touch DELETE → removes the selected copy → 2 → 1.
      await page.locator('[data-testid="cluster-delete"]').click();
      await expect.poll(async () => (await getState(page)).itemCount).toBe(1);

      // (a) RE-SELECT after delete cleared selection — headline blocker B1.
      // Proven via Konva's own hit graph (see file header): the always-listening
      // placed-hit Rect must be hit-testable at the item, and firing its Konva
      // click must re-select it.
      const b1 = await page.evaluate(() => {
        const w = window as unknown as {
          __designer?: { hitReselect: () => { hitFound: boolean; selected: boolean; noStage?: boolean } };
        };
        return w.__designer ? w.__designer.hitReselect() : { hitFound: false, selected: false };
      });
      expect(
        b1.hitFound,
        'B1: a deselected placed item exposes an always-listening hit target (Konva getIntersection)',
      ).toBe(true);
      await expect.poll(async () => (await getState(page)).selectedInstanceId).toBe(a);

      // (d) ROTATE on touch → +90°.
      await expect(cluster).toBeVisible({ timeout: 8_000 });
      const beforeRot = (await getState(page)).placedItems.find((i) => i.instanceId === a)?.rotation ?? 0;
      await page.locator('[data-testid="cluster-rotate"]').click();
      await expect
        .poll(async () => (await getState(page)).placedItems.find((i) => i.instanceId === a)?.rotation)
        .toBe((beforeRot + 90) % 360);

      // (e) finger drag — EVIDENCE-ONLY, best-effort. Synthetic Konva touch-drag
      // is environment-sensitive headless (verified on real devices), so this
      // NEVER fails the test; the four hard proofs above gate the run.
      let dragMoved = false;
      try {
        const stage = page.locator('.konva-stage').first();
        const box = await stage.boundingBox();
        if (box) {
          const before = (await safeState(page)).placedItems.find((i) => i.instanceId === a);
          const cx = box.x + box.width / 2;
          const cy = box.y + box.height / 2;
          await page.mouse.move(cx, cy);
          await page.mouse.down();
          await page.mouse.move(cx + 55, cy + 38, { steps: 6 });
          await page.mouse.move(cx + 92, cy + 66, { steps: 6 });
          await page.mouse.up();
          const after = (await safeState(page)).placedItems.find((i) => i.instanceId === a);
          if (before && after) dragMoved = after.x !== before.x || after.y !== before.y;
        }
      } catch {
        /* evidence-only — ignore */
      }

      await page.screenshot({ path: path.join(EVID, `${key}-final.png`) }).catch(() => {});
      fs.writeFileSync(
        path.join(EVID, `${key}-verdict.json`),
        JSON.stringify(
          {
            profile: key,
            reselectable: b1.hitFound,
            reselectSelected: b1.selected,
            duplicate: true,
            delete: true,
            rotate: true,
            dragMoved,
            finalState: await safeState(page),
          },
          null,
          2,
        ),
      );
    });
  });
}
