// Records the lesson clips from our own Designer (game programme part 2,
// 8 Nov 2026). Each clip: Playwright drives the dev app (needs the DEV-only
// window.__ppwGeom bridge), the video is cut to the action, cropped,
// scaled to 480 x 300, muted, VP9, at most ~300 KB, plus a WebP poster of
// the last frame. Output: public/lessons/<id>.webm + <id>.webp.
// Every non-GET request is blocked. Usage:
//   node tools/lessons/record-clips-2026-11-08.mjs <devBase> [ids,comma,separated]
import { chromium } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { CLEAN_DESIGNER, cleanContext, waitClean, dirtyText } from './demo-clean-2026-11-08.mjs';

const base = process.argv[2] ?? 'http://127.0.0.1:5181';
const only = process.argv[3] ? new Set(process.argv[3].split(',')) : null;
const outDir = path.resolve('public/lessons');
const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'lesson-clips-'));
await fs.mkdir(outDir, { recursive: true });
const VIEW = { width: 1280, height: 800 };
const MAX_BYTES = 300 * 1024;

const ALL_IDS = ['walls', 'room', 'door', 'stairs', 'remove', 'measure', 'floor', 'wallpaint', 'cladding', 'select', 'item', 'furnish', 'eyedropper', 'garden', 'view3d', 'walk'];
const quietLessons = JSON.stringify({ seen: ALL_IDS, done: [], tipsOff: true, soundOn: false, quest: { status: 'declined', ticks: [], minimized: false, saw3d: false, walked: false }, tipIndex: 0 });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function geomRoom(page) {
  return page.evaluate(() => {
    const g = window.__ppwGeom;
    const room = g?.rooms().find((r) => r.vertices >= 3);
    if (!room) return null;
    const a = g.worldToScreen(room.minX, room.minY);
    const b = g.worldToScreen(room.maxX, room.maxY);
    return { minX: room.minX, minY: room.minY, maxX: room.maxX, maxY: room.maxY, sx0: a.x, sy0: a.y, sx1: b.x, sy1: b.y };
  });
}
async function toScreen(page, x, y) {
  return page.evaluate(([wx, wy]) => window.__ppwGeom.worldToScreen(wx, wy), [x, y]);
}
async function glide(page, from, to, steps = 18, pause = 18) {
  await page.mouse.move(from.x, from.y);
  for (let i = 1; i <= steps; i++) {
    await page.mouse.move(from.x + ((to.x - from.x) * i) / steps, from.y + ((to.y - from.y) * i) / steps);
    await sleep(pause);
  }
}
async function quickRoom(page) {
  await page.getByTestId('start-quick-rectangle').first().click();
  await page.waitForFunction(() => window.__ppwGeom?.rooms().some((r) => r.vertices >= 3), null, { timeout: 15000 });
  await sleep(300);
  // Closer, so the clip reads at 480 px wide.
  const zoomIn = page.getByTestId('zoom-in').first();
  if (await zoomIn.isVisible().catch(() => false)) {
    await zoomIn.click();
    await sleep(350);
  }
}
async function canvasBox(page) {
  return page.locator('.konvajs-content').first().boundingBox();
}
async function placeProducts(page, room, count, spotsOverride) {
  await page.getByTestId('dock-catalog-open').first().click();
  await page.locator('[data-testid="dock-strip"]').waitFor({ timeout: 15000 });
  const tiles = page.locator('[data-testid="dock-strip"] [data-product-id][data-armed]:not([data-floor-material])');
  const spots = [
    [0.14, 0.16],
    [0.86, 0.16],
    [0.14, 0.84],
  ];
  const use = spotsOverride ?? spots;
  for (let i = 0; i < count; i++) {
    await tiles.nth(i * 2).click();
    const [fx, fy] = use[i % use.length];
    const p = await toScreen(page, room.minX + (room.maxX - room.minX) * fx, room.minY + (room.maxY - room.minY) * fy);
    await page.mouse.click(p.x, p.y);
    await sleep(350);
  }
  const placed = await page.evaluate(() => JSON.parse(localStorage.getItem('ppw_property_v2') || '{}').state?.property?.rooms?.reduce((n, r) => n + (r.placedItems?.length ?? 0), 0) ?? 0);
  if (placed < count) throw new Error(`placed ${placed} of ${count} products`);
  await page.getByTestId('dock-collapse').first().click().catch(() => {});
  await page.keyboard.press('Escape');
  // Keys go to the plan, not to the catalogue's search box.
  await page.evaluate(() => (document.activeElement instanceof HTMLElement ? document.activeElement.blur() : undefined));
  await sleep(900);
}
async function pickTool(page, category, testid) {
  await page.getByRole('button', { name: category, exact: true }).first().click();
  await page.getByTestId(testid).first().click();
  await sleep(350);
}
const mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

