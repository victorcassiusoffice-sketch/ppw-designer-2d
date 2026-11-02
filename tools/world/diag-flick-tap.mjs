// DIAGNOSTIC, not a formal gate: after a quick native look flick on the Walk
// screen, does a zero-duration tap on a HUD button still produce a click, and
// how long must the gap be? Round-3 and the local round-4 reproduction show the
// door tap failing ~100 ms after the last look-flick touchend. Arms: look flick
// (touchStart, one touchMove 40 px, touchEnd, no waits) then a CDP tap on the
// Controls button after a declared gap; a slow drag control arm; a stick (move
// pad) flick arm. Usage: node tools/world/diag-flick-tap.mjs [target] --label=r4-diag-flick-tap-<browser>
import { launch, newCtx, watch, save, TARGETS, OUT, wait3d, installTapRecorder, PLAYWRIGHT_VERSION, BROWSER_EXECUTABLE } from './lib.mjs';
const target = process.argv[2] || 'localwalk';
const report = { startedAt: new Date().toISOString(), target, url: TARGETS[target], diagnostic: true, playwright: PLAYWRIGHT_VERSION, browser: BROWSER_EXECUTABLE,
  method: 'Phone viewport 390x844, touch emulation, one fresh context per arm. Open Walk, start, wait for the first published status. A preceding native gesture (look flick 40 px with no waits; slow look drag 40 px over 10 steps of 30 ms; stick flick 40 px) is followed after a declared gap by a CDP touchStart+touchEnd on the Controls button. Click delivery and the help card opening are recorded with every window-capture event. Diagnostic only.', cases: [] };
const browser = await launch();
const arms = [];
for (const gapMs of [60, 100, 150, 200, 260, 320, 400, 600, 1000]) arms.push({ gesture: 'look-flick', gapMs });
for (const gapMs of [100, 400]) arms.push({ gesture: 'look-slow-drag', gapMs });
for (const gapMs of [100, 400]) arms.push({ gesture: 'stick-flick', gapMs });
arms.push({ gesture: 'none', gapMs: 0 });
for (const arm of arms) {
  const { context, log } = await newCtx(browser, 'phone'); await installTapRecorder(context);
  const page = await context.newPage(); page.setDefaultTimeout(60000);
  const row = { ...arm, startedAt: new Date().toISOString() }; report.cases.push(row); watch(page, row);
  try {
    await page.goto(TARGETS[target] + '/demo?view=3d&pitch=1', { waitUntil: 'domcontentloaded' }); await wait3d(page);
    await page.getByRole('button', { name: 'Open Walk mode', exact: true }).click();
    await page.getByRole('button', { name: 'Start walk', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('[data-world-walk]')?.getAttribute('data-status'), {}, { timeout: 60000 });
    await page.waitForTimeout(500);
    const cdp = await context.newCDPSession(page);
    const controls = page.getByRole('button', { name: 'Controls', exact: true }); await controls.waitFor();
    const box = await controls.boundingBox(); const point = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    await page.evaluate(() => { window.__tapRecord.events.length = 0; });
    if (arm.gesture === 'look-flick') {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 230, y: 400, id: 1 }] });
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 270, y: 400, id: 1 }] });
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    } else if (arm.gesture === 'look-slow-drag') {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 230, y: 400, id: 1 }] });
      for (let step = 1; step <= 10; step++) { await page.waitForTimeout(30); await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 230 + step * 4, y: 400, id: 1 }] }); }
      await page.waitForTimeout(30);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    } else if (arm.gesture === 'stick-flick') {
      const pad = await page.locator('.world-walk-stick').boundingBox();
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: pad.x + pad.width / 2, y: pad.y + pad.height / 2, id: 1 }] });
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: pad.x + pad.width / 2, y: pad.y + pad.height / 2 - 40, id: 1 }] });
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    }
    row.gestureEndedAt = await page.evaluate(() => performance.now());
    if (arm.gapMs) await page.waitForTimeout(arm.gapMs);
    row.tapCommandedAt = await page.evaluate(() => performance.now());
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: point.x, y: point.y, id: 1 }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await page.waitForTimeout(1200);
    row.helpOpened = await page.getByRole('button', { name: 'Got it', exact: true }).isVisible();
    row.events = await page.evaluate(() => window.__tapRecord.events);
    const tapEvents = row.events.filter(e => e.eventAt >= row.tapCommandedAt - 5);
    row.clickObserved = tapEvents.some(e => e.type === 'click' && e.trusted);
    row.mouseCompat = tapEvents.filter(e => ['mousedown', 'mouseup'].includes(e.type)).length;
    const lastGestureUp = row.events.filter(e => e.type === 'pointerup' && e.eventAt < row.tapCommandedAt - 5).pop();
    const tapDown = tapEvents.find(e => e.type === 'pointerdown');
    row.actualGapMs = lastGestureUp && tapDown ? tapDown.eventAt - lastGestureUp.eventAt : null;
    row.tapDispatchDelayMs = tapDown ? tapDown.listenerAt - tapDown.eventAt : null;
  } catch (error) { row.fatal = String(error).slice(0, 800); await page.screenshot({ path: OUT + `diag-flick-${arm.gesture}-${arm.gapMs}-failure.jpg`, type: 'jpeg', quality: 60 }).catch(() => {}); }
  finally { row.blockedWrites = log.blockedWrites; await context.close(); save('diag-flick-tap.json', report); console.log(JSON.stringify({ gesture: arm.gesture, gapMs: arm.gapMs, actualGapMs: row.actualGapMs, clickObserved: row.clickObserved, helpOpened: row.helpOpened, mouseCompat: row.mouseCompat, delayMs: row.tapDispatchDelayMs, fatal: row.fatal })); }
}
await browser.close(); report.endedAt = new Date().toISOString(); save('diag-flick-tap.json', report);
