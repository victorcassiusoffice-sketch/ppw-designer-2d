// DIAGNOSTIC, not a formal gate: does a zero-duration emulated touch tap on a Walk
// HUD button still produce a click when the page's main thread is busy at that
// moment? Round-3 evidence (r3-walk-functional-phone-v6) shows the door button
// receiving trusted pointerdown/touchstart/pointerup/touchend 0.1 ms apart, all
// four dispatched ~31 ms late, and no click. This reproduces that shape on a
// local build with a controlled main-thread block and compares tap durations.
// Usage: node tools/world/diag-phone-tap.mjs [target] --label=r4-diag-phone-tap-v1
import { launch, newCtx, watch, save, TARGETS, OUT, wait3d, installTapRecorder } from './lib.mjs';
const target = process.argv[2] || 'localwalk';
const report = { startedAt: new Date().toISOString(), target, url: TARGETS[target], diagnostic: true,
  method: 'Phone viewport 390x844, touch emulation. Each case: fresh context, open Walk, start, wait for the first published status, then one tap on the Controls button (help card opens on click). Arms: Playwright locator.tap(); CDP touchStart+touchEnd back to back; the same with a 60 ms synchronous main-thread block queued just before so both events are processed in one late turn; CDP touchStart, 100 ms hold, touchEnd. Every window-capture touch/pointer/mouse/click event is retained. Not a product measurement.',
  cases: [] };
const browser = await launch();
async function startWalk(page) {
  await page.goto(TARGETS[target] + '/demo?view=3d&pitch=1', { waitUntil: 'domcontentloaded' }); await wait3d(page);
  await page.getByRole('button', { name: 'Open Walk mode', exact: true }).click();
  await page.getByRole('button', { name: 'Start walk', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('[data-world-walk]')?.getAttribute('data-status'), {}, { timeout: 60000 });
}
const arms = ['locator-tap', 'cdp-0ms', 'cdp-0ms-busy60', 'cdp-0ms-busy60-repeat', 'cdp-100ms', 'cdp-100ms-busy60'];
for (const arm of arms) {
  const { context, log } = await newCtx(browser, 'phone'); await installTapRecorder(context);
  const page = await context.newPage(); page.setDefaultTimeout(60000);
  const row = { arm, startedAt: new Date().toISOString() }; report.cases.push(row); watch(page, row);
  try {
    await startWalk(page);
    const button = page.getByRole('button', { name: 'Controls', exact: true });
    await button.waitFor();
    const box = await button.boundingBox();
    row.box = box;
    await page.evaluate(() => { window.__tapRecord.events.length = 0; });
    const cdp = await context.newCDPSession(page);
    const point = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    row.commandedAt = await page.evaluate(() => performance.now());
    if (arm.includes('busy60')) {
      // Queue a synchronous block so the touch events wait for the main thread.
      await page.evaluate(() => { setTimeout(() => { const until = performance.now() + 60; while (performance.now() < until) { /* block */ } }, 0); });
    }
    if (arm === 'locator-tap') await button.tap({ noWaitAfter: true });
    else {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: point.x, y: point.y, id: 1 }] });
      if (arm.startsWith('cdp-100ms')) await page.waitForTimeout(100);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    }
    await page.waitForTimeout(1500);
    row.helpOpened = await page.getByRole('button', { name: 'Got it', exact: true }).isVisible();
    row.events = await page.evaluate(() => window.__tapRecord.events);
    row.clickObserved = row.events.some(e => e.type === 'click' && e.trusted);
    row.mouseCompat = row.events.filter(e => ['mousedown', 'mouseup'].includes(e.type)).length;
    row.dispatchDelayMs = Math.max(...row.events.filter(e => ['pointerdown', 'pointerup'].includes(e.type)).map(e => e.listenerAt - e.eventAt));
    row.downUpGapMs = (() => { const d = row.events.find(e => e.type === 'pointerdown'), u = row.events.find(e => e.type === 'pointerup'); return d && u ? u.eventAt - d.eventAt : null; })();
  } catch (error) { row.fatal = String(error).slice(0, 800); await page.screenshot({ path: OUT + `diag-${arm}-failure.jpg`, type: 'jpeg', quality: 60 }).catch(() => {}); }
  finally { row.blockedWrites = log.blockedWrites; await context.close(); save('diag-phone-tap.json', report); console.log(JSON.stringify({ arm, helpOpened: row.helpOpened, clickObserved: row.clickObserved, mouseCompat: row.mouseCompat, dispatchDelayMs: row.dispatchDelayMs, downUpGapMs: row.downUpGapMs, fatal: row.fatal })); }
}
await browser.close(); report.endedAt = new Date().toISOString(); save('diag-phone-tap.json', report);
