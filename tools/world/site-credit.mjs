// Bounded re-check of the live-map credit strip on the phone (round-3 item 4):
// one exact-head capture showed a blank strip where the DOM held three visible
// anchors. Five fresh sessions; in each, after a real search and a drawn
// boundary, the strip is captured at the same milestones as the round-3
// diagnostic and its pixels are inspected (share of dark pixels in the strip's
// own rectangle). A capture with no ink is a reproduction, retained as such.
// Needs the preview (env=preview) because the live map is a preview-only switch.
// Usage: node tools/world/site-credit.mjs site --expected=<40-hex sha> --label=<unique> [--sessions=5]
import { createRequire } from 'node:module';
import { launch, newCtx, watch, save, TARGETS, OUT, health } from './lib.mjs';
const require = createRequire(import.meta.url);
const sharp = require('sharp');
const target = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : 'site';
const expected = process.argv.find(a => a.startsWith('--expected='))?.slice(11);
const sessions = Number(process.argv.find(a => a.startsWith('--sessions='))?.slice(11) ?? 5);
if (!/^[a-f0-9]{40}$/.test(expected ?? '')) throw Error('Pass --expected=<exact published SHA>.');
const report = { startedAt: new Date().toISOString(), target, url: TARGETS[target], expected, sessions, healthBefore: await health(target),
  method: 'Phone viewport 390x844, touch emulation, one fresh context per session. /demo?view=2d&pitch=1&site=1&live=1, Site from the map, wait for the map canvas, search Tamarin Mauritius, take the first result, tap four corners, Close & check boundary, scroll the map shell into view. Captures: immediate, after fonts.ready + two frames, +500 ms, +1500 ms, after a native touch scroll and scrollIntoView. Each capture is the strip\'s own client rectangle; ink share = pixels with luminance below 140 over all pixels (the strip is white with dark text and links). A capture under 0.5 percent ink is blank. DOM geometry of the three anchors is recorded beside each capture. Every non-read request is blocked. Not a physical phone.', rows: [] };
