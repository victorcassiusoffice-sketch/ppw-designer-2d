// Pitch + Studio frames (2026-09-26): the two pitch pages, their two client
// overlays (?client=cap-tamarin, ?client=spa-concept) and the Studio hub at
// laptop and phone widths, with a horizontal-overflow probe on every frame and
// a check that hero images and app captures actually loaded.
//
//   node tools/shoot-pitch-pages-2026-09-26.mjs [baseUrl] [outDir]
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const base = (process.argv[2] ?? 'http://127.0.0.1:5186').replace(/\/+$/, '');
const out = path.resolve(process.argv[3] ?? 'docs/designer-3d-mode-2026-09-17/studio-2026-09-26/pitch');
fs.mkdirSync(out, { recursive: true });
const GL_ARGS = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
const VIEWPORTS = [
  { id: 'desktop-1366', width: 1366, height: 860, mobile: false },
  { id: 'phone-390', width: 390, height: 844, mobile: true },
];
const PAGES = [
  { id: 'developers', url: '/pitch/developers' },
  { id: 'developers-cap-tamarin', url: '/pitch/developers?client=cap-tamarin' },
  { id: 'merchants', url: '/pitch/merchants' },
  { id: 'merchants-spa-concept', url: '/pitch/merchants?client=spa-concept' },
  { id: 'studio', url: '/studio' },
];
const evidence = { base, at: new Date().toISOString(), frames: [] };
let defects = 0;

async function open(browser, viewport) {
  const ctx = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height }, deviceScaleFactor: 1, isMobile: viewport.mobile, hasTouch: viewport.mobile });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.addInitScript(() => { try { localStorage.clear(); sessionStorage.clear(); localStorage.setItem('ppw_designer_coach_v1', '1'); } catch { /* fresh profile */ } });
  return { ctx, page, errors };
}

async function imagesLoaded(page, selector) {
  return page.waitForFunction((sel) => {
    const imgs = [...document.querySelectorAll(sel)];
    return imgs.length > 0 && imgs.every((img) => img.complete && img.naturalWidth > 0);
  }, selector, { timeout: 30_000 }).then(() => true).catch(() => false);
}

/** A visible embedded designer must have mounted (its route spinner gone, its canvas up) before the frame is taken. */
async function embeddedMounted(page) {
  const started = Date.now();
  while (Date.now() - started < 60_000) {
    const frames = page.frames().filter((f) => f.url().includes('/embed/designer'));
    if (frames.length) {
      const ready = await Promise.all(frames.map((f) => f.evaluate(() => !document.querySelector('[role="status"] .animate-spin') && !!document.querySelector('.konvajs-content canvas')).catch(() => false)));
      if (ready.every(Boolean)) { await page.waitForLoadState('networkidle').catch(() => {}); await page.waitForTimeout(1_500); return true; }
    }
    await page.waitForTimeout(500);
  }
  return false;
}

async function probe(page) {
  return page.evaluate(() => {
    const doc = document.documentElement;
    const wide = [...document.querySelectorAll('body *')].filter((el) => el.getBoundingClientRect().right > window.innerWidth + 1 && getComputedStyle(el).position !== 'fixed').slice(0, 5).map((el) => `${el.tagName.toLowerCase()}.${[...el.classList].join('.')}`);
    return { innerWidth: window.innerWidth, scrollWidth: Math.max(doc.scrollWidth, document.body.scrollWidth), overflow: Math.max(doc.scrollWidth, document.body.scrollWidth) > window.innerWidth, wide };
  });
}

async function frame(page, errors, name, extra = {}) {
  const file = path.join(out, `${name}.png`);
  await page.waitForTimeout(400);
  await page.screenshot({ path: file, timeout: 90_000 });
  const layout = await probe(page);
  const row = { name, file: path.basename(file), ...layout, consoleErrors: errors.splice(0), ...extra };
  if (layout.overflow) defects += 1;
  evidence.frames.push(row);
  console.log(layout.overflow ? 'OVERFLOW' : 'ok', name, `${layout.scrollWidth}/${layout.innerWidth}`, extra.heroLoaded === false || extra.captureLoaded === false ? 'IMAGE MISSING' : '');
}

const tab = (page, index) => page.locator('[role="tab"]').nth(index).click();
const press = (page, text) => page.getByRole('button', { name: text, exact: false }).first().click();

const plain = await chromium.launch();
const gl = await chromium.launch({ args: GL_ARGS });

