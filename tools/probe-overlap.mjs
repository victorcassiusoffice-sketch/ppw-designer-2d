/**
 * P5 support — machine-checkable half of the visual-critique checklist.
 *
 *   node tools/probe-overlap.mjs [baseUrl]
 *
 * "Looks fine to me" is not evidence. This measures, at 1920 / 1366 / 390,
 * in the blank AND the 3-items-placed state:
 *
 *   • horizontal page overflow (a scrollbar on the body = broken layout)
 *   • any visible control whose box escapes the viewport (clipped chrome)
 *   • pairwise overlap between the canvas-overlay chrome boxes
 *   • whether anything opaque covers the CENTRE of the room
 *
 * The eyeball pass still happens on the screenshots — this just makes the
 * things a human reliably misses fail loudly.
 */
import { chromium } from '@playwright/test';

const BASE = process.argv[2] ?? process.env.PPW_E2E_BASE_URL ?? 'http://localhost:5187';

const VIEWPORTS = [
  { name: '1920x1080', width: 1920, height: 1080 },
  { name: '1366x768', width: 1366, height: 768 },
  { name: '390x844', width: 390, height: 844 },
];

/** The overlay chrome that shares the canvas surface. */
const CHROME = [
  '[data-testid="clear-controls"]',
  '[data-testid="cart-pill"]',
  '[data-testid="items-placed"]',
  '[data-testid="cost-readout"]',
  '[data-testid="share-render"]',
  '[data-testid="capture-screen"]',
  '[data-testid="build-stamp"]',
  '[data-testid="sims-dock"]',
  '[data-testid="sims-bottom-toolbar"]',
];