save('site-credit.json', report);
if (report.healthBefore.status !== 200 || report.healthBefore.body.commit !== expected || report.healthBefore.body.env !== 'preview') throw Error('Unexpected deployed head/environment; no browser launched.');
const browser = await launch();
async function inkShare(buffer) {
  const { data, info } = await sharp(buffer).raw().toBuffer({ resolveWithObject: true });
  let dark = 0; const total = info.width * info.height;
  for (let i = 0; i < data.length; i += info.channels) { const l = .2126 * data[i] + .7152 * data[i + 1] + .0722 * data[i + 2]; if (l < 140) dark++; }
  return { width: info.width, height: info.height, darkPixels: dark, share: dark / total };
}
for (let session = 1; session <= sessions; session++) {
  const { context, log } = await newCtx(browser, 'phone');
  const page = await context.newPage(); page.setDefaultTimeout(60000);
  const row = { session, captures: [] }; report.rows.push(row); watch(page, row);
  const providerRequests = []; page.on('request', r => { if (/openfreemap\.org|photon\.komoot\.io|\/api\/site(?:\/|\?)/.test(r.url())) providerRequests.push(r.url()); });
  const capture = async label => {
    const strip = page.locator('.site-attribution');
    const box = await strip.boundingBox();
    const geometry = await page.evaluate(() => [...document.querySelectorAll('.site-attribution a')].map(a => { const r = a.getBoundingClientRect(); return { text: a.textContent, x: r.x, y: r.y, width: r.width, height: r.height, visible: r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight }; }));
    const entry = { label, at: await page.evaluate(() => performance.now()), fonts: await page.evaluate(() => document.fonts.status), box, anchors: geometry };
    if (box && box.width > 0 && box.height > 0) {
      const clip = { x: Math.max(0, box.x), y: Math.max(0, box.y), width: Math.min(box.width, 390 - Math.max(0, box.x)), height: Math.min(box.height, 844 - Math.max(0, box.y)) };
      const png = await page.screenshot({ clip, type: 'png' });
      const file = `credit-s${session}-${label}.png`; await sharp(png).toFile(OUT + file);
      Object.assign(entry, await inkShare(png), { file, clip });
      entry.blank = entry.share < .005;
    } else entry.blank = null;
    await page.screenshot({ path: OUT + `credit-s${session}-${label}-page.jpg`, type: 'jpeg', quality: 70 });
    row.captures.push(entry); save('site-credit.json', report);
  };
  try {
    await page.goto(TARGETS[target] + '/demo?view=2d&pitch=1&site=1&live=1', { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'Site from the map', exact: true }).tap();
    await page.locator('.maplibregl-canvas').waitFor({ timeout: 30000 });
    await page.waitForTimeout(2500);
    await page.getByRole('textbox', { name: 'Find a place', exact: true }).fill('Tamarin Mauritius');
    await page.getByRole('button', { name: 'Search', exact: true }).tap();
    await page.locator('.site-search-results button').first().waitFor({ timeout: 20000 });
    await page.locator('.site-search-results button').first().tap(); await page.waitForTimeout(700);
    await page.locator('.site-map-shell').scrollIntoViewIfNeeded();
    const box = await page.locator('.site-map').boundingBox();
    for (const [x, y] of [[.35, .35], [.65, .35], [.65, .65], [.35, .65]]) await page.touchscreen.tap(box.x + box.width * x, box.y + box.height * y);
    await page.getByRole('button', { name: 'Close & check boundary', exact: true }).tap();
    await page.locator('.site-map-shell').scrollIntoViewIfNeeded();
    await capture('immediate');
    await page.evaluate(() => document.fonts.ready); await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
    await capture('fonts-two-frames');
    await page.waitForTimeout(500); await capture('500ms');
    await page.waitForTimeout(1000); await capture('1500ms');
    const cdp = await context.newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 365, y: 650 }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 365, y: 450 }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await page.locator('.site-map-shell').scrollIntoViewIfNeeded(); await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
    await capture('after-native-scroll');
    row.mapErrors = await page.locator('.site-map-error').allTextContents();
    row.completed = true;
  } catch (error) { row.error = String(error).slice(0, 900); await page.screenshot({ path: OUT + `credit-s${session}-failure.jpg`, type: 'jpeg', quality: 65 }).catch(() => {}); }
  finally {
    row.providerRequests = providerRequests.length; row.blockedWrites = log.blockedWrites;
    row.blankCaptures = row.captures.filter(c => c.blank === true).map(c => c.label);
    row.passed = row.completed === true && row.captures.length === 5 && row.captures.every(c => c.blank === false && c.anchors.length === 3) && !row.pageErrors.length && !row.consoleErrors.length && !row.httpErrors.length && !row.blockedWrites.length && !(row.mapErrors ?? []).length;
    await context.close(); save('site-credit.json', report);
    console.log(JSON.stringify({ session, passed: row.passed, error: row.error, blank: row.blankCaptures, shares: row.captures.map(c => `${c.label}:${c.share === undefined ? 'n/a' : (c.share * 100).toFixed(2) + '%'}`) }));
  }
}
await browser.close();
try { report.healthAfter = await health(target); } catch (error) { report.healthAfter = { error: String(error) }; }
report.healthStable = report.healthAfter.status === 200 && report.healthAfter.body?.commit === expected;
report.reproduced = report.rows.some(r => r.blankCaptures?.length);
report.passed = report.healthStable && report.rows.length === sessions && report.rows.every(r => r.passed); report.endedAt = new Date().toISOString(); save('site-credit.json', report);
console.log(JSON.stringify({ passed: report.passed, reproduced: report.reproduced, sessions: report.rows.map(r => r.passed ? 'PASS' : 'FAIL') }));
if (!report.passed) process.exitCode = 1;
