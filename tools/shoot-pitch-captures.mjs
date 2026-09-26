// Pitch-page app captures (2026-09-26): the two "App screenshots" the developer
// pitch shows — the demo home as a 2D plan and in Premium 3D — shot from the
// running app so the pitch never falls back to "App view unavailable".
//
//   node tools/shoot-pitch-captures.mjs [baseUrl] [outDir]
//
// Writes public/showcase/designer-plan.webp and designer-3d.webp (<= 400 KB
// each). Uses sharp for WebP when it is installed; otherwise writes PNG next
// to the intended name and says so, because a PNG would not match the paths
// PitchShell.tsx references.
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const base = (process.argv[2] ?? 'http://127.0.0.1:5186').replace(/\/+$/, '');
const out = path.resolve(process.argv[3] ?? 'public/showcase');
const MAX_BYTES = 400 * 1024;
const VIEWPORT = { width: 1366, height: 860 };
// Headless Chromium has no GPU; software WebGL is opt-in since Chrome 122.
const GL_ARGS = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
fs.mkdirSync(out, { recursive: true });

let sharp = null;
try { sharp = (await import('sharp')).default; } catch { sharp = null; }

async function encode(png, file) {
  if (!sharp) {
    const fallback = file.replace(/\.webp$/, '.png');
    fs.writeFileSync(fallback, png);
    console.warn(`sharp not installed: wrote PNG ${path.basename(fallback)} (${png.length} bytes); PitchShell expects .webp`);
    return { file: fallback, bytes: png.length };
  }
  // Step the quality down until the frame fits the budget; the pitch shows it at <= 38vh.
  for (const quality of [88, 82, 76, 70, 64, 58]) {
    const buffer = await sharp(png).webp({ quality, effort: 6 }).toBuffer();
    if (buffer.length <= MAX_BYTES || quality === 58) {
      fs.writeFileSync(file, buffer);
      return { file, bytes: buffer.length, quality };
    }
  }
  throw new Error('unreachable');
}

async function designerMounted(page) {
  await page.waitForSelector('.konvajs-content canvas', { state: 'attached', timeout: 60_000 });
  await page.waitForLoadState('networkidle');
  // A cold Vite dev server discovers new dependencies on first visit and reloads the
  // page; the route fallback spinner is then what a naive shot would capture.
  await page.waitForFunction(() => !document.querySelector('[role="status"] .animate-spin') && !!document.querySelector('.konvajs-content canvas'), undefined, { timeout: 60_000 });
}

async function openDemo(browser, view) {
  const ctx = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.addInitScript(() => {
    try {
      localStorage.clear(); sessionStorage.clear();
      // A person who has used the designer before: no first-run coach over the plan.
      localStorage.setItem('ppw_designer_coach_v1', '1');
    } catch { /* fresh profile */ }
  });
  await page.goto(`${base}/demo?scene=home&view=${view}`, { waitUntil: 'networkidle' });
  await designerMounted(page);
  // The demo greets with a toast; let it go before the frame is taken.
  await page.locator('[data-testid="toast"]').first().waitFor({ state: 'attached', timeout: 5_000 }).catch(() => {});
  await page.locator('[data-testid="toast"]').first().waitFor({ state: 'detached', timeout: 15_000 }).catch(() => {});
  await designerMounted(page);
  return { ctx, page, errors };
}

/** The dev build stamp ("build dev-…", bottom-left) is a debugging aid; production prints a commit and the pitch should show neither. */
async function hideBuildStamp(page) {
  await page.evaluate(() => {
    for (const span of document.querySelectorAll('span')) if (/^build\s/.test(span.textContent ?? '') && span.children.length === 0) span.style.display = 'none';
  });
}

