/**
 * Wall pen on a phone — reproduction + verification (Vic 2026-09-05).
 *
 * Vic: "while still on the draw wall feature on the mobile version I needed
 * to zoom out and move over but the wall draw was still active and made me
 * draw random walls; when I pressed select tool i could not select the walls
 * to delete; Select toolbar should still be available on main screen rather
 * than only burger menu; wall pen toolbar at the bottom has some space
 * underneath, all toolbar should minimise space to maximise canvas."
 *
 * Drives a REAL touch device (CDP touch events, 390 x 844) and measures:
 *   A. two-finger pinch while the pen is armed  -> vertices added? (bug)
 *   B. one-finger drag to move the view         -> vertex added? (bug) and
 *                                                  did the view actually pan?
 *   C. Select tool on a free wall               -> selected / deletable?
 *   D. is there a Select control on the phone strip without the menu?
 *   E. dead space between the pen HUD and the toolbar below it
 *
 *   node tools/wallpen-mobile-repro-2026-09-05.mjs [outDir] [baseUrl]
 */
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const OUT = resolve(process.cwd(), process.argv[2] ?? 'docs/sims-world-2026-08-29/wallpen-mobile-2026-09-05');
const BASE = process.argv[3] ?? process.env.PPW_E2E_BASE_URL ?? 'http://127.0.0.1:5188';
mkdirSync(OUT, { recursive: true });

const ROOM = {
  id: 'prop-pen',
  name: 'Pen Demo',
  activeRoomId: 'r1',
  rooms: [{ id: 'r1', name: 'Studio', polygon: [{ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 5, y: 4 }, { x: 0, y: 4 }], placedItems: [] }],
};

async function open(browser) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  await ctx.addInitScript((p) => {
    localStorage.clear();
    localStorage.setItem('ppw_designer_coach_v1', '1');
    localStorage.setItem('ppw_property_v2', JSON.stringify({ state: { property: p, showGrid: true, pxPerMetre: 100 }, version: 2 }));
  }, ROOM);
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));
  page.__errors = errors;
  await page.goto(`${BASE}/designer`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.konvajs-content canvas', { state: 'attached', timeout: 45_000 });
  await page.waitForFunction(() => {
    const g = window.__ppwGeom;
    return !!g && g.ready();
  }, undefined, { timeout: 20_000 }).catch(() => {});
  await page.waitForTimeout(600);
  return page;
}

/** Raw CDP touch so we get true multi-touch (Playwright's touchscreen is single-point). */
async function touch(cdp, type, points) {
  await cdp.send('Input.dispatchTouchEvent', {
    type,
    touchPoints: points.map((p, i) => ({ x: p.x, y: p.y, id: i, radiusX: 12, radiusY: 12, force: 1 })),
  });
}

const vertices = (page) => page.evaluate(() => {
  // The pen's in-flight vertices live in the draw-progress store, mirrored
  // onto the HUD's readout; read the store through the debug bridge if it is
  // there, else count the committed walls.
  const raw = localStorage.getItem('ppw_property_v2');
  const p = raw ? JSON.parse(raw).state.property : null;
  return { walls: (p?.walls ?? []).length };
});

const hudVertexCount = (page) => page.evaluate(() => {
  const el = document.querySelector('[data-testid="room-draw-hud"]');
  if (!el) return null;
  const c = document.querySelector('[data-testid="room-draw-vertices-count"]');
  return c ? (c.textContent ?? '').trim() : (el.textContent ?? '').trim().slice(0, 60);
});

const view = (page) => page.evaluate(() => {
  const K = window.Konva;
  const s = K?.stages?.find((st) => st.container().isConnected);
  return s ? { x: Math.round(s.x()), y: Math.round(s.y()), scale: Number(s.scaleX().toFixed(3)) } : null;
});

