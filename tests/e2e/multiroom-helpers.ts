/**
 * Shared fixtures + helpers for the attached multi-room e2e specs
 * (multiroom-render / multiroom-placement / multiroom-attach).
 *
 * Not a spec — the filename deliberately does NOT match Playwright's
 * `**\/*.@(spec|test).ts` testMatch, so it is imported, never collected.
 *
 * Three things here are load-bearing and were each a trap during the
 * 2026-08-26 build:
 *
 *  1. Polygons are OPEN rings — never repeat the first vertex.
 *     `propertyStore.cleanPolygon` strips a trailing duplicate, but the
 *     seed bypasses the store entirely (it writes localStorage directly),
 *     so a closed ring would hydrate with a degenerate zero-length edge.
 *  2. `id` / `name` are mandatory on the Property. Nothing repairs a v2
 *     payload on load — the persist `migrate()` early-returns for
 *     version >= 2 — so a malformed seed hydrates SILENTLY broken.
 *  3. The seed must be wrapped in the zustand persist envelope
 *     `{ state: {...}, version: 2 }`. A raw property JSON hydrates to
 *     nothing and the app falls back to a blank default property.
 */

import type { Page } from '@playwright/test';
import { ROOM_BORDER_SCAN } from '../../src/designer/blueprintTheme';

/** propertyStore default; a fresh session never zooms. */
export const PX_PER_M = 100;

export interface SeedItem {
  instanceId: string;
  productId: string;
  x: number;
  y: number;
  rotation: number;
}

export interface SeedRoom {
  id: string;
  name: string;
  polygon: Array<{ x: number; y: number }>;
  placedItems: SeedItem[];
}

export interface SeedProperty {
  id: string;
  name: string;
  activeRoomId: string;
  rooms: SeedRoom[];
}

/**
 * Two 5×4 / 4×4 m rooms sharing the x = 5 wall. Union spans x 0→9, y 0→4
 * (900 × 400 px at PX_PER_M = 100), which at a 1920×1080 viewport fits
 * inside `stageW - 80` so the auto-centre fit clamps scale to 1.
 */
export const TWO_ROOM_FIXTURE: SeedProperty = {
  id: 'prop-e2e',
  name: 'E2E Property',
  activeRoomId: 'r1',
  rooms: [
    {
      id: 'r1',
      name: 'Room 1',
      polygon: [{ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 5, y: 4 }, { x: 0, y: 4 }],
      placedItems: [],
    },
    {
      id: 'r2',
      name: 'Room 2',
      polygon: [{ x: 5, y: 0 }, { x: 9, y: 0 }, { x: 9, y: 4 }, { x: 5, y: 4 }],
      placedItems: [],
    },
  ],
};

/** Deep clone so a test mutating a fixture can never leak into another. */
export function cloneFixture(p: SeedProperty): SeedProperty {
  return JSON.parse(JSON.stringify(p)) as SeedProperty;
}

/**
 * Seed the property store via the persist envelope, and pre-dismiss the
 * first-visit coach dialog (it overlays the canvas and eats clicks).
 *
 * NOTE: `addInitScript` re-runs on EVERY navigation in the page, so a
 * "clear storage + reload" inside a seeded test just re-seeds. A test
 * that needs a genuinely blank canvas must be its own `test()` that only
 * calls `seedCoachFlagOnly`.
 */
export async function seedProperty(page: Page, prop: SeedProperty): Promise<void> {
  await page.addInitScript((p) => {
    localStorage.clear();
    localStorage.setItem('ppw_designer_coach_v1', '1');
    localStorage.setItem(
      'ppw_property_v2',
      JSON.stringify({
        state: { property: p, showGrid: true, pxPerMetre: 100 },
        version: 2,
      }),
    );
  }, prop);
}

/** Blank canvas — coach flag only, NO property seed. */
export async function seedCoachFlagOnly(page: Page): Promise<void> {
  await page.addInitScript(() => {
    localStorage.clear();
    localStorage.setItem('ppw_designer_coach_v1', '1');
  });
}

