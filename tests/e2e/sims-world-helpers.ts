/**
 * Helpers for `sims-world.spec.ts` (Sims world build, 2026-08-29).
 *
 * Not a spec — the filename does not match Playwright's testMatch, so it is
 * imported, never collected. Deliberately a SEPARATE file from
 * `multiroom-helpers.ts`: that file is shared by many specs and owned by
 * the integrator; this one only needs the wider property shape the Sims
 * world added (item rotation/lightOn, levels, free walls, land plot) and a
 * few gestures (arm-and-click, drag) that the older specs inline.
 */

import { expect, type Page } from '@playwright/test';
import { worldToScreen } from './multiroom-helpers';

export interface SimsSeedItem {
  instanceId: string;
  productId: string;
  x: number;
  y: number;
  rotation: number;
  lightOn?: boolean;
}

export interface SimsSeedRoom {
  id: string;
  name: string;
  polygon: Array<{ x: number; y: number }>;
  placedItems: SimsSeedItem[];
  levelId?: string;
  kind?: 'room' | 'outdoor';
}

export interface SimsFreeWall {
  id: string;
  a: { x: number; y: number };
  b: { x: number; y: number };
  thicknessM: number;
  levelId?: string;
}

export interface SimsSeedProperty {
  id: string;
  name: string;
  activeRoomId: string;
  rooms: SimsSeedRoom[];
  levels?: Array<{ id: string; name: string; index: number }>;
  activeLevelId?: string;
  walls?: SimsFreeWall[];
  site?: { widthM: number; depthM: number; originM: { x: number; y: number } } | null;
}

/** One 5 x 4 m room at the world origin — the fixture every test starts from. */
export function oneRoomFixture(items: SimsSeedItem[] = []): SimsSeedProperty {
  return {
    id: 'prop-sims-world',
    name: 'Sims World Property',
    activeRoomId: 'r1',
    rooms: [
      {
        id: 'r1',
        name: 'Room 1',
        polygon: [
          { x: 0, y: 0 },
          { x: 5, y: 0 },
          { x: 5, y: 4 },
          { x: 0, y: 4 },
        ],
        placedItems: items,
      },
    ],
  };
}

/**
 * Seed the property store via the zustand persist envelope and pre-dismiss
 * the first-visit coach dialog. Same envelope as `multiroom-helpers.
 * seedProperty`, but typed on the wider Sims-world property shape.
 *
 * `addInitScript` re-runs on every navigation, so a reload re-seeds.
 */