/** Each clip: setup (not kept), then the action between mark('start') and mark('end'). */
const CLIPS = {
  async walls({ page, mark }) {
    const box = await canvasBox(page);
    const c = { x: box.x + box.width / 2, y: box.y + Math.min(box.height / 2, 200) };
    const pts = [
      { x: c.x - 150, y: c.y - 90 },
      { x: c.x + 150, y: c.y - 90 },
      { x: c.x + 150, y: c.y + 90 },
      { x: c.x - 150, y: c.y + 90 },
    ];
    mark('start');
    let prev = { x: c.x - 220, y: c.y - 140 };
    for (const p of [...pts, pts[0]]) {
      await glide(page, prev, p, 14, 16);
      await page.mouse.down();
      await page.mouse.up();
      prev = p;
      await sleep(220);
    }
    await sleep(900);
    mark('end');
    return { crop: { x: c.x - 260, y: c.y - 170, w: 520, h: 325 } };
  },
  async room({ page, mark }) {
    mark('start');
    const button = page.getByTestId('start-quick-rectangle').first();
    const box = await button.boundingBox();
    await glide(page, { x: box.x - 120, y: box.y + 120 }, { x: box.x + box.width / 2, y: box.y + box.height / 2 }, 16, 20);
    await sleep(200);
    await button.click();
    await page.waitForFunction(() => window.__ppwGeom?.rooms().some((r) => r.vertices >= 3), null, { timeout: 15000 });
    await sleep(1300);
    mark('end');
    const room = await geomRoom(page);
    return { crop: unionCrop([{ x: box.x - 20, y: box.y - 20, w: box.width + 40, h: box.height + 40 }, rectOf(room)]) };
  },
  async door({ page, mark }) {
    await quickRoom(page);
    const room = await geomRoom(page);
    await pickTool(page, 'Build', 'door-tool-toggle');
    const top = { a: await toScreen(page, room.minX + 0.6, room.minY), b: await toScreen(page, room.maxX - 0.6, room.minY) };
    const right = await toScreen(page, room.maxX, (room.minY + room.maxY) / 2);
    mark('start');
    await glide(page, { x: top.a.x, y: top.a.y + 60 }, top.a, 10, 20);
    await glide(page, top.a, mid(top.a, top.b), 20, 22);
    await page.mouse.down();
    await page.mouse.up();
    await sleep(400);
    await page.getByTestId('door-kind-window').first().click();
    await glide(page, { x: right.x - 60, y: right.y - 40 }, right, 14, 22);
    await page.mouse.down();
    await page.mouse.up();
    await sleep(1000);
    mark('end');
    return { crop: padded(rectOf(room), 70) };
  },
  async remove({ page, mark }) {
    await quickRoom(page);
    const room = await geomRoom(page);
    await placeProducts(page, room, 2);
    await pickTool(page, 'Arrange', 'remove-tool-toggle');
    const p = await toScreen(page, room.minX + (room.maxX - room.minX) * 0.14, room.minY + (room.maxY - room.minY) * 0.16);
    mark('start');
    await glide(page, { x: p.x + 120, y: p.y + 90 }, p, 20, 24);
    await sleep(500);
    await page.mouse.down();
    await page.mouse.up();
    await sleep(1100);
    mark('end');
    return { crop: padded(rectOf(room), 60) };
  },
  async measure({ page, mark }) {
    await quickRoom(page);
    const room = await geomRoom(page);
    await pickTool(page, 'Arrange', 'measure-tool-toggle');
    const p = await toScreen(page, (room.minX + room.maxX) / 2, room.minY);
    mark('start');
    await glide(page, { x: p.x - 80, y: p.y + 80 }, p, 16, 22);
    await page.mouse.down();
    await page.mouse.up();
    await sleep(500);
    await page.keyboard.press('Control+A');
    await page.keyboard.type('6.5', { delay: 140 });
    await sleep(300);
    await page.keyboard.press('Enter');
    await sleep(1200);
    mark('end');
    const after = await geomRoom(page);
    return { crop: padded(unionCrop([rectOf(room), rectOf(after)]), 60) };
  },
  async floor({ page, mark }) {
    await quickRoom(page);
    const room = await geomRoom(page);
    await pickTool(page, 'Finish', 'floor-paint-toggle');
    const a = await toScreen(page, room.minX + 0.3, room.minY + 0.3);
    const b = await toScreen(page, room.maxX - 0.3, room.maxY - 0.3);
    mark('start');
    await glide(page, { x: a.x - 40, y: a.y - 40 }, a, 8, 20);
    await page.mouse.down();
    await glide(page, a, b, 26, 26);
    await page.mouse.up();
    await sleep(1100);
    mark('end');
    return { crop: padded(rectOf(room), 50) };
  },
  async wallpaint({ page, mark }) {
    await quickRoom(page);
    const room = await geomRoom(page);
    await pickTool(page, 'Finish', 'wallpaint-tool-toggle');
    await sleep(500);
    const walls = [
      await toScreen(page, (room.minX + room.maxX) / 2, room.minY),
      await toScreen(page, room.maxX, (room.minY + room.maxY) / 2),
      await toScreen(page, (room.minX + room.maxX) / 2, room.maxY),
    ];
    mark('start');
    let prev = { x: walls[0].x - 80, y: walls[0].y + 70 };
    for (const w of walls) {
      await glide(page, prev, w, 14, 22);
      await page.mouse.down();
      await page.mouse.up();
      await sleep(380);
      prev = w;
    }
    await sleep(900);
    mark('end');
    return { crop: padded(rectOf(await geomRoom(page)), 70) };
  },
  async cladding({ page, mark }) {
    await quickRoom(page);
    const room = await geomRoom(page);
    await pickTool(page, 'Finish', 'cladding-tool-toggle');
    await sleep(500);
    const w1 = await toScreen(page, (room.minX + room.maxX) / 2, room.minY);
    const w2 = await toScreen(page, room.minX, (room.minY + room.maxY) / 2);
    mark('start');
    await glide(page, { x: w1.x + 60, y: w1.y + 80 }, w1, 14, 22);
    await page.mouse.down();
    await page.mouse.up();
    await sleep(450);
    await glide(page, w1, w2, 16, 22);
    await page.mouse.down();
    await page.mouse.up();
    await sleep(1000);
    mark('end');
    return { crop: padded(rectOf(await geomRoom(page)), 70) };
  },
  async select({ page, mark }) {
    await quickRoom(page);
    const room = await geomRoom(page);
    await placeProducts(page, room, 1);
    const p = await toScreen(page, room.minX + (room.maxX - room.minX) * 0.14, room.minY + (room.maxY - room.minY) * 0.16);
    const q = await toScreen(page, room.minX + (room.maxX - room.minX) * 0.62, room.minY + (room.maxY - room.minY) * 0.6);
    mark('start');
    await glide(page, { x: p.x + 90, y: p.y + 90 }, p, 14, 22);
    await page.mouse.down();
    await page.mouse.up();
    await sleep(500);
    await page.mouse.down();
    await glide(page, p, q, 24, 26);
    await page.mouse.up();
    await sleep(1000);
    mark('end');
    return { crop: padded(rectOf(room), 60) };
  },
  async item({ page, mark }) {
    await quickRoom(page);
    const room = await geomRoom(page);
    // Placed in a corner, then slid to the middle (setup, not filmed), where it has room to turn.
    await placeProducts(page, room, 1);
    const corner = await toScreen(page, room.minX + (room.maxX - room.minX) * 0.14, room.minY + (room.maxY - room.minY) * 0.16);
    const p = await toScreen(page, (room.minX + room.maxX) / 2, (room.minY + room.maxY) / 2);
    await page.mouse.click(corner.x, corner.y);
    await sleep(300);
    await page.mouse.down();
    await glide(page, corner, p, 16, 16);
    await page.mouse.up();
    await sleep(600);
    mark('start');
    for (const key of ['r', 'r']) {
      await page.keyboard.press(key);
      await sleep(650);
    }
    await sleep(700);
    mark('end');
    return { crop: padded(rectOf(room), 60) };
  },
  async eyedropper({ page, mark }) {
    await quickRoom(page);
    const room = await geomRoom(page);
    await placeProducts(page, room, 1);
    const p = await toScreen(page, room.minX + (room.maxX - room.minX) * 0.14, room.minY + (room.maxY - room.minY) * 0.16);
    const q = await toScreen(page, room.minX + (room.maxX - room.minX) * 0.7, room.minY + (room.maxY - room.minY) * 0.68);
    await page.locator('.konvajs-content').first().hover();
    mark('start');
    await page.keyboard.press('e');
    await glide(page, { x: p.x + 80, y: p.y + 70 }, p, 14, 22);
    await page.mouse.down();
    await page.mouse.up();
    await sleep(400);
    await glide(page, p, q, 18, 24);
    await page.mouse.down();
    await page.mouse.up();
    await sleep(1000);
    mark('end');
    return { crop: padded(rectOf(room), 60) };
  },
  async furnish({ page, mark }) {
    await quickRoom(page);
    const room = await geomRoom(page);
    await page.getByTestId('dock-catalog-open').first().click();
    await page.locator('[data-testid="dock-strip"]').waitFor({ timeout: 15000 });
    await sleep(600);
    const tile = page.locator('[data-testid="dock-strip"] [data-product-id][data-armed]:not([data-floor-material])').nth(2);
    const box = await tile.boundingBox();
    const target = await toScreen(page, room.minX + (room.maxX - room.minX) * 0.2, room.minY + (room.maxY - room.minY) * 0.2);
    mark('start');
    const from = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    await glide(page, { x: from.x + 60, y: from.y - 40 }, from, 10, 20);
    await page.mouse.down();
    await glide(page, from, target, 30, 26);
    await page.mouse.up();
    await sleep(1200);
    mark('end');
    return { crop: unionCrop([rectOf(room), { x: box.x - 20, y: box.y - 20, w: box.width + 40, h: box.height + 40 }]) };
  },
  async garden({ page, mark }) {
    await quickRoom(page);
    const room = await geomRoom(page);
    await page.getByTestId('plan-garden-toggle').first().click();
    await page.getByTestId('garden-add-lawn').first().click();
    await sleep(500);
    const a = await toScreen(page, room.maxX + 0.6, room.minY);
    const b = await toScreen(page, room.maxX + 3.2, room.maxY);
    mark('start');
    await glide(page, { x: a.x - 40, y: a.y - 30 }, a, 10, 20);
    await page.mouse.down();
    await glide(page, a, b, 26, 26);
    await page.mouse.up();
    await sleep(1200);
    mark('end');
    return { crop: padded(unionCrop([rectOf(room), { x: a.x, y: a.y, w: b.x - a.x, h: b.y - a.y }]), 40) };
  },
  async view3d({ page, mark }) {
    await quickRoom(page);
    await page.getByRole('button', { name: '3D House', exact: true }).first().click();
    await page.locator('[data-first-picture-ms]').first().waitFor({ timeout: 90000 });
    await sleep(1500);
    const canvas = await page.getByTestId('wallpaint-3d-canvas').first().boundingBox();
    const c = { x: canvas.x + canvas.width / 2, y: canvas.y + canvas.height / 2 };
    mark('start');
    await page.mouse.move(c.x - 120, c.y);
    await page.mouse.down();
    await glide(page, { x: c.x - 120, y: c.y }, { x: c.x + 140, y: c.y - 30 }, 16, 30);
    await page.mouse.up();
    await sleep(700);
    mark('end');
    return { crop: { x: canvas.x, y: canvas.y, w: canvas.width, h: canvas.height } };
  },
  async walk({ page, mark }) {
    await quickRoom(page);
    await page.getByRole('button', { name: '3D House', exact: true }).first().click();
    await page.locator('[data-first-picture-ms]').first().waitFor({ timeout: 90000 });
    const launch = page.getByRole('button', { name: 'Open Walk mode' }).first();
    await launch.waitFor({ timeout: 60000 });
    await launch.click();
    await page.getByRole('button', { name: 'Start walk' }).click();
    await page.locator('[data-testid="world-walk"][data-status]').waitFor({ timeout: 90000 });
    await sleep(1200);
    mark('start');
    await page.keyboard.down('w');
    await sleep(1500);
    await page.keyboard.up('w');
    await page.keyboard.down('d');
    await sleep(700);
    await page.keyboard.up('d');
    await sleep(500);
    mark('end');
    return { crop: { x: 0, y: 0, w: VIEW.width, h: VIEW.height } };
  },
  async stairs({ page, mark }) {
    await quickRoom(page);
    await page.getByRole('button', { name: '3D House', exact: true }).first().click();
    await page.locator('[data-first-picture-ms]').first().waitFor({ timeout: 90000 });
    await sleep(800);
    const select = page.locator('select').filter({ has: page.locator('option[value="__add-floor"]') }).first();
    await select.selectOption('__add-floor');
    await sleep(1200);
    // Back to the ground floor, where the stair starts.
    const ground = await select.locator('option').first().getAttribute('value');
    await select.selectOption(ground);
    await sleep(800);
    const stairButton = page.locator('.house-opening-tools button').nth(2);
    await stairButton.waitFor({ timeout: 15000 });
    const canvas = await page.getByTestId('wallpaint-3d-canvas').first().boundingBox();
    mark('start');
    await stairButton.click();
    await sleep(500);
    const c = { x: canvas.x + canvas.width * 0.5, y: canvas.y + canvas.height * 0.58 };
    await glide(page, { x: c.x + 100, y: c.y + 60 }, c, 16, 24);
    await page.mouse.down();
    await sleep(60);
    await page.mouse.up();
    await sleep(1600);
    mark('end');
    const stairs = await page.evaluate(() => JSON.parse(localStorage.getItem('ppw_property_v2') || '{}').state?.property?.stairs?.length ?? 0);
    if (!stairs) throw new Error('no stair placed');
    return { crop: { x: canvas.x, y: canvas.y, w: canvas.width, h: canvas.height } };
  },
};