/** Wait until the GL stage has stopped receiving product bodies and drawing new frames. */
async function stageSettled(page, budgetMs) {
  const started = Date.now();
  let last = null;
  let stableSince = Date.now();
  while (Date.now() - started < budgetMs) {
    await page.waitForLoadState('networkidle').catch(() => {});
    const now = await page.evaluate(() => {
      const b = window.__ppwRoomView3d;
      return b ? { frames: b.debug()?.frames ?? 0, bodies: b.dressing?.()?.bodies ?? null } : null;
    }).catch(() => null);
    const key = JSON.stringify(now);
    if (key !== last) { last = key; stableSince = Date.now(); }
    else if (Date.now() - stableSince >= 3_000) return now;
    await page.waitForTimeout(500);
  }
  return last ? JSON.parse(last) : null;
}

// Two browsers on purpose: with the software-GL flags a screenshot of the 2D plan
// takes ~35 s (SwiftShader composites the whole page) and trips Playwright's
// default timeout; without them it takes a fraction of a second. The 3D stage
// needs the flags or it silently runs on the painter fallback.
const plain = await chromium.launch();
const gl = await chromium.launch({ args: GL_ARGS });
const report = { base, at: new Date().toISOString(), viewport: VIEWPORT, shots: [] };
let failed = false;

// 0. Warm both routes once so dependency optimisation and lazy chunks are behind us.
for (const [browser, view] of [[plain, '2d'], [gl, '3d']]) {
  const { ctx } = await openDemo(browser, view);
  await ctx.close();
}

// 1. The plan: top-down art decodes lazily, so give it a moment.
{
  const { ctx, page, errors } = await openDemo(plain, '2d');
  await page.waitForTimeout(3_000);
  await hideBuildStamp(page);
  const png = await page.screenshot({ type: 'png', timeout: 90_000 });
  const result = await encode(png, path.join(out, 'designer-plan.webp'));
  report.shots.push({ name: 'designer-plan', view: '2d', ...result, consoleErrors: errors });
  console.log('shot designer-plan', result.bytes, 'bytes', result.quality ? `q${result.quality}` : '');
  await ctx.close();
}

// 2. Premium 3D: wait for the GL stage's first drawn frame (SwiftShader can take ~15 s).
{
  const { ctx, page, errors } = await openDemo(gl, '3d');
  const firstFrame = await page.waitForFunction(() => {
    const bridge = window.__ppwRoomView3d;
    const stage = document.querySelector('[data-testid="wallpaint-3d"]');
    return !!bridge && stage?.getAttribute('data-backend') === 'gl' && (bridge.debug()?.frames ?? 0) > 0;
  }, undefined, { timeout: 90_000, polling: 500 }).then(() => true).catch(() => false);
  const backend = await page.locator('[data-testid="wallpaint-3d"]').first().getAttribute('data-backend').catch(() => null);
  if (!firstFrame || backend !== 'gl') {
    failed = true;
    console.error(`3D stage did not reach a GL first frame (backend=${backend}); not writing designer-3d.webp`);
  } else {
    // Product bodies are glTF files fetched after the first frame: wait until they
    // have all landed and the stage has stopped drawing, so no product is a grey box.
    const settled = await stageSettled(page, 45_000);
    const debug = await page.evaluate(() => window.__ppwRoomView3d?.debug() ?? null).catch(() => null);
    await hideBuildStamp(page);
    const png = await page.screenshot({ type: 'png', timeout: 90_000 });
    const result = await encode(png, path.join(out, 'designer-3d.webp'));
    report.shots.push({ name: 'designer-3d', view: '3d', backend, frames: debug?.frames ?? null, bodies: settled?.bodies ?? null, renderer: debug?.renderer ?? null, ...result, consoleErrors: errors });
    console.log('shot designer-3d', result.bytes, 'bytes', result.quality ? `q${result.quality}` : '', 'frames', debug?.frames, 'bodies', settled?.bodies);
  }
  await ctx.close();
}

await plain.close();
await gl.close();
for (const shot of report.shots) {
  if (shot.bytes > MAX_BYTES) { failed = true; console.error(`${shot.name} is ${shot.bytes} bytes, over the ${MAX_BYTES} budget`); }
}
console.log(JSON.stringify(report, null, 2));
process.exit(failed ? 1 : 0);
