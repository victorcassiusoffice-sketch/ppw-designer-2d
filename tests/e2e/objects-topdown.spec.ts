/**
 * Object top-down rendering (Vic 2026-08-29 backlog, fixed 2026-09-03:
 * "objects render as blank labelled boxes… it doesn't look right").
 *
 * Root cause was 34 MB of committed product PNGs (a single top-down up to
 * 4.6 MB): on any cold load the canvas sat in its fallback/skeleton state
 * for many seconds, which read as "no top-down art at all". Every
 * referenced asset is now a ≤640 px WebP (total 1.6 MB).
 *
 * Pins:
 *   1. a room seeded with NINE image-carrying products (the evidence set
 *      from docs/sims-world-2026-08-29/objects-topdown-2026-08-31/) renders
 *      an `.item-art` Konva image node for every floor item (wall-mounted
 *      shelf/mirror draw plan BARS by design) — no fallback boxes;
 *   2. imageless products draw plan symbols (lamp/tree), never blank;
 *   3. the catalog dock's product thumbnails actually load
 *      (naturalWidth > 0) — the same evidence capture had a blank dock.
 *
 * Run against a local dev server:
 *   PPW_E2E_BASE_URL=http://127.0.0.1:5188 npx playwright test objects-topdown
 */

import { test, expect, type Page } from '@playwright/test';

type Seed = Record<string, unknown>;

/**
 * The evidence-capture set of nine products. SEVEN draw top-down ART;
 * the wall shelf and wall mirror are wall-mounted, so in plan view they
 * draw as architectural BARS by design (a 5 cm-deep mirror from above is
 * a line, not a photo) - they must never show the fallback box either.
 */
const ART_COUNT = 7;
const NINE_IMAGE_ITEMS: Seed[] = [
  { instanceId: 'i1', productId: 'k1-nordictrack-2450', x: 0.5, y: 0.5, rotation: 0 },
  { instanceId: 'i2', productId: 'k1-schwinn-700ic', x: 4.0, y: 0.5, rotation: 0 },
  { instanceId: 'i3', productId: 'k1-bowflex-xtreme-2se', x: 6.5, y: 0.5, rotation: 0 },
  { instanceId: 'i4', productId: 'demo-console-table', x: 0.5, y: 3.5, rotation: 0 },
  { instanceId: 'i5', productId: 'demo-potted-plant', x: 4.0, y: 3.5, rotation: 0 },
  { instanceId: 'i6', productId: 'demo-wall-shelf', x: 6.5, y: 3.5, rotation: 0 },
  { instanceId: 'i7', productId: 'demo-aroma-diffuser', x: 0.5, y: 6.5, rotation: 0 },
  { instanceId: 'i8', productId: 'demo-wall-mirror', x: 4.0, y: 6.5, rotation: 0 },
  { instanceId: 'i9', productId: 'k1-bench-adjustable-fid', x: 6.5, y: 6.5, rotation: 0 },
];

async function seed(page: Page, placedItems: Seed[]): Promise<void> {
  const property = {
    id: 'p',
    name: 'Vic',
    activeRoomId: 'r1',
    rooms: [
      {
        id: 'r1',
        name: 'Room 1',
        polygon: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 9 }, { x: 0, y: 9 }],
        openings: [],
        placedItems,
      },
    ],
  };
  await page.addInitScript((p) => {
    if (localStorage.getItem('__ppw_seeded') === '1') return;
    localStorage.clear();
    localStorage.setItem('__ppw_seeded', '1');
    localStorage.setItem('ppw_designer_coach_v1', '1');
    localStorage.setItem(
      'ppw_property_v2',
      JSON.stringify({ state: { property: p, showGrid: true, pxPerMetre: 100 }, version: 2 }),
    );
  }, property);
}