function rectOf(room) {
  if (!room) return { x: 250, y: 200, w: 500, h: 300 };
  return { x: Math.min(room.sx0, room.sx1), y: Math.min(room.sy0, room.sy1), w: Math.abs(room.sx1 - room.sx0), h: Math.abs(room.sy1 - room.sy0) };
}
function padded(r, pad) {
  return { x: r.x - pad, y: r.y - pad, w: r.w + pad * 2, h: r.h + pad * 2 };
}
function unionCrop(rects) {
  const x0 = Math.min(...rects.map((r) => r.x));
  const y0 = Math.min(...rects.map((r) => r.y));
  const x1 = Math.max(...rects.map((r) => r.x + r.w));
  const y1 = Math.max(...rects.map((r) => r.y + r.h));
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}
/** Grow to 16:10 around the centre, then keep inside the frame. */
function fitCrop(r) {
  let { x, y, w, h } = r;
  const ratio = 16 / 10;
  if (w / h > ratio) {
    const nh = w / ratio;
    y -= (nh - h) / 2;
    h = nh;
  } else {
    const nw = h * ratio;
    x -= (nw - w) / 2;
    w = nw;
  }
  w = Math.min(w, VIEW.width);
  h = Math.min(h, VIEW.height);
  x = Math.max(0, Math.min(x, VIEW.width - w));
  y = Math.max(0, Math.min(y, VIEW.height - h));
  const even = (v) => Math.max(2, Math.floor(v / 2) * 2);
  return { x: Math.round(x), y: Math.round(y), w: even(w), h: even(h) };
}

