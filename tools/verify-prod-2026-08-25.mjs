/**
 * P7 step 2 — LIVE verification against https://designer.ppwellness.co.
 *
 *   node tools/verify-prod-2026-08-25.mjs [url]
 *
 * Per the brief:
 *   • `waitUntil: 'domcontentloaded'` + waitForSelector — NEVER
 *     `networkidle`, which never settles in prod (the app polls) and
 *     times the run out.
 *   • assert `#root` has children (render gate, not just HTTP 200)
 *   • place one item end to end
 *   • ZERO console errors
 *   • save a screenshot
 *
 * Exits non-zero on any failure.
 */
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const URL = process.argv[2] ?? 'https://designer.ppwellness.co';
const OUT = resolve(process.cwd(), 'docs/ui-modernize-2026-08-25/after');
mkdirSync(OUT, { recursive: true });

const failures = [];
const log = [];
function check(label, ok, detail) {
  log.push(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? `  — ${detail}` : ''}`);
  if (!ok) failures.push(label);
}

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
await ctx.addInitScript(() => {
  localStorage.clear();
  localStorage.setItem('ppw_designer_coach_v1', '1');
});
const page = await ctx.newPage();

const consoleErrors = [];
page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
page.on('pageerror', (e) => consoleErrors.push(`pageerror: ${String(e)}`));
const netFailures = [];
page.on('requestfailed', (r) => netFailures.push(`${r.failure()?.errorText ?? '?'} ${r.url().slice(0, 110)}`));

/**
 * NEVER `networkidle` — prod polls and never idles (the brief's trap).
 *
 * The brief also names `domcontentloaded`, but that event does NOT fire on
 * production within 150 s from this network: `index.html` carries a
 * RENDER-BLOCKING third-party stylesheet,
 * `<link rel="stylesheet" href="https://rsms.me/inter/inter.css">`, and
 * rsms.me answers in ~16 s here (`curl -w '%{time_total}'` -> 16.2 s), so
 * the document's load milestones stall behind it. Confirmed it is the
 * MILESTONE and not reachability: the same headless browser fetches
 * `/designer` with HTTP 200 in 213 ms using `waitUntil: 'commit'`.
 *
 * So: `commit` + `waitForSelector`. That is STRICTLY stronger evidence
 * than DOMContentLoaded — the selector below only exists if the bundle
 * downloaded, React mounted, and the component tree rendered.
 *
 * PRE-EXISTING and unrelated to this change (nothing here touches
 * index.html), but a real production risk: a third-party font host is a
 * single point of failure for the page's load event. Flagged for Vic in
 * the handoff; self-hosting Inter is the fix and is its own task.
 */
const resp = await page.goto(`${URL}/designer`, { waitUntil: 'commit', timeout: 60000 });
check('HTTP ok', !!resp && resp.status() < 400, `status ${resp?.status()}`);

// Blank start is LIVE: the start prompt only renders when the active room
// has < 3 vertices. Its presence on a fresh context IS the P1 proof.
//
// `state: 'attached'` first, because the rsms.me stylesheet above blocks
// RENDER (so `visible` needs paint, which is stuck behind a ~16 s
// third-party fetch) while React mounts and attaches regardless. Then the
// visibility assertion runs with a budget that clears that fetch.
await page.waitForSelector('[data-testid="start-room-prompt"]', {
  state: 'attached',
  timeout: 120000,
});
check('blank-canvas start prompt in the tree on a fresh visit', true);
await page.waitForSelector('[data-testid="start-room-prompt"]', { timeout: 120000 });
check('blank-canvas start prompt is VISIBLE (page painted)', true);

const rootChildren = await page.evaluate(() => document.getElementById('root')?.childElementCount ?? 0);
check('#root has children (app really mounted)', rootChildren > 0, `childElementCount = ${rootChildren}`);

const shipped = await page.evaluate(() => {
  const dock = document.querySelector('[data-testid="sims-dock"]');
  const c = document.querySelector('.konvajs-content canvas');
  const b = c?.getBoundingClientRect();
  const stageWrap = document.querySelector('.konva-stage');
  return {
    dock: !!dock && getComputedStyle(dock).display !== 'none',
    dockH: dock ? Math.round(dock.getBoundingClientRect().height) : null,
    stage: b ? { w: Math.round(b.width), h: Math.round(b.height) } : null,
    ground: stageWrap ? getComputedStyle(stageWrap.parentElement).backgroundColor : null,
    build: document.querySelector('[data-testid="build-stamp"]')?.textContent?.trim() ?? null,
  };
});
check('Sims dock is live on desktop', shipped.dock, `height ${shipped.dockH}px`);
check('canvas >= 80% width', shipped.stage && shipped.stage.w / 1920 >= 0.8, `${shipped.stage?.w}px = ${(shipped.stage.w / 1920).toFixed(3)}`);
check('canvas >= 85% height', shipped.stage && shipped.stage.h / 1080 >= 0.85, `${shipped.stage?.h}px = ${(shipped.stage.h / 1080).toFixed(3)}`);
check('blueprint ground is dark', shipped.ground === 'rgb(21, 36, 48)', shipped.ground ?? 'unknown');

// --- place one item, end to end ---
await page.locator('[data-testid="start-quick-rectangle"]').click();
await page.waitForTimeout(900);

const origin = await page.evaluate(() => {
  const c = document.querySelector('.konvajs-content canvas');
  const ctx2 = c.getContext('2d');
  const img = ctx2.getImageData(0, 0, c.width, c.height).data;
  let minX = Infinity, minY = Infinity;
  // Gold WALL_GOLD / WALL_GOLD_BRIGHT — see blueprintTheme.ROOM_BORDER_SCAN.
  for (let y = 0; y < c.height; y += 2) {
    for (let x = 0; x < c.width; x += 2) {
      const i = (y * c.width + x) * 4;
      if (img[i + 3] > 200 && img[i] > 200 && img[i + 1] >= 120 && img[i + 1] <= 190 && img[i + 2] < 90) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
      }
    }
  }
  if (!Number.isFinite(minX)) return null;
  const r = c.getBoundingClientRect();
  const sc = c.width / r.width;
  return { x: r.x + minX / sc + 5, y: r.y + minY / sc + 5 };
});
check('gold room border found on the live canvas (reskin is live)', !!origin);

const card = page.locator('[data-product-id]:visible').first();
await card.click();
check('arming works on the live dock', (await page.locator('[data-armed="true"]').count()) === 2);

if (origin) {
  await page.mouse.move(origin.x + 200, origin.y + 200, { steps: 8 });
  await page.mouse.click(origin.x + 200, origin.y + 200);
  await page.waitForTimeout(900);
}
const placed = await page.locator('[data-testid="items-placed"]').innerText();
check('placed one item end to end', placed === '1', `items-placed = "${placed}"`);

// Product art hydrates async (known trap). 2.5 s is enough on localhost;
// against prod on a slow link the catalog tiles were still blank plates,
// which would make the evidence shot misleading. Wait until the dock
// images have actually decoded, with a hard ceiling.
await page.waitForFunction(
  () => {
    const imgs = [...document.querySelectorAll('[data-testid="sims-dock"] img')];
    if (imgs.length === 0) return false;
    const done = imgs.filter((i) => i.complete && i.naturalWidth > 0).length;
    // Deliberately only a FEW. Demanding all ~22 at once made this network
    // reset connections on the larger product photos (some are ~460 KB
    // PNGs that take 27-40 s each here — verified with curl: HTTP 200,
    // just very slow), which showed up as console errors that were caused
    // BY the harness, not by the page.
    return done >= Math.min(3, imgs.length);
  },
  { timeout: 25000 },
).catch(() => console.log('note: dock art still hydrating at the 25 s ceiling'));
await page.waitForTimeout(2500); // let the toasts fade
await page.evaluate(() => document.fonts?.ready).catch(() => {});

// 1 — with an item selected: proves the details OVERLAY ships.
const shotSelected = `${OUT}/PROD-verified-details-overlay.png`;
await page.screenshot({ path: shotSelected, timeout: 45000, animations: 'disabled' });

// 2 — deselected: the clean blueprint canvas, the headline evidence.
await page.keyboard.press('Escape');
await page.waitForTimeout(700);
const shot = `${OUT}/PROD-verified-designer.ppwellness.co.png`;
await page.screenshot({ path: shot, timeout: 45000, animations: 'disabled' });
check('details overlay closes on Escape (deselect)',
  (await page.locator('[data-testid="details-overlay"]').count()) === 0);

check('zero console errors', consoleErrors.length === 0, consoleErrors.slice(0, 5).join(' | '));
if (netFailures.length) {
  console.log('\nnetwork request failures (informational):');
  for (const f of netFailures.slice(0, 8)) console.log(`  ${f}`);
}

await browser.close();

console.log(log.join('\n'));
console.log(`\nbuild stamp on the live page: ${shipped.build}`);
console.log(`screenshot: ${shot}`);
console.log(failures.length ? `\n${failures.length} FAILURE(S)` : '\nLIVE-CONFIRMED — all checks passed');
process.exit(failures.length ? 1 : 0);
