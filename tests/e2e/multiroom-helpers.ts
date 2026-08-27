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
 * Find the leftmost/topmost gold wall pixel on the first Konva layer
 * canvas and return it in page pixels. Ported verbatim in behaviour from
 * `wall-aware-placement.spec.ts:46` (which owns the original), so the two
 * can never drift on the colour tolerance.
 *
 * For every fixture in this suite the union fit clamps scale to 1 and
 * room 1's min corner is world (0, 0), so the scanned origin IS world
 * (0, 0) and `screen = origin + world * PX_PER_M`.
 *
 * Re-read this before every click sequence — panels opening can re-centre
 * the viewport between placements.
 */
export async function roomOrigin(page: Page): Promise<{ x: number; y: number }> {
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
        if (
          img[i + 3] > 200
          && img[i] > scan.rMin
          && img[i + 1] >= scan.gMin
          && img[i + 1] <= scan.gMax
          && img[i + 2] < scan.bMax
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
          img[i + 3] > 200
          && img[i] > scan.rMin
          && img[i + 1] >= scan.gMin
          && img[i + 1] <= scan.gMax
          && img[i + 2] < scan.bMax
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