/** Konva node counts on the live stage. */
async function stageCount(page: Page, selector: string): Promise<number> {
  return page.evaluate((sel) => {
    const K = (window as unknown as { Konva?: { stages: Array<{ find: (s: string) => unknown[] }> } })
      .Konva;
    if (!K || !K.stages.length) return -1;
    return K.stages[0].find(sel).length;
  }, selector);
}

test.describe('Object top-down rendering', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('all nine evidence products render their art — zero fallback boxes', async ({ page }) => {
    await seed(page, NINE_IMAGE_ITEMS);
    await page.goto('/designer');
    await page.waitForSelector('.konvajs-content canvas', { state: 'attached' });

    // Every placed product must hydrate to a real Konva image node. The
    // 15 s budget is generous — post-optimization the whole set is ~300 KB.
    await page.waitForFunction(
      (n) => {
        const K = (window as unknown as { Konva?: { stages: Array<{ find: (s: string) => unknown[] }> } })
          .Konva;
        return !!K && K.stages.length > 0 && K.stages[0].find('.item-art').length === n;
      },
      ART_COUNT,
      { timeout: 15_000 },
    );
    expect(await stageCount(page, '.item-art')).toBe(ART_COUNT);
  });

  test('imageless lamp + garden products draw plan symbols, not blank boxes', async ({ page }) => {
    await seed(page, [
      { instanceId: 'L1', productId: 'demo-floor-lamp', x: 1, y: 1, rotation: 0 },
      { instanceId: 'L2', productId: 'demo-garden-tree', x: 4, y: 4, rotation: 0 },
    ]);
    await page.goto('/designer');
    await page.waitForSelector('.konvajs-content canvas', { state: 'attached' });
    await page.waitForTimeout(800);
    // Plan symbols render as vector groups; there must be zero `.item-art`
    // images AND the items must exist (their labels are on the stage).
    expect(await stageCount(page, '.item-art')).toBe(0);
    const labels = await page.evaluate(() => {
      const K = (window as unknown as {
        Konva?: { stages: Array<{ find: (s: string) => Array<{ text?: () => string }> }> };
      }).Konva;
      if (!K || !K.stages.length) return [];
      return K.stages[0]
        .find('Text')
        .map((t) => (typeof t.text === 'function' ? t.text() : ''))
        .filter(Boolean);
    });
    expect(labels.join('|')).toContain('Arc Floor Lamp');
  });

  test('catalog dock thumbnails load (no blank tiles)', async ({ page }) => {
    await seed(page, []);
    await page.goto('/designer');
    await page.waitForSelector('.konvajs-content canvas', { state: 'attached' });
    await page.waitForTimeout(1000);
    const readProbe = () =>
      page.evaluate(() => {
        const imgs = Array.from(document.querySelectorAll('img')).filter((i) =>
          (i.getAttribute('src') ?? '').startsWith('/products/'),
        );
        return {
          total: imgs.length,
          loaded: imgs.filter((i) => i.naturalWidth > 0).length,
          webp: imgs.filter((i) => (i.getAttribute('src') ?? '').endsWith('.webp')).length,
        };
      });
    // "No blank tiles" means every thumbnail has DECODED PIXELS
    // (`naturalWidth > 0`) — that is what the 34 MB-PNG starvation defect
    // broke. It deliberately does NOT assert `img.complete`: the dock
    // thumbnails are `loading="lazy"` (SimsDock), so once the catalog grew
    // past a screenful (eco / solar 2026-09-04 took it to 41 products) the
    // off-screen tail reports `complete: false` with its dimensions already
    // known — a lazy-loading artefact, not a blank tile. Polled because the
    // last images can still be in flight a second after mount.
    await expect.poll(async () => {
      const q = await readProbe();
      return q.total > 5 && q.loaded === q.total;
    }, { timeout: 15_000 }).toBe(true);
    const probe = await readProbe();
    expect(probe.total).toBeGreaterThan(5);
    expect(probe.loaded).toBe(probe.total);
    // The catalog must be on the optimized assets.
    expect(probe.webp).toBe(probe.total);
  });
});