/**
 * World metres → page pixels, read from the canvas's live Konva transform via
 * the DEV-only `window.__ppwGeom` bridge (`src/lib/geomBridge.ts`).
 *
 * This is the coordinate basis every spec should use. It supersedes the gold
 * pixel-scan below, which breaks SILENTLY once the canvas gains warm floor
 * materials or gold door symbols: the scan latches onto the wrong pixel, the
 * spec still passes, and it asserts against a coordinate frame that is quietly
 * wrong. Geometry cannot drift that way.
 *
 * Returns null when the bridge is absent (a production build) so callers can
 * fall back to the scan.
 */
export async function worldToScreen(
  page: Page,
  xM: number,
  yM: number,
): Promise<{ x: number; y: number } | null> {
  return page.evaluate(
    ([x, y]) => {
      const g = (window as unknown as {
        __ppwGeom?: {
          ready: () => boolean;
          worldToScreen: (a: number, b: number) => { x: number; y: number } | null;
        };
      }).__ppwGeom;
      if (!g || !g.ready()) return null;
      return g.worldToScreen(x as number, y as number);
    },
    [xM, yM],
  );
}

/** Every room's world-metre AABB, straight from the store via the dev bridge. */
export async function geomRooms(page: Page): Promise<
  Array<{ id: string; name: string; minX: number; minY: number; maxX: number; maxY: number; vertices: number }>
> {
  return page.evaluate(() => {
    const g = (window as unknown as {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      __ppwGeom?: { ready: () => boolean; rooms: () => any[] };
    }).__ppwGeom;
    if (!g || !g.ready()) return [];
    return g.rooms();
  });
}

/**
 * Count of MOUNTED `.room-poly` Konva nodes — the render-side room count,
 * which is what the `[multi-room] rendered=N` breadcrumb reports. Reading the
 * mounted nodes (rather than the store) is the whole point: a store-side count
 * goes green even when the canvas still draws one room.
 */
export async function renderedRoomCount(page: Page): Promise<number> {
  return page.evaluate(() => {
    const g = (window as unknown as {
      __ppwGeom?: { ready: () => boolean; renderedRoomCount: () => number };
    }).__ppwGeom;
    if (!g || !g.ready()) return -1;
    return g.renderedRoomCount();
  });
}

/** Vertices currently in flight in room-draw mode, via the dev bridge. */
export async function drawVertexCount(page: Page): Promise<number> {
  return page.evaluate(() => {
    const g = (window as unknown as {
      __ppwGeom?: { ready: () => boolean; drawVertexCount: () => number };
    }).__ppwGeom;
    if (!g) return -1;
    return g.drawVertexCount();
  });
}

/**
 * Find the leftmost/topmost WALL pixel on the first Konva layer canvas and
 * return it in page pixels. Since the paper theme (2026-08-29) the wall is
 * charcoal, the predicate is `ROOM_BORDER_SCAN` from blueprintTheme, and
 * every spec (wall-aware-placement included) imports THIS helper rather than
 * carrying its own scan, so the tolerance can never drift.
 *
 * For every fixture in this suite the union fit clamps scale to 1 and
 * room 1's min corner is world (0, 0), so the scanned origin IS world
 * (0, 0) and `screen = origin + world * PX_PER_M`.
 *
 * Re-read this before every click sequence — panels opening can re-centre
 * the viewport between placements.
 */
export async function roomOrigin(page: Page): Promise<{ x: number; y: number }> {
  // Preferred path: ask the canvas for its OWN world→screen transform.
  // Exact by construction and immune to palette changes. The colour scan
  // below stays only as a fallback for a build without the dev bridge.
  const viaGeom = await worldToScreen(page, 0, 0);
  if (viaGeom) return viaGeom;

  const found = await page.evaluate((scan) => {
    const c = document.querySelector('.konvajs-content canvas') as HTMLCanvasElement | null;
    if (!c) return null;
    const ctx = c.getContext('2d');
    if (!ctx) return null;
    const img = ctx.getImageData(0, 0, c.width, c.height).data;
    let minX = Infinity;
    let minY = Infinity;
    for (let y = 0; y < c.height; y += 2) {
      for (let x = 0; x < c.width; x += 2) {
        const i = (y * c.width + x) * 4;
        // Paper theme (2026-08-29): walls are CHARCOAL — all three channels
        // below the band max; the cream ground / paper floor / grid never
        // get there.
        if (
          img[i + 3] > scan.minAlpha
          && img[i] < scan.max
          && img[i + 1] < scan.max
          && img[i + 2] < scan.max
        ) {
          if (x < minX) minX = x;
          if (y < minY) minY = y;
        }
      }
    }
    if (!Number.isFinite(minX)) return null;
    const rect = c.getBoundingClientRect();
    const scale = c.width / rect.width;
    return {
      x: rect.x + minX / scale + scan.inset,
      y: rect.y + minY / scale + scan.inset,
    };
  }, ROOM_BORDER_SCAN);
  if (!found) throw new Error('Room border not found on the Konva layer canvas');
  return found;
}