for (const viewport of VIEWPORTS) {
  for (const spec of PAGES) {
    const { ctx, page, errors } = await open(plain, viewport);
    await page.goto(`${base}${spec.url}`, { waitUntil: 'networkidle' });
    const heroLoaded = await imagesLoaded(page, '.pitch-hero-art img, .studio-hero-art img');
    if (!heroLoaded) defects += 1;
    await frame(page, errors, `${spec.id}-${viewport.id}-01-hero`, { heroLoaded });

    if (spec.id === 'developers') {
      await tab(page, 1);
      await press(page, 'App screenshots');
      let captureLoaded = await imagesLoaded(page, '.pitch-app-capture img');
      let caption = await page.locator('.pitch-app-capture figcaption').first().textContent();
      if (!captureLoaded || !/Captured in the app/.test(caption ?? '')) defects += 1;
      await frame(page, errors, `${spec.id}-${viewport.id}-02-captures-2d`, { captureLoaded, caption });
      await page.locator('.pitch-capture-gallery .pitch-segment button', { hasText: 'Premium 3D' }).click();
      captureLoaded = await imagesLoaded(page, '.pitch-app-capture img');
      caption = await page.locator('.pitch-app-capture figcaption').first().textContent();
      if (!captureLoaded || !/Captured in the app/.test(caption ?? '')) defects += 1;
      await frame(page, errors, `${spec.id}-${viewport.id}-03-captures-3d`, { captureLoaded, caption });
      // Back to the live designer: its canvas must still exist at a real size (a display:none park killed it, 2026-09-26).
      await press(page, 'Live designer');
      await page.waitForTimeout(2_000);
      const embedded = page.frames().find((f) => f.url().includes('/embed/designer'));
      const liveReturns = embedded ? await embedded.evaluate(() => { const c = document.querySelector('.konvajs-content canvas'); return !!c && c.width > 0 && c.height > 0; }).catch(() => false) : false;
      if (!liveReturns) defects += 1;
      await frame(page, errors, `${spec.id}-${viewport.id}-04-live-returns`, { liveReturns });
      await tab(page, 4);
      await frame(page, errors, `${spec.id}-${viewport.id}-05-build-together`);
    }
    if (spec.id === 'developers-cap-tamarin') {
      await tab(page, 4);
      const models = await page.locator('[data-testid="operating-models"]').textContent();
      await frame(page, errors, `${spec.id}-${viewport.id}-02-operating-models`, { modelsHaveDigits: /\d/.test(models ?? '') });
    }
    if (spec.id === 'merchants' && !viewport.mobile) {
      await tab(page, 1);
      await press(page, 'Paint');
      await frame(page, errors, `${spec.id}-${viewport.id}-02-categories-paint`);
    }
    if (spec.id === 'merchants-spa-concept') {
      await tab(page, 1);
      const buildPressed = await page.getByRole('button', { name: 'Build', exact: true }).getAttribute('aria-pressed');
      await frame(page, errors, `${spec.id}-${viewport.id}-02-categories-build`, { buildPressed });
      if (!viewport.mobile) {
        await tab(page, 2);
        const studioPressed = await page.getByRole('button', { name: /Standalone studio/ }).getAttribute('aria-pressed');
        const embedded = await embeddedMounted(page);
        if (!embedded) defects += 1;
        await frame(page, errors, `${spec.id}-${viewport.id}-03-storefront`, { studioPressed, embeddedMounted: embedded });
      }
    }
    await ctx.close();
  }
}

// The Cap Tamarin live tab: the embedded designer must reach a GL first frame of the two-bedroom scene.
{
  const viewport = VIEWPORTS[0];
  const { ctx, page, errors } = await open(gl, viewport);
  await page.goto(`${base}/pitch/developers?client=cap-tamarin`, { waitUntil: 'networkidle' });
  await tab(page, 1);
  const designer = await page.waitForFunction(() => [...document.querySelectorAll('iframe')].some((f) => f.src.includes('scene=captamarin')), undefined, { timeout: 30_000 }).then(() => true).catch(() => false);
  let sceneFrame = null;
  for (let i = 0; i < 60 && !sceneFrame; i++) { sceneFrame = page.frames().find((f) => f.url().includes('scene=captamarin')) ?? null; if (!sceneFrame) await page.waitForTimeout(500); }
  let glFirstFrame = false; let pageName = null;
  if (sceneFrame) {
    glFirstFrame = await sceneFrame.waitForFunction(() => {
      const b = window.__ppwRoomView3d; const s = document.querySelector('[data-testid="wallpaint-3d"]');
      return !!b && s?.getAttribute('data-backend') === 'gl' && (b.debug()?.frames ?? 0) > 0;
    }, undefined, { timeout: 120_000, polling: 500 }).then(() => true).catch(() => false);
    await sceneFrame.waitForLoadState('networkidle').catch(() => {});
    await page.waitForTimeout(5_000);
    pageName = await sceneFrame.evaluate(() => document.title).catch(() => null);
  }
  if (!designer || !glFirstFrame) defects += 1;
  await frame(page, errors, `developers-cap-tamarin-${viewport.id}-03-live-3d`, { designerIframe: designer, glFirstFrame, embeddedTitle: pageName });
  await ctx.close();
}

await plain.close();
await gl.close();
evidence.defects = defects;
fs.writeFileSync(path.join(out, 'evidence.json'), JSON.stringify(evidence, null, 2));
console.log(`done ${evidence.frames.length} frames, ${defects} defect(s) -> ${out}`);
process.exit(defects ? 1 : 0);