const failures = [];
const out = [];
function check(label, ok, detail) {
  out.push(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? `  — ${detail}` : ''}`);
  if (!ok) failures.push(`${label}${detail ? ` (${detail})` : ''}`);
}

const browser = await chromium.launch();

for (const vp of VIEWPORTS) {
  for (const state of ['blank', 'placed']) {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
    await ctx.addInitScript(() => {
      localStorage.clear();
      localStorage.setItem('ppw_designer_coach_v1', '1');
    });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/designer`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[data-testid="start-quick-rectangle"]', { timeout: 20000 });

    if (state === 'placed') {
      await page.locator('[data-testid="start-quick-rectangle"]').click();
      await page.waitForTimeout(700);
    }
    // Let toasts expire — they are transient by design and would otherwise
    // register as permanent overlapping chrome.
    await page.waitForTimeout(vp.width >= 1024 ? 2200 : 2200);

    const tag = `${vp.name} ${state}`;

    const res = await page.evaluate(
      ({ selectors, vw, vh }) => {
        const boxes = [];
        for (const sel of selectors) {
          for (const el of document.querySelectorAll(sel)) {
            const r = el.getBoundingClientRect();
            const cs = getComputedStyle(el);
            if (r.width < 1 || r.height < 1) continue;
            if (cs.visibility === 'hidden' || cs.display === 'none' || cs.opacity === '0') continue;
            boxes.push({ sel, x: r.x, y: r.y, w: r.width, h: r.height, right: r.right, bottom: r.bottom });
          }
        }

        const overlaps = [];
        for (let i = 0; i < boxes.length; i++) {
          for (let j = i + 1; j < boxes.length; j++) {
            const a = boxes[i];
            const b = boxes[j];
            const ox = Math.min(a.right, b.right) - Math.max(a.x, b.x);
            const oy = Math.min(a.bottom, b.bottom) - Math.max(a.y, b.y);
            // 2px tolerance for shadows / subpixel rounding.
            if (ox > 2 && oy > 2) {
              overlaps.push(`${a.sel} x ${b.sel} (${Math.round(ox)}x${Math.round(oy)}px)`);
            }
          }
        }

        const clipped = boxes
          .filter((b) => b.x < -1 || b.y < -1 || b.right > vw + 1 || b.bottom > vh + 1)
          .map((b) => `${b.sel} [${Math.round(b.x)},${Math.round(b.y)} ${Math.round(b.w)}x${Math.round(b.h)}]`);

        // Room centre = the Konva stage centre once the room is centred.
        // Anything sitting on that point steals a click meant for the floor.
        const c = document.querySelector('.konvajs-content canvas');
        const cb = c ? c.getBoundingClientRect() : null;
        let coversCentre = null;
        if (cb) {
          const cx = cb.x + cb.width / 2;
          const cy = cb.y + cb.height / 2;
          const blocker = document.elementsFromPoint(cx, cy).find((el) => {
            // The canvas, its Konva wrappers and every ANCESTOR of it are
            // the stage, not chrome on top of it.
            if (el === c || el.contains(c) || el.closest('.konvajs-content')) return false;
            const cs = getComputedStyle(el);
            if (cs.pointerEvents === 'none') return false;
            return true;
          });
          coversCentre = blocker ? `${blocker.tagName}.${blocker.className}`.slice(0, 90) : null;
        }

        // The Rooms trigger is now the ONLY route into the rooms list at
        // every width, so a zero-width / off-bar trigger is a hard failure.
        // (It collapsed to 0 px at 390 for a long time before 2026-08-25 —
        // the box-overlap scan cannot see it, because a zero-size element
        // simply drops out.)
        const roomsTrigger = document.querySelector('[data-testid="rooms-trigger"]');
        const rt = roomsTrigger ? roomsTrigger.getBoundingClientRect() : null;
        const roomsTriggerUsable = !!rt && rt.width >= 60 && rt.height >= 32 && rt.right <= vw + 1;

        // TopBar clipping: every control in the header must fit the bar
        // (this is what caught the 1366 overflow the Rooms trigger caused).
        const header = document.querySelector('header');
        const headerClipped = [];
        if (header) {
          const hb = header.getBoundingClientRect();
          for (const el of header.querySelectorAll('button, a, input, select')) {
            const r = el.getBoundingClientRect();
            if (r.width < 1 || r.height < 1) continue;
            if (r.right > hb.right + 1 || r.bottom > hb.bottom + 1 || r.top < hb.top - 1) {
              headerClipped.push(
                `${el.tagName}"${(el.textContent || '').trim().slice(0, 18)}"`,
              );
            }
          }
        }

        return {
          overlaps,
          clipped,
          coversCentre,
          headerClipped,
          roomsTrigger: rt ? { w: Math.round(rt.width), h: Math.round(rt.height) } : null,
          roomsTriggerUsable,
          bodyOverflowX: document.documentElement.scrollWidth - vw,
        };
      },
      { selectors: CHROME, vw: vp.width, vh: vp.height },
    );

    check(`${tag}: no horizontal page overflow`, res.bodyOverflowX <= 0, `overflow ${res.bodyOverflowX}px`);
    check(`${tag}: no chrome clipped off-viewport`, res.clipped.length === 0, res.clipped.join('; '));
    check(`${tag}: no overlapping canvas chrome`, res.overlaps.length === 0, res.overlaps.join('; '));
    check(
      `${tag}: Rooms trigger is reachable`,
      res.roomsTriggerUsable,
      res.roomsTrigger ? `${res.roomsTrigger.w}x${res.roomsTrigger.h}` : 'missing',
    );
    check(
      `${tag}: no TopBar control clipped/wrapped out of the bar`,
      res.headerClipped.length === 0,
      res.headerClipped.join(', '),
    );
    // Only meaningful once a room exists — with a blank canvas the centred
    // "Start by drawing your room" prompt is SUPPOSED to be there.
    if (state === 'placed') {
      check(
        `${tag}: nothing covers the room centre`,
        !res.coversCentre,
        res.coversCentre ?? '',
      );
    }

    await ctx.close();
  }
}

await browser.close();
console.log(out.join('\n'));
console.log(failures.length ? `\n${failures.length} FAILURE(S)` : '\nALL CHECKS PASSED');
process.exit(failures.length ? 1 : 0);