const facts = {};
const browser = await chromium.launch();
try {
  const page = await open(browser);
  const cdp = await page.context().newCDPSession(page);
  const box = await page.locator('.konvajs-content').boundingBox();
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;

  // D. is there a Select control on the phone strip (no menu)?
  facts.D_selectOnStrip = await page.locator('header [data-testid="select-tool-toggle"]').isVisible().catch(() => false);
  facts.D_stripButtons = await page.locator('header button').evaluateAll((bs) => bs.map((b) => b.getAttribute('aria-label') || (b.textContent ?? '').trim()).filter(Boolean));

  // Arm the pen from the phone strip.
  await page.locator('[data-testid="room-draw-toggle"]').click();
  await page.waitForTimeout(500);
  facts.penOpen = await page.locator('[data-testid="room-draw-hud"]').count();
  const v0 = await view(page);

  // A. two-finger pinch (zoom out) while the pen is armed.
  const wallsBeforePinch = (await vertices(page)).walls;
  const hudBefore = await hudVertexCount(page);
  await touch(cdp, 'touchStart', [{ x: cx - 60, y: cy - 60 }, { x: cx + 60, y: cy + 60 }]);
  for (let i = 1; i <= 6; i++) {
    const d = 60 - i * 7;
    await touch(cdp, 'touchMove', [{ x: cx - d, y: cy - d }, { x: cx + d, y: cy + d }]);
    await page.waitForTimeout(40);
  }
  await touch(cdp, 'touchEnd', []);
  await page.waitForTimeout(400);
  facts.A_viewBefore = v0;
  facts.A_viewAfterPinch = await view(page);
  facts.A_hudBefore = hudBefore;
  facts.A_hudAfterPinch = await hudVertexCount(page);
  facts.A_wallsBefore = wallsBeforePinch;
  await page.screenshot({ path: resolve(OUT, 'A-after-pinch-390.png') });

  // B. one-finger drag to move the view.
  const vBeforeDrag = await view(page);
  const hudBeforeDrag = await hudVertexCount(page);
  await touch(cdp, 'touchStart', [{ x: cx - 80, y: cy + 40 }]);
  for (let i = 1; i <= 8; i++) {
    await touch(cdp, 'touchMove', [{ x: cx - 80 + i * 14, y: cy + 40 - i * 6 }]);
    await page.waitForTimeout(30);
  }
  await touch(cdp, 'touchEnd', []);
  await page.waitForTimeout(400);
  facts.B_hudBeforeDrag = hudBeforeDrag;
  facts.B_hudAfterDrag = await hudVertexCount(page);
  facts.B_viewBeforeDrag = vBeforeDrag;
  facts.B_viewAfterDrag = await view(page);
  await page.screenshot({ path: resolve(OUT, 'B-after-one-finger-drag-390.png') });

  // E. dead space under the pen HUD.
  facts.E_gapUnderHud = await page.evaluate(() => {
    const hud = document.querySelector('[data-testid="room-draw-hud"]');
    const bar = document.querySelector('[data-testid="sims-bottom-toolbar"]');
    if (!hud) return null;
    const h = hud.getBoundingClientRect();
    const b = bar ? bar.getBoundingClientRect() : { top: window.innerHeight };
    return { hudBottom: Math.round(h.bottom), barTop: Math.round(b.top), gapPx: Math.round(b.top - h.bottom), viewportH: window.innerHeight };
  });

  // F. a PLAIN TAP must still drop a vertex — the fix must not kill drawing.
  const tapPts = [
    { x: cx - 60, y: cy - 40 },
    { x: cx + 50, y: cy - 40 },
    { x: cx + 50, y: cy + 50 },
  ];
  for (const t of tapPts) {
    await page.touchscreen.tap(t.x, t.y);
    await page.waitForTimeout(250);
  }
  facts.F_hudAfterThreeTaps = await hudVertexCount(page);
  await page.screenshot({ path: resolve(OUT, 'F-three-taps-390.png') });

  // Finish the run so there are free walls to select, then C.
  const done = page.locator('[data-testid="room-draw-finish-walls"]');
  if (await done.count()) await done.first().click();
  else await page.keyboard.press('Escape');
  await page.waitForTimeout(700);
  facts.C_wallsAfterDone = (await vertices(page)).walls;
  await page.screenshot({ path: resolve(OUT, 'C-walls-drawn-390.png') });

  // C. Select tool → tap a wall → card → Delete.
  const w = await page.evaluate(() => {
    const raw = localStorage.getItem('ppw_property_v2');
    const p = raw ? JSON.parse(raw).state.property : null;
    const wall = (p?.walls ?? [])[0];
    if (!wall) return null;
    const mid = { x: (wall.a.x + wall.b.x) / 2, y: (wall.a.y + wall.b.y) / 2 };
    const pt = window.__ppwGeom?.worldToScreen(mid.x, mid.y);
    return pt ? { id: wall.id, ...pt } : null;
  });
  facts.C_firstWallMidpoint = w;
  if (w) {
    const stripSelect = page.locator('[data-testid="select-tool-toggle-phone"]');
    facts.C_selectOnStrip = await stripSelect.isVisible().catch(() => false);
    if (facts.C_selectOnStrip) await stripSelect.click();
    else {
      await page.locator('header button[aria-label="Open menu"]').first().click();
      await page.waitForTimeout(400);
      await page.locator('[data-testid="select-tool-toggle-mobile"]').first().click();
      await page.waitForTimeout(400);
    }
    await page.touchscreen.tap(w.x, w.y);
    await page.waitForTimeout(500);
    facts.C_cardVisible = await page.locator('[data-testid="wall-selected-card"]').isVisible().catch(() => false);
    facts.C_cardLength = await page.locator('[data-testid="wall-selected-length"]').textContent().catch(() => null);
    // Let the "walls added" toast expire so the capture shows the card alone.
    await page.waitForTimeout(4500);
    facts.C_cardClearOfHelp = await page.evaluate(() => {
      const c = document.querySelector('[data-testid="wall-selected-card"]');
      const help = document.querySelector('[data-testid="help-launcher"], button[aria-label*="Help" i]');
      if (!c || !help) return null;
      const a = c.getBoundingClientRect(); const b = help.getBoundingClientRect();
      return { overlaps: !(a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top) };
    });
    await page.screenshot({ path: resolve(OUT, 'C-wall-selected-390.png') });
    if (facts.C_cardVisible) {
      await page.locator('[data-testid="wall-selected-delete"]').click();
      await page.waitForTimeout(500);
    }
    facts.C_wallsAfterDelete = (await vertices(page)).walls;
    await page.screenshot({ path: resolve(OUT, 'C-after-delete-390.png') });
  }

  // E2. dead space under the pen HUD, measured against the real phone toolbar.
  facts.E2_gapUnderCard = await page.evaluate(() => {
    const card = document.querySelector('[data-testid="wall-selected-card"]');
    const bar = document.querySelector('[data-testid="sims-bottom-toolbar"]');
    const b = bar ? bar.getBoundingClientRect() : null;
    return { barTop: b ? Math.round(b.top) : null, barH: b ? Math.round(b.height) : null, cardBottom: card ? Math.round(card.getBoundingClientRect().bottom) : null, viewportH: window.innerHeight };
  });

  facts.errors = page.__errors.slice();
} finally {
  await browser.close();
}
console.log(JSON.stringify(facts, null, 1));