/**
 * Horizontal span, in page px, between the leftmost and rightmost gold
 * wall pixels on the first Konva layer canvas. A single-room render of
 * TWO_ROOM_FIXTURE spans ~500 px; both rooms span ~900 px.
 */
export async function goldSpanPx(page: Page): Promise<number | null> {
  return page.evaluate((scan) => {
    const c = document.querySelector('.konvajs-content canvas') as HTMLCanvasElement | null;
    if (!c) return null;
    const ctx = c.getContext('2d');
    if (!ctx) return null;
    const img = ctx.getImageData(0, 0, c.width, c.height).data;
    let minX = Infinity;
    let maxX = -Infinity;
    for (let y = 0; y < c.height; y += 2) {
      for (let x = 0; x < c.width; x += 2) {
        const i = (y * c.width + x) * 4;
        if (
          img[i + 3] > scan.minAlpha
          && img[i] < scan.max
          && img[i + 1] < scan.max
          && img[i + 2] < scan.max
        ) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
        }
      }
    }
    if (!Number.isFinite(minX) || !Number.isFinite(maxX)) return null;
    const rect = c.getBoundingClientRect();
    const scale = c.width / rect.width;
    // Both extremes are stroke CENTRES once the half-stroke is trimmed
    // off each side, so the span measures wall-line to wall-line.
    return (maxX - minX) / scale - scan.inset * 2;
  }, ROOM_BORDER_SCAN);
}

/**
 * Page-pixel position of world (0, 0) on a canvas with NO room drawn.
 *
 * `roomOrigin` scans for gold wall pixels and therefore cannot work on a
 * blank canvas. With no drawn room the auto-centre effect returns early
 * (there is no union to fit), so the viewport is the identity transform and
 * world (0, 0) is simply the canvas element's top-left corner.
 */
export async function canvasOrigin(page: Page): Promise<{ x: number; y: number }> {
  const found = await page.evaluate(() => {
    const c = document.querySelector('.konvajs-content canvas') as HTMLCanvasElement | null;
    if (!c) return null;
    const rect = c.getBoundingClientRect();
    return { x: rect.x, y: rect.y };
  });
  if (!found) throw new Error('Konva layer canvas not found');
  return found;
}

/**
 * Committed interior walls. NOTE: wallStore does NOT use zustand's persist
 * middleware — it hand-rolls localStorage under `ppw_walls_v1` and stores a
 * BARE ARRAY, not a `{state, version}` envelope.
 */
export async function storedWallCount(page: Page): Promise<number> {
  return page.evaluate(() => {
    try {
      const raw = localStorage.getItem('ppw_walls_v1');
      if (!raw) return 0;
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.length : 0;
    } catch {
      return 0;
    }
  });
}

/** The persisted property, read straight out of localStorage. */
export async function storedProperty(page: Page): Promise<SeedProperty | null> {
  return page.evaluate(() => {
    const raw = localStorage.getItem('ppw_property_v2');
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw) as { state?: { property?: unknown } };
      return (parsed.state?.property ?? null) as never;
    } catch {
      return null;
    }
  });
}

/** Number of history frames in the sessionStorage top-10 mirror. */
export async function historyFrameCount(page: Page): Promise<number> {
  return page.evaluate(() => {
    try {
      const raw = sessionStorage.getItem('ppw_history_top10_v1');
      const parsed = JSON.parse(raw ?? '[]');
      return Array.isArray(parsed) ? parsed.length : 0;
    } catch {
      return 0;
    }
  });
}

/**
 * Collect `[multi-room] rendered=N` breadcrumbs. MUST be called BEFORE
 * `page.goto` — the log fires on mount. It re-fires only on room
 * MUTATIONS (add / rename / polygon change); grid toggles and pan/zoom
 * do not re-trigger it.
 */