export async function seedSimsProperty(page: Page, prop: SimsSeedProperty): Promise<void> {
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

/** The persisted property (wide shape), straight out of localStorage. */
export async function storedSimsProperty(page: Page): Promise<SimsSeedProperty | null> {
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

/** Every placed item across every room, in room order. */
export async function allStoredItems(page: Page): Promise<SimsSeedItem[]> {
  const p = await storedSimsProperty(page);
  return p ? p.rooms.flatMap((r) => r.placedItems ?? []) : [];
}

/** Persisted snap unit from the designer UI store's own key. */
export async function storedPrecision(page: Page): Promise<string | null> {
  return page.evaluate(() => {
    try {
      const raw = localStorage.getItem('ppw_designer_ui_v1');
      if (!raw) return null;
      const parsed = JSON.parse(raw) as { state?: { precision?: string } };
      return parsed.state?.precision ?? null;
    } catch {
      return null;
    }
  });
}

/**
 * Wait for the DEV geom bridge to report a live Konva stage. `worldToScreen`
 * returns null until then, which reads as "bridge unavailable" when the
 * truth is "not yet".
 */
export async function waitForGeom(page: Page): Promise<void> {
  await page.waitForFunction(
    () => {
      const g = (window as unknown as { __ppwGeom?: { ready: () => boolean } }).__ppwGeom;
      return !!g && g.ready();
    },
    undefined,
    { timeout: 15_000 },
  );
}

/**
 * Skip-or-proceed test for the DEV geometry bridge, with a GENEROUS wait.
 *
 * `multiroom-helpers.requireGeomBridge` gives the bridge 5 s. On a shared
 * dev server under load (several Playwright runs at once) the first paint
 * alone can take longer than that, and a slow page then reads as "no
 * bridge" and SKIPS — a false skip that hides coverage. The bridge is a
 * dynamic import that lands right after the first render, so once the
 * Konva canvas is attached a 20 s wait can only fail on a build that does
 * not ship it (production). Same semantics, wider patience.
 */
export async function requireGeomBridgeGenerous(page: Page, timeoutMs = 20_000): Promise<boolean> {
  return page
    .waitForFunction(
      () => Boolean((window as unknown as { __ppwGeom?: unknown }).__ppwGeom),
      undefined,
      { timeout: timeoutMs },
    )
    .then(() => true)
    .catch(() => false);
}

/** World metres → page px, throwing (never silently null) when the bridge is absent. */
export async function screenAt(page: Page, xM: number, yM: number): Promise<{ x: number; y: number }> {
  const pt = await worldToScreen(page, xM, yM);
  if (!pt) throw new Error('geom bridge unavailable — run against a DEV server (npm run dev)');
  return pt;
}

/**
 * Assert a page point sits on the Konva stage element, so a click there
 * reaches the canvas rather than DOM chrome (dock, rails, top bar). A
 * silent off-stage click is the worst kind of false negative.
 */
export async function assertOnStage(page: Page, pt: { x: number; y: number }, label: string): Promise<void> {
  const rect = await page.evaluate(() => {
    const c = document.querySelector('.konvajs-content') as HTMLElement | null;
    if (!c) return null;
    const r = c.getBoundingClientRect();
    return { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
  });
  if (!rect) throw new Error('Konva stage container not found');
  expect(
    pt.x > rect.left && pt.x < rect.right && pt.y > rect.top && pt.y < rect.bottom,
    `${label} → page (${pt.x.toFixed(0)}, ${pt.y.toFixed(0)}) must be on the stage ${JSON.stringify(rect)}`,
  ).toBe(true);
}

/** Move to, then click, a WORLD point on the canvas. */
export async function clickWorld(page: Page, xM: number, yM: number): Promise<void> {
  const pt = await screenAt(page, xM, yM);
  await assertOnStage(page, pt, `world (${xM}, ${yM})`);
  await page.mouse.move(pt.x, pt.y, { steps: 4 });
  await page.mouse.click(pt.x, pt.y);
}

/**
 * Arm a product from the desktop dock (`data-product-id`) and drop it at a
 * WORLD point. Mirrors `placeAt` in wall-aware-placement.spec: the armed
 * count is 2 (dock tile + canvas container) and returns to 0 on commit.
 * The screen point is read AFTER arming — the viewport can re-centre.
 */
export async function armAndClickWorld(
  page: Page,
  productId: string,
  xM: number,
  yM: number,
  opts: { expectDisarm?: boolean } = {},
): Promise<void> {
  const card = page.locator(`[data-product-id="${productId}"]`).first();
  await expect(card).toBeVisible();
  await card.click();
  await expect(page.locator('[data-armed="true"]')).toHaveCount(2);
  const pt = await screenAt(page, xM, yM);
  await assertOnStage(page, pt, `world (${xM}, ${yM})`);
  await page.mouse.move(pt.x, pt.y, { steps: 8 });
  await page.mouse.click(pt.x, pt.y);
  if (opts.expectDisarm ?? true) {
    await expect(page.locator('[data-armed="true"]')).toHaveCount(0);
  }
}

/** Press-drag from one WORLD point to another with real CDP mouse events. */
export async function dragWorld(
  page: Page,
  from: { x: number; y: number },
  to: { x: number; y: number },
  steps = 8,
): Promise<void> {
  const a = await screenAt(page, from.x, from.y);
  const b = await screenAt(page, to.x, to.y);
  await assertOnStage(page, a, `drag start (${from.x}, ${from.y})`);
  await assertOnStage(page, b, `drag end (${to.x}, ${to.y})`);
  await page.mouse.move(a.x, a.y, { steps: 4 });
  await page.mouse.down();
  for (let i = 1; i <= steps; i++) {
    await page.mouse.move(a.x + ((b.x - a.x) * i) / steps, a.y + ((b.y - a.y) * i) / steps);
  }
  await page.mouse.up();
}

/**
 * Count MOUNTED Konva nodes by name on the live stage (`stage.find('.name')`).
 * Konva registers itself on `window.Konva`; returns -1 when it is not there
 * so a caller can fall back to a store-only assertion and SAY so, rather
 * than reading "0 nodes" as a passing render assertion.
 */
export async function konvaNodeCount(page: Page, name: string): Promise<number> {
  return page.evaluate((n) => {
    const K = (window as unknown as {
      Konva?: { stages?: Array<{ container: () => HTMLElement; find: (sel: string) => unknown[] }> };
    }).Konva;
    if (!K || !K.stages) return -1;
    for (const s of K.stages) {
      try {
        if (s.container().isConnected) return s.find(`.${n}`).length;
      } catch {
        /* disposed stage */
      }
    }
    return -1;
  }, name);
}

/**
 * Record every toast the page shows from now on, so a 2.4 s auto-dismiss
 * can never race an assertion: a slow machine that reaches the check after
 * the toast is gone would otherwise read "no refusal toast" as "not
 * refused". Idempotent per page load.
 */
export async function installToastLog(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as unknown as { __toastLog?: string[]; __toastObs?: MutationObserver };
    if (w.__toastObs) return;
    const log: string[] = (w.__toastLog = []);
    const sweep = () => {
      document.querySelectorAll('[data-testid="toast"]').forEach((el) => {
        const t = (el.textContent ?? '').trim();
        if (t && log[log.length - 1] !== t) log.push(t);
      });
    };
    w.__toastObs = new MutationObserver(sweep);
    w.__toastObs.observe(document.body, { childList: true, subtree: true, characterData: true });
    sweep();
  });
}

/** Every toast text seen since `installToastLog`, in order of appearance. */
export async function toastLog(page: Page): Promise<string[]> {
  return page.evaluate(() => (window as unknown as { __toastLog?: string[] }).__toastLog ?? []);
}
