// Records the first-build quest from an empty plan to the walk, through the
// lessons' own "Show me" buttons, then cuts it to about 20 s (VP9 WebM and
// H.264 MP4, no sound). Needs the dev server (DEV-only geometry bridge).
// Every non-GET request is blocked.
//   node tools/lessons/quest-video-2026-11-08.mjs <devBase> <outDir> [desktop|phone] [seconds]
import { chromium } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { CLEAN_DESIGNER, cleanContext, waitClean, dirtyText } from './demo-clean-2026-11-08.mjs';

const base = process.argv[2] ?? 'http://127.0.0.1:5181';
const out = path.resolve(process.argv[3] ?? 'proof');
const device = process.argv[4] ?? 'desktop';
const target = Number(process.argv[5] ?? 20);
const phone = device === 'phone';
const size = phone ? { width: 390, height: 844 } : { width: 1280, height: 800 };
await fs.mkdir(out, { recursive: true });
const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'quest-video-'));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// The real GPU (as tools/world does): with software 3D the recorder falls
// behind the 3D and Walk screens and the end of the quest is never filmed.
// QUEST_VIDEO_GL=swiftshader for a machine without one.
const glArgs = process.env.QUEST_VIDEO_GL === 'swiftshader'
  ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
  : ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'];
const browser = await chromium.launch({ headless: true, args: glArgs });
const ctx = await browser.newContext({ viewport: size, hasTouch: phone, isMobile: phone, deviceScaleFactor: 1, recordVideo: { dir: tmp, size } });
await cleanContext(ctx);
await ctx.route('**/*', (r) => (r.request().method() === 'GET' ? r.continue() : r.abort()));
const page = await ctx.newPage();
const errors = [];
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text().slice(0, 200));
});
const tap = async (locator) => (phone ? locator.tap() : locator.click());
const press = async (p) => (phone ? page.touchscreen.tap(p.x, p.y) : page.mouse.click(p.x, p.y));
const toScreen = (x, y) => page.evaluate(([a, b]) => window.__ppwGeom.worldToScreen(a, b), [x, y]);
const toWorld = (x, y) => page.evaluate(([a, b]) => window.__ppwGeom.screenToWorld(a, b), [x, y]);
const ticks = () => page.evaluate(() => JSON.parse(localStorage.getItem('olb.lessons.v1') || '{}').quest?.ticks ?? []);
async function waitTick(step) {
  for (let i = 0; i < 100; i++) {
    if ((await ticks()).includes(step)) return;
    await sleep(200);
  }
  throw new Error(`step ${step} did not tick`);
}
async function showMe() {
  const chip = page.locator('[data-lessons-quest="chip"]');
  if (await chip.isVisible().catch(() => false)) {
    await tap(chip);
    await sleep(500);
  }
  await sleep(400);
  await tap(page.locator('[data-lessons-quest="panel"] .lessons-quest__show'));
  await sleep(900);
}