export function collectRenderedCounts(page: Page): number[] {
  const seen: number[] = [];
  page.on('console', (msg) => {
    const text = msg.text();
    const m = /\[multi-room\]\s+rendered=(\d+)/.exec(text);
    if (m) seen.push(Number(m[1]));
  });
  return seen;
}

/** Poll until a `rendered=N` breadcrumb with the expected count arrives. */
export async function waitForRenderedCount(
  page: Page,
  counts: number[],
  expected: number,
  timeoutMs = 15_000,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (counts.includes(expected)) return;
    await page.waitForTimeout(150);
  }
  throw new Error(
    `Timed out waiting for [multi-room] rendered=${expected}; saw [${counts.join(', ')}]`,
  );
}

/**
 * Open the designer with a room on the canvas and the coach dialog dismissed.
 *
 * Two changes broke a lot of older specs at once, and both are SETUP problems
 * rather than assertion problems:
 *
 *  1. BLANK CANVAS ON OPEN (2026-06-09, hardened by 80fe1c5 2026-08-25). A
 *     fresh designer holds ONE room with an EMPTY polygon, so `findRoomAt`
 *     returns null and every drop is rejected as "outside the plan". Specs
 *     written before that assumed a 5x4 m room was already there.
 *  2. The first-visit CoachMark is a fixed inset-0 `role="dialog"` at
 *     z-index 9999 and INTERCEPTS pointer events on the TopBar, so a click on
 *     a toolbar button times out with "dialog intercepts pointer events".
 *
 * Note `?fresh=1` is inert — no code in src/ reads that param — so specs using
 * it were relying on something that never existed.
 */
export async function openDesignerWithRoom(page: Page): Promise<void> {
  await page.addInitScript(() => {
    try {
      localStorage.clear();
      localStorage.setItem('ppw_designer_coach_v1', '1');
    } catch {
      /* private mode — ignore */
    }
  });
  await page.goto('/designer');
  await page.locator('[data-testid="start-quick-rectangle"]').click();
  await page.waitForSelector('[data-testid="items-placed"]', { timeout: 15_000 });
}

/** Dismiss the coach dialog without seeding a room (blank-canvas specs). */
export async function dismissCoach(page: Page): Promise<void> {
  await page.addInitScript(() => {
    try {
      localStorage.setItem('ppw_designer_coach_v1', '1');
    } catch {
      /* ignore */
    }
  });
}

/**
 * Skip unless the DEV geometry bridge is present.
 *
 * `window.__ppwGeom` is installed only under `import.meta.env.DEV`, so it is
 * absent from any production build by design (see src/lib/geomBridge.ts). The
 * specs that derive click coordinates from it therefore cannot run against
 * production — report that honestly, and name the command that DOES run them,
 * so this is a routing note rather than silently dead coverage.
 *
 * Call AFTER navigating. The bridge is installed from a dynamic import, so
 * this polls rather than racing the first tick.
 */
export async function requireGeomBridge(page: Page): Promise<boolean> {
  return page
    .waitForFunction(
      () => Boolean((window as unknown as { __ppwGeom?: unknown }).__ppwGeom),
      undefined,
      { timeout: 5_000 },
    )
    .then(() => true)
    .catch(() => false);
}

/** The message every geom-bridge-dependent spec skips with. */
export const GEOM_BRIDGE_SKIP =
  'needs the DEV geometry bridge (window.__ppwGeom), which production does not ship: '
  + 'npm run dev -- --port 5187 && PPW_E2E_BASE_URL=http://localhost:5187 npx playwright test';

/**
 * True when the target has no Vercel functions behind it.
 *
 * `vite dev` serves the SPA but not `/api/*` — those are Vercel serverless
 * functions — so an API assertion against localhost fails for a reason that
 * has nothing to do with the app. Skip there, and ONLY there: against a
 * deployed target this returns false, so a genuine API regression still fails
 * loudly. Never widen this to mask a production failure.
 */
export function targetHasNoApi(baseURL: string | undefined): boolean {
  return /localhost|127\.0\.0\.1/.test(baseURL ?? '');
}

export const NO_API_SKIP =
  'needs a deployed target with Vercel functions — vite dev does not serve /api/*: '
  + 'PPW_E2E_BASE_URL=https://designer.ppwellness.co npx playwright test';
