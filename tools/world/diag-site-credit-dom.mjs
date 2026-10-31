// DIAGNOSTIC for the phone live-map credit strip: the same steps as the seven-case
// campaign's live-map case, then in one evaluate the geometry of the map shell,
// the map container, the WebGL canvas, the canvas container, the credit strip and
// its anchors, the computed position/z-index of each, the element on top at the
// strip's centre, and a full-page screenshot in the same instant. Repeated in
// fresh contexts. Usage: node tools/world/diag-site-credit-dom.mjs site --expected=<sha> --label=<unique> [--sessions=3]
import { launch, newCtx, watch, save, TARGETS, OUT, health } from './lib.mjs';
const target = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : 'site';
const expected = process.argv.find(a => a.startsWith('--expected='))?.slice(11);
const sessions = Number(process.argv.find(a => a.startsWith('--sessions='))?.slice(11) ?? 3);
/** immediate = screenshot in the same task as the programmatic scroll (the seven-case harness); two-frames = after two animation frames. */
const arm = process.argv.find(a => a.startsWith('--arm='))?.slice(6) ?? 'immediate';
if (!['immediate', 'two-frames'].includes(arm)) throw Error('--arm must be immediate or two-frames');
if (!/^[a-f0-9]{40}$/.test(expected ?? '')) throw Error('Pass --expected=<exact published SHA>.');
const report = { startedAt: new Date().toISOString(), diagnostic: true, arm, gpuArgs: process.env.WORLD_NO_GPU === '1' ? 'none' : 'd3d11', target, expected, healthBefore: await health(target), rows: [] };
save('diag-site-credit-dom.json', report);
if (report.healthBefore.status !== 200 || report.healthBefore.body.commit !== expected || report.healthBefore.body.env !== 'preview') throw Error('Unexpected deployed head/environment.');
const browser = await launch();
const geometry = () => page => page.evaluate(() => {
  const rect = e => { if (!e) return null; const r = e.getBoundingClientRect(); return { x: +r.x.toFixed(1), y: +r.y.toFixed(1), w: +r.width.toFixed(1), h: +r.height.toFixed(1) }; };
  const style = e => { if (!e) return null; const s = getComputedStyle(e); return { position: s.position, zIndex: s.zIndex, overflow: s.overflow, height: s.height, display: s.display, visibility: s.visibility, opacity: s.opacity, transform: s.transform }; };
  const q = s => document.querySelector(s);
  const strip = q('.site-attribution'), canvas = q('.maplibregl-canvas'), container = q('.maplibregl-canvas-container'), mapEl = q('.site-map'), shell = q('.site-map-shell'), scroll = q('.site-scroll');
  const sr = strip?.getBoundingClientRect();
  const top = sr ? document.elementFromPoint(sr.x + sr.width / 2, sr.y + sr.height / 2) : null;
  return {
    scroll: { rect: rect(scroll), scrollTop: scroll?.scrollTop ?? null, style: style(scroll) },
    shell: { rect: rect(shell), style: style(shell) }, map: { rect: rect(mapEl), style: style(mapEl) },
    canvasContainer: { rect: rect(container), style: style(container) },
    canvas: canvas && { rect: rect(canvas), style: style(canvas), width: canvas.width, height: canvas.height, cssWidth: canvas.clientWidth, cssHeight: canvas.clientHeight, dpr: devicePixelRatio },
    strip: { rect: rect(strip), style: style(strip), text: strip?.textContent?.trim() ?? null, topElement: top && { tag: top.tagName, className: top.getAttribute('class'), text: top.textContent?.trim().slice(0, 40) } },
    anchors: [...document.querySelectorAll('.site-attribution a')].map(a => rect(a)),
    controls: [...document.querySelectorAll('.maplibregl-ctrl')].map(c => ({ className: c.getAttribute('class'), rect: rect(c) })),
    viewport: { w: innerWidth, h: innerHeight },
  };
});
for (let session = 1; session <= sessions; session++) {
  const { context, log } = await newCtx(browser, 'phone', { serviceWorkers: 'block' });
  const page = await context.newPage(); page.setDefaultTimeout(60000);
  const row = { session, moments: [] }; report.rows.push(row); watch(page, row);
  try {
    await page.goto(TARGETS[target] + '/demo?view=2d&pitch=1&site=1&live=1', { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'Site from the map', exact: true }).click({ timeout: 45000 });
    await page.locator('.site-workspace').waitFor();
    await page.locator('.maplibregl-canvas').waitFor({ timeout: 30000 });
    await page.waitForTimeout(2500);
    row.moments.push({ label: 'map-ready', ...await geometry()(page) });
    await page.getByRole('textbox', { name: 'Find a place', exact: true }).fill('Tamarin Mauritius');
    await page.getByRole('button', { name: 'Search', exact: true }).click();
    await page.locator('.site-search-results button').first().waitFor({ timeout: 20000 });
    await page.locator('.site-search-results button').first().click();
    await page.waitForTimeout(700);
    await page.locator('.site-map-shell').evaluate(element => element.scrollIntoView({ block: 'start' }));
    row.moments.push({ label: 'after-search', ...await geometry()(page) });
    const box = await page.locator('.site-map').boundingBox();
    for (const [x, y] of [[.35, .35], [.65, .35], [.65, .65], [.35, .65]]) await page.touchscreen.tap(box.x + box.width * x, box.y + box.height * y);
    await page.waitForFunction(() => document.querySelectorAll('.site-corner').length === 4, undefined, { timeout: 20000 });
    await page.getByRole('button', { name: 'Close & check boundary', exact: true }).click();
    await page.locator('.site-map-shell').evaluate(element => element.scrollIntoView({ block: 'start' }));
    if (arm === 'two-frames') await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const atShot = await geometry()(page);
    await page.screenshot({ path: OUT + `credit-dom-s${session}.png`, type: 'png' });
    const strip = await page.locator('.site-attribution').boundingBox();
    if (strip) {
      const clip = await page.screenshot({ clip: { x: strip.x, y: strip.y, width: strip.width, height: strip.height }, type: 'png' });
      const { data, info } = await (await import('sharp')).default(clip).raw().toBuffer({ resolveWithObject: true });
      let dark = 0; for (let i = 0; i < data.length; i += info.channels) if (.2126 * data[i] + .7152 * data[i + 1] + .0722 * data[i + 2] < 140) dark++;
      row.stripInkShareAtScreenshot = dark / (info.width * info.height);
      const full = await (await import('sharp')).default(OUT + `credit-dom-s${session}.png`).extract({ left: Math.round(strip.x), top: Math.round(strip.y), width: Math.round(strip.width), height: Math.round(strip.height) }).raw().toBuffer({ resolveWithObject: true });
      let darkFull = 0; for (let i = 0; i < full.data.length; i += full.info.channels) if (.2126 * full.data[i] + .7152 * full.data[i + 1] + .0722 * full.data[i + 2] < 140) darkFull++;
      row.stripInkShareInPageCapture = darkFull / (full.info.width * full.info.height);
    }
    const afterShot = await geometry()(page);
    row.moments.push({ label: 'at-screenshot', ...atShot }, { label: 'after-screenshot', ...afterShot });
    await page.waitForTimeout(1500);
    row.moments.push({ label: 'after-1500ms', ...await geometry()(page) });
    await page.screenshot({ path: OUT + `credit-dom-s${session}-late.png`, type: 'png' });
  } catch (error) { row.error = String(error).slice(0, 800); }
  finally {
    row.blockedWrites = log.blockedWrites; await context.close(); save('diag-site-credit-dom.json', report);
    console.log(JSON.stringify({ session, arm, error: row.error, inkPage: row.stripInkShareInPageCapture, inkClip: row.stripInkShareAtScreenshot, moments: row.moments.map(m => ({ label: m.label, scrollTop: m.scroll.scrollTop, map: m.map.rect, canvasCss: m.canvas && [m.canvas.cssWidth, m.canvas.cssHeight], canvasAttr: m.canvas && [m.canvas.width, m.canvas.height, m.canvas.dpr], strip: m.strip.rect, stripTop: m.strip.topElement?.className, controls: m.controls.length })) }));
  }
}
await browser.close(); report.endedAt = new Date().toISOString(); save('diag-site-credit-dom.json', report);