const t0 = Date.now();
let ok = false;
let walkClosed = false;
const dirty = [];
try {
  await page.goto(`${base}${CLEAN_DESIGNER}`, { waitUntil: 'domcontentloaded' });
  await page.locator('.konvajs-content canvas').first().waitFor({ timeout: 60000 });
  await waitClean(page);
  await page.waitForFunction(() => !!window.__ppwGeom?.ready?.());
  await page.locator('[data-lessons-quest="offer"]').waitFor({ timeout: 20000 });
  await sleep(1200);
  await tap(page.locator('[data-lessons-quest="offer"]').getByRole('button', { name: 'Start', exact: true }));
  await sleep(1200);

  // 1 · A room, corner by corner.
  await showMe();
  const stage = await page.locator('.konvajs-content').first().boundingBox();
  const bar = await page.locator(phone ? '[data-testid="sims-bottom-toolbar"]' : '[data-testid="sims-dock"]').first().boundingBox();
  const bottom = Math.min(stage.y + stage.height, bar ? bar.y : size.height) - 20;
  const top = Math.max(stage.y, 0);
  const c = await toWorld(stage.x + stage.width / 2, (top + bottom) / 2);
  const cx = Math.round(c.x);
  const cy = Math.round(c.y);
  // A room that fits the visible plan with a margin (whole half-metres), as in the e2e test.
  const ppm = (await toScreen(cx + 1, cy)).x - (await toScreen(cx, cy)).x;
  const hw = Math.max(1.5, Math.min(2, Math.floor(((stage.width * 0.42) / ppm) * 2) / 2));
  const hh = Math.max(1, Math.min(1.5, Math.floor((((bottom - top) * 0.35) / ppm) * 2) / 2));
  for (const [x, y] of [[cx - hw, cy - hh], [cx + hw, cy - hh], [cx + hw, cy + hh], [cx - hw, cy + hh], [cx - hw, cy - hh]]) {
    await press(await toScreen(x, y));
    await sleep(350);
  }
  await waitTick('room');
  await sleep(900);
  const room = await page.evaluate(() => window.__ppwGeom.rooms().find((r) => r.vertices >= 3));

  // 2 · A door and a window.
  await showMe();
  await press(await toScreen((room.minX + room.maxX) / 2, room.minY));
  await sleep(600);
  await tap(page.locator(phone ? '[data-testid="door-kind-mobile-window"]' : '[data-testid="door-kind-window"]').first());
  await sleep(400);
  await press(await toScreen(room.maxX, (room.minY + room.maxY) / 2));
  await waitTick('openings');
  await sleep(900);

  // 3 · Paint a wall.
  await showMe();
  await press(await toScreen(room.minX, (room.minY + room.maxY) / 2));
  await waitTick('paint');
  await sleep(900);

  // 4 · Lay a floor.
  await showMe();
  if (phone) await page.getByTestId('floor-paint-scope-mobile-room').tap();
  else await press(await toScreen(room.minX + 1.25, room.minY + 1.25));
  await waitTick('floor');
  await sleep(900);

  // 5 · Three products.
  await showMe();
  await tap(page.locator(phone ? '[data-testid="sims-cat-decor"]' : '[data-testid="dock-cat-decor"]').first());
  const tiles = page.locator(phone ? '[data-testid="sims-thumb"]:not([data-floor-material])' : '[data-testid="dock-strip"] [data-product-id][data-armed]:not([data-floor-material])');
  for (const [x, y] of [[room.minX + 0.9, room.minY + 0.9], [room.maxX - 0.9, room.minY + 0.9], [room.minX + 0.9, room.maxY - 0.9]]) {
    if (phone && !(await tiles.first().isVisible().catch(() => false))) {
      await page.getByTestId('sims-catalog-open').first().tap();
      await page.locator('[data-testid="sims-cat-decor"]').first().tap();
    }
    await tap(tiles.first());
    await sleep(300);
    await press(await toScreen(x, y));
    await sleep(600);
  }
  await waitTick('products');
  await sleep(900);

  // 6 · 3D.
  await showMe();
  await page.locator('[data-first-picture-ms]').first().waitFor({ timeout: 90000 });
  await waitTick('view3d');
  await sleep(1500);

  // 7 · Walk.
  await showMe();
  await page.locator('[data-lesson-card="walk"]').waitFor({ timeout: 30000 });
  await sleep(1200);
  await tap(page.getByRole('button', { name: 'Open Walk mode' }).first());
  await sleep(800);
  await page.getByRole('button', { name: 'Start walk' }).click();
  await page.locator('[data-testid="world-walk"][data-status]').waitFor({ timeout: 90000 });
  if (!phone) {
    await page.keyboard.down('w');
    await sleep(1200);
    await page.keyboard.up('w');
  }
  await waitTick('walk');
  await sleep(600);
  await page.getByRole('button', { name: /Exit walk/ }).click();
  await page.getByTestId('world-walk').waitFor({ state: 'hidden', timeout: 20000 });
  await page.locator('.lessons-quest--finale').waitFor({ timeout: 20000 });
  // Hold on the finished quest so the cut keeps about two seconds of it.
  await sleep(6000);
  walkClosed = !(await page.getByTestId('world-walk').isVisible().catch(() => false));
  await page.screenshot({ path: path.join(out, `quest-${device}-end.png`) });
  dirty.push(...(await dirtyText(page)));
  ok = dirty.length === 0 && walkClosed;
} catch (error) {
  console.log('stopped:', String(error.message).split('\n')[0]);
}
const rawSeconds = (Date.now() - t0) / 1000;
const video = page.video();
await ctx.close();
await browser.close();
const src = await video.path();
const speed = Math.max(1, rawSeconds / target);
const name = `quest-${device}`;
const vf = `setpts=PTS/${speed.toFixed(3)},fps=24,scale=${phone ? 390 : 960}:-2:flags=lanczos`;
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', src, '-vf', vf, '-an', '-c:v', 'libvpx-vp9', '-b:v', '0', '-crf', '36', '-row-mt', '1', path.join(out, `${name}.webm`)]);
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', src, '-vf', vf, '-an', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '26', '-movflags', '+faststart', path.join(out, `${name}.mp4`)]);
const report = { device, ok, rawSeconds: +rawSeconds.toFixed(1), speed: +speed.toFixed(2), outputSeconds: +(rawSeconds / speed).toFixed(1), consoleErrors: errors, dirty, walkClosed };
await fs.writeFile(path.join(out, `${name}.json`), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report));
