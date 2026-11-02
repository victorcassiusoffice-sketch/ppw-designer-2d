import { launch, newCtx, watch, save, TARGETS, wait3d, LABEL, health } from './lib.mjs';
const target = process.argv[2] || 'walk', durationMs = Number(process.argv[3] || 40000);
if (!Number.isFinite(durationMs) || durationMs < 1000 || durationMs > 120000) throw Error('Choose a fixed1–120s window.');
const expected=process.argv.find(argument=>argument.startsWith('--expected='))?.slice(11);
if(!/^[a-f0-9]{40}$/.test(expected??''))throw Error('Pass --expected=<exact published SHA>.');
const report = { startedAt: new Date().toISOString(), harnessVersion:2, label: LABEL, target, url: TARGETS[target], durationMs, expected,healthBefore:await health(target),
 method: 'Screenshot-free opt-in fixed wall-time measurement of completed Walk renders, both views/devices. Alternating native W/S each second; Shift during the second half. Every active completed-render interval is retained, including stalls>=250ms, with explicit pause spans and unfinished active tails. Independent rAF callback cadence is diagnostic only, never substituted for completed render FPS. Historical HUD aggregates remain separate. Native D3D11/no throttle; phone is emulated.', rows: [] };
save(`walk-framerate-${target}.json`,report);
if(report.healthBefore.status!==200||report.healthBefore.body.commit!==expected)throw Error('Unexpected deployed head; no browser launched.');
for (const device of ['desktop', 'phone']) {
 const browser = await launch(), { context, log } = await newCtx(browser, device), page = await context.newPage(); page.setDefaultTimeout(90000);
 try {
  await page.goto(TARGETS[target] + '/demo?view=3d&pitch=1', { waitUntil: 'domcontentloaded' }); await wait3d(page);
  await page.getByRole('button', { name: 'Open Walk mode', exact: true }).click();
  await page.getByRole('button', { name: 'Start walk', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('[data-world-walk]')?.getAttribute('data-status'));
  await page.waitForTimeout(3000); // Explicit warm-up, retained separately from measurement.
  for (const mode of ['third', 'first']) {
   const row = { device, mode, startedAt: new Date().toISOString(), warmupMs: 3000, inputSegments: [] }; report.rows.push(row); watch(page, row);
   if (mode === 'first') { await page.getByRole('button', { name: 'First person', exact: true }).click(); await page.waitForTimeout(1000); }
   row.historicalHudBefore = JSON.parse(await page.getByTestId('world-walk').getAttribute('data-status'));
   await page.locator('[data-world-walk] canvas').evaluate((canvas, durationMs) => {
    const data = window.__frameWindow = { armedAt: performance.now(), durationMs, raf: [], result: null, running: true, rafId: 0 };
    const tick = timestamp => { if (!data.running) return; data.raf.push({ timestamp, callbackAt: performance.now() }); data.rafId = requestAnimationFrame(tick); };
    data.rafId = requestAnimationFrame(tick);
    canvas.addEventListener('world-walk-frame-result', event => { data.result = event.detail; data.running = false; cancelAnimationFrame(data.rafId); }, { once: true });
    canvas.dispatchEvent(new CustomEvent('world-walk-measure-frames', { detail: { durationMs } }));
   }, durationMs);
   const start = Date.now(); let segment = 0;
   while (Date.now() - start < durationMs) {
    const elapsed = Date.now() - start, key = segment++ % 2 ? 'KeyS' : 'KeyW';
    if (elapsed >= durationMs / 2) await page.keyboard.down('ShiftLeft');
    await page.keyboard.down(key); row.inputSegments.push({ elapsedMs: Date.now() - start, key, running: elapsed >= durationMs / 2 });
    await page.waitForTimeout(Math.min(1000, Math.max(0, durationMs - (Date.now() - start)))); await page.keyboard.up(key);
   }
   await page.keyboard.up('ShiftLeft');
   await page.waitForFunction(() => window.__frameWindow.result, {}, { timeout: 5000 });
   row.window = await page.evaluate(() => window.__frameWindow);
   const measurement = row.window.result, raf = row.window.raf.filter(r => r.callbackAt >= measurement.startedAt && r.callbackAt <= measurement.deadlineAt);
   const intervals = raf.slice(1).map((r, i) => r.callbackAt - raf[i].callbackAt), slow = [...intervals].sort((a, b) => b - a).slice(0, Math.max(1, Math.ceil(intervals.length * .01)));
   row.rafDiagnostic = { callbacks: raf.length, intervalsMs: intervals, meanFps: intervals.length ? intervals.length * 1000 / intervals.reduce((a, b) => a + b, 0) : null, low1Fps: slow.length ? slow.length * 1000 / slow.reduce((a, b) => a + b, 0) : null };
   row.historicalHudAfter = JSON.parse(await page.getByTestId('world-walk').getAttribute('data-status'));
   row.targetFps = device === 'desktop' ? 60 : 30;
   row.completeUnpausedWindow = measurement.reason === 'deadline' && measurement.pausedMs === 0 && measurement.observedMs === durationMs;
   row.strictFpsPass = row.completeUnpausedWindow && measurement.completedFramesPerActiveSecond >= row.targetFps;
   row.blockedWrites = [...log.blockedWrites]; row.endedAt = new Date().toISOString();
   save(`walk-framerate-${target}.json`, report);
   console.log(JSON.stringify({ device, mode, fps: measurement.completedFramesPerActiveSecond, low1: measurement.low1CompletedIntervalFps, strictPass: row.strictFpsPass, activeMs: measurement.activeMs, pauses: measurement.pausedMs, frames: measurement.completedFrames, maxIntervalMs: Math.max(...measurement.intervals.map(i => i.durationMs)), maxTailMs: Math.max(0, ...measurement.unrenderedActiveTails.map(i => i.durationMs)) }));
  }
  await page.getByRole('button', { name: /Exit walk/ }).click();
 } catch (error) { report.rows.push({ device, fatal: String(error).slice(0, 1500), blockedWrites: log.blockedWrites }); save(`walk-framerate-${target}.json`, report); }
 finally { await context.close(); await browser.close(); }
}
report.healthAfter=await health(target);report.healthStable=report.healthBefore.body.commit===report.healthAfter.body.commit;
report.endedAt = new Date().toISOString(); save(`walk-framerate-${target}.json`, report);
if(!report.healthStable)throw Error('Deployment changed during frame campaign; all rows retained.');