function encode(src, dst, from, to, crop, crf) {
  const vf = `crop=${crop.w}:${crop.h}:${crop.x}:${crop.y},scale=480:300:flags=lanczos,fps=15`;
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-ss', from.toFixed(2), '-to', to.toFixed(2), '-i', src, '-vf', vf, '-an', '-c:v', 'libvpx-vp9', '-b:v', '0', '-crf', String(crf), '-row-mt', '1', '-deadline', 'good', '-cpu-used', '2', dst]);
}

const browser = await chromium.launch({ headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const report = [];
for (const id of ALL_IDS) {
  if (only && !only.has(id)) continue;
  const clip = CLIPS[id];
  if (!clip) continue;
  const dir = path.join(tmp, id);
  const ctx = await browser.newContext({ viewport: VIEW, deviceScaleFactor: 1, recordVideo: { dir, size: VIEW } });
  await cleanContext(ctx);
  await ctx.addInitScript((value) => {
    try {
      localStorage.setItem('olb.lessons.v1', value);
    } catch {
      /* the clip still records */
    }
  }, quietLessons);
  await ctx.route('**/*', (r) => (r.request().method() === 'GET' ? r.continue() : r.abort()));
  // The app's short messages ("Door added") would sit over the tool in a 3 s clip.
  await ctx.addInitScript(() => {
    const hide = () => {
      const style = document.createElement('style');
      style.textContent = String.raw`.z-\[35\].fixed.left-1\/2{display:none!important}`;
      document.head.appendChild(style);
    };
    if (document.head) hide();
    else document.addEventListener('DOMContentLoaded', hide);
  });
  const page = await ctx.newPage();
  const t0 = Date.now();
  const marks = {};
  const mark = (name) => {
    marks[name] = (Date.now() - t0) / 1000;
  };
  let row = { id, ok: false };
  try {
    await page.goto(`${base}${CLEAN_DESIGNER}`, { waitUntil: 'domcontentloaded' });
    await page.locator('.konvajs-content canvas').first().waitFor({ timeout: 60000 });
    await waitClean(page);
    await page.waitForFunction(() => !!window.__ppwGeom?.ready?.(), null, { timeout: 20000 });
    await sleep(800);
    const result = await clip({ page, mark });
    const dirty = await dirtyText(page);
    if (dirty.length) throw new Error(`price or shop name on screen: ${dirty.join(' | ')}`);
    row = { id, ok: true, marks, crop: fitCrop(result.crop) };
  } catch (error) {
    row = { id, ok: false, error: String(error.message).split('\n')[0], marks };
  }
  const video = page.video();
  await ctx.close();
  if (row.ok && video) {
    const src = await video.path();
    const dst = path.join(outDir, `${id}.webm`);
    const from = Math.max(0, row.marks.start - 0.15);
    const to = row.marks.end + 0.1;
    let crf = 40;
    encode(src, dst, from, to, row.crop, crf);
    let size = (await fs.stat(dst)).size;
    while (size > MAX_BYTES && crf < 56) {
      crf += 4;
      encode(src, dst, from, to, row.crop, crf);
      size = (await fs.stat(dst)).size;
    }
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-sseof', '-0.25', '-i', dst, '-frames:v', '1', '-c:v', 'libwebp', '-quality', '72', path.join(outDir, `${id}.webp`)]);
    row.bytes = size;
    row.crf = crf;
    row.seconds = +(to - from).toFixed(2);
    row.posterBytes = (await fs.stat(path.join(outDir, `${id}.webp`))).size;
  }
  report.push(row);
  console.log(JSON.stringify(row));
}
await browser.close();
// The manifest of what is in public/lessons: node tools/lessons/clips-manifest-2026-11-08.mjs
