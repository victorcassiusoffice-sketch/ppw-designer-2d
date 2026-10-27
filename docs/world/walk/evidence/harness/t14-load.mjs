// T14 (item 2, P1-5): first 3D picture time in a FRESH Chromium process (new profile, empty caches), no throttling.
// Per run: new browser process -> new context -> goto /demo?view=3d&pitch=1 -> time until the loading panel is hidden (the PR #50 harness measure)
// and, from an in-page poller started before navigation (performance.now() = ms since navigation start): first time the loading panel is visible,
// its text, first time the GL canvas exists, loading hidden, and the app's own data-*-ms marks when present.
// Optional screencast mode (visual=1) records frames so the first picture can be confirmed from pixels (grass visible), not only from DOM flags.
// Usage: node t14-load.mjs <targets> <devices> <runs> [visual]
import { launch, newCtx, watch, save, TARGETS, stamp, OUT } from './lib.mjs';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
const which = (process.argv[2] || 'prod,pr51').split(',');
const devices = (process.argv[3] || 'desktop,phone').split(',');
const runs = Number(process.argv[4] || 3);
const visual = process.argv[5] === 'visual';
const report = { startedAt: stamp(), which, devices, runs, visual, note: 'Each run = new Chromium process + new context (fresh profile, empty HTTP/shader caches), no network or CPU throttling, native D3D11. Pinned vercel.app hosts to 216.198.79.3 (laptop cannot reach other Vercel edges).', rows: [] };
const tag = visual ? 'visual' : 'timed';
for (let n = 1; n <= runs; n++) for (const device of devices) for (const t of which) { // interleaved so CDN/edge warmth is shared fairly
  const browser = await launch();
  const { context, log } = await newCtx(browser, device);
  await context.addInitScript(() => {
    const st = (window.__tl = { loadingSeen: null, loadingText: null, loadingHidden: null, glSeen: null, canvasSeen: null, texts: [], attrs: {}, marks: [] });
    const tick = () => {
      const now = performance.now();
      const el = document.querySelector('[data-testid="loading-3d"]');
      const vis = !!el && el.getBoundingClientRect().width > 0 && getComputedStyle(el).visibility !== 'hidden' && getComputedStyle(el).display !== 'none';
      if (vis && st.loadingSeen === null) { st.loadingSeen = now; }
      if (vis) { const tx = (el.innerText || '').replace(/\s+/g, ' ').trim(); if (tx && st.texts[st.texts.length - 1]?.t !== tx) st.texts.push({ ms: Math.round(now), t: tx.slice(0, 120) }); }
      if (st.loadingSeen !== null && !vis && st.loadingHidden === null && !document.querySelector('[data-testid="loading-3d"]:not([hidden])')) st.loadingHidden = now;
      if (st.loadingSeen !== null && !el && st.loadingHidden === null) st.loadingHidden = now;
      const gl = document.querySelector('[data-testid="wallpaint-3d-gl"]');
      if (gl && st.glSeen === null) st.glSeen = now;
      if (gl && gl.querySelector('canvas') && st.canvasSeen === null) st.canvasSeen = now;
      if (gl) { for (const a of gl.attributes) if (a.name.startsWith('data-') && /-ms$|picture|detail|auto-ao$|shading|quality/.test(a.name)) { if (st.attrs[a.name] !== a.value) { st.attrs[a.name] = a.value; st.marks.push({ ms: Math.round(now), n: a.name, v: String(a.value).slice(0, 40) }); } } }
    };
    setInterval(tick, 30);
  });
  const page = await context.newPage(); page.setDefaultTimeout(90000);
  const row = { target: t, base: TARGETS[t], device, run: n, mode: tag }; report.rows.push(row); watch(page, row);
  const frames = [];
  let cdp = null;
  const thr = Number(process.env.CPU_THROTTLE || 0);
  row.cpuThrottle = thr || 0;
  try {
    if (thr > 1) { const c2 = await context.newCDPSession(page); await c2.send('Emulation.setCPUThrottlingRate', { rate: thr }); }
    if (visual) {
      cdp = await context.newCDPSession(page);
      cdp.on('Page.screencastFrame', async ev => { frames.push({ ts: ev.metadata.timestamp * 1000, data: ev.data }); try { await cdp.send('Page.screencastFrameAck', { sessionId: ev.sessionId }); } catch {} });
      await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 40, maxWidth: device === 'desktop' ? 640 : 390, maxHeight: device === 'desktop' ? 400 : 844, everyNthFrame: 1 });
    }
    const t0 = Date.now();
    const resp = await page.goto(`${TARGETS[t]}/demo?view=3d&pitch=1`, { waitUntil: 'domcontentloaded' });
    row.status = resp?.status(); row.dclMs = Date.now() - t0;
    await page.getByTestId('wallpaint-3d-gl').waitFor({ timeout: 90000 }); row.glMountedMs = Date.now() - t0;
    await page.getByTestId('loading-3d').waitFor({ state: 'hidden', timeout: 90000 }); row.first3dMs = Date.now() - t0;
    await page.waitForTimeout(visual ? 3500 : 2500);
    row.timeOrigin = await page.evaluate(() => performance.timeOrigin);
    row.tl = await page.evaluate(() => window.__tl);
    row.gl = await page.getByTestId('wallpaint-3d-gl').evaluate(e => Object.fromEntries([...e.attributes].filter(a => a.name.startsWith('data-')).map(a => [a.name, a.value])));
    row.nav = await page.evaluate(() => { const n = performance.getEntriesByType('navigation')[0]; const res = performance.getEntriesByType('resource'); return { responseEnd: Math.round(n.responseEnd), domContentLoaded: Math.round(n.domContentLoadedEventEnd), load: Math.round(n.loadEventEnd), resources: res.length, transferKB: Math.round(res.reduce((s, r) => s + (r.transferSize || 0), 0) / 1024), jsKB: Math.round(res.filter(r => /\.js(\?|$)/.test(r.name)).reduce((s, r) => s + (r.transferSize || 0), 0) / 1024) }; });
    if (visual) {
      await cdp.send('Page.stopScreencast').catch(() => {});
      const dir = join(OUT, 'load-frames', `${t}-${device}-r${n}`); mkdirSync(dir, { recursive: true });
      const t00 = row.timeOrigin;
      row.frameCount = frames.length;
      row.frames = frames.map((f, i) => { const ms = Math.round(f.ts - t00); const file = `f${String(i).padStart(3, '0')}-${ms}ms.jpg`; writeFileSync(join(dir, file), Buffer.from(f.data, 'base64')); return { i, ms, file }; });
    }
  } catch (e) { row.fatal = String(e).slice(0, 400); }
  row.blockedWrites = log.blockedWrites;
  await context.close(); await browser.close();
  save(`t14-load-${tag}${process.env.CPU_THROTTLE ? '-cpu' + process.env.CPU_THROTTLE + 'x' : ''}-${which.join('_')}-${devices.join('_')}.json`, report);
  console.log(t, device, 'run', n, 'status', row.status, 'dcl', row.dclMs, 'gl', row.glMountedMs, 'first3d', row.first3dMs, 'inPage loadingSeen/hidden', Math.round(row.tl?.loadingSeen ?? -1), Math.round(row.tl?.loadingHidden ?? -1), 'marks', JSON.stringify(row.tl?.marks?.filter(m => /-ms$/.test(m.n)).map(m => `${m.n.replace('data-', '')}=${Math.round(Number(m.v))}`)), 'transferKB', row.nav?.transferKB, 'errs', row.consoleErrors?.length, row.pageErrors?.length, row.httpErrors?.length, row.fatal || '');
}
report.endedAt = stamp(); save(`t14-load-${tag}${process.env.CPU_THROTTLE ? '-cpu' + process.env.CPU_THROTTLE + 'x' : ''}-${which.join('_')}-${devices.join('_')}.json`, report);
