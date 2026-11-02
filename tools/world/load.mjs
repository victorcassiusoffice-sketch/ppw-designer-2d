// Formal timing runs: each row gets a fresh browser process and profile.
import { launch, newCtx, watch, save, TARGETS, BASE_COMMIT, LABEL, wait3d, health } from './lib.mjs';
const branch = process.argv[2] || 'all', runs = Number(process.argv[3] || 5);
if (!['all', 'walk', 'site'].includes(branch) || !Number.isInteger(runs) || runs < 1) throw Error('Usage: node t14-load.mjs all|walk|site 5 --label=unique-name');
const branches = branch === 'all' ? ['walk', 'site'] : [branch];
const expectedHeads = Object.fromEntries(branches.map(name => {
 const sha = process.argv.find(a => a.startsWith(`--${name}-sha=`))?.split('=')[1];
 if (!/^[0-9a-f]{40}$/.test(sha || '')) throw Error(`Supply exact --${name}-sha=<40-character SHA> before a formal campaign.`);
 return [name, sha];
}));
const report = {
 startedAt: new Date().toISOString(), harnessVersion: '2.1-exact-head-guard', expectedHeads, label: LABEL, branch, branches, runs, base: TARGETS.base, baseCommit: BASE_COMMIT,
 method: 'Native D3D11; no CPU/network throttle; fresh browser process and profile per row; base, candidate(s), custom-domain interleaved for each run/device; all HTTPS hosts pinned to216.198.79.3. Both legacy navigation→observed loading-3d disappearance and exact canvas render timestamp are retained. Loading visibility separately observes #52 HTML startup and React-only loading. Historical reactLoadingSeen is the legacy loading-3d selector, which also matches #52 HTML; actualReactLoadingSeen excludes #designer-startup. Phone390×844 is touch emulation, not hardware. Formal pass requires both timing definitions unless a defect is proved; custom-domain results are informational.',
 healthBefore: [], rows: [],
};
for (const target of ['base', ...branches]) report.healthBefore.push(await health(target));
if (report.healthBefore[0].body.commit !== BASE_COMMIT) throw Error('Base preview is not exact56d852d: ' + JSON.stringify(report.healthBefore[0]));
for (const before of report.healthBefore.filter(h => h.target !== 'base')) if (before.body.commit !== expectedHeads[before.target]) throw Error('Candidate preview does not match the declared source SHA: ' + JSON.stringify(before));
save(`load-${branch}.json`, report);
for (let run = 1; run <= runs; run++) for (const device of ['desktop', 'phone']) for (const target of ['base', ...branches, 'prod']) {
 const browser = await launch(), { context, log } = await newCtx(browser, device), page = await context.newPage();
 page.setDefaultTimeout(90000);
 const row = { run, device, target, url: TARGETS[target], startedAt: new Date().toISOString() }; report.rows.push(row); watch(page, row);
 const cdp = await context.newCDPSession(page), requests = new Map(), allRequests = []; await cdp.send('Network.enable');
 cdp.on('Network.requestWillBeSent', e => { const row = { requestId: e.requestId, url: e.request.url, method: e.request.method, type: e.type, startEpoch: e.wallTime * 1000, initiatorType: e.initiator.type }; requests.set(e.requestId, row); allRequests.push(row); });
 cdp.on('Network.responseReceived', e => { const r = requests.get(e.requestId); if (r) { r.status = e.response.status; r.mime = e.response.mimeType; r.diskCache = e.response.fromDiskCache; } });
 cdp.on('Network.loadingFinished', e => { const r = requests.get(e.requestId); if (r) r.encodedBytes = e.encodedDataLength; });
 await context.addInitScript(() => {
  const state = window.__finishLoad = { loadingSeen: null, loadingHidden: null, htmlLoadingSeen: null, reactLoadingSeen: null, actualReactLoadingSeen: null, actualReactLoadingHidden: null, allLoadingHidden: null, firstPictureObserved: null, longTasks: [] };
  try { new PerformanceObserver(list => { for (const e of list.getEntries()) state.longTasks.push({ start: e.startTime, duration: e.duration }); }).observe({ type: 'longtask', buffered: true }); } catch {}
  const visible = selector => [...document.querySelectorAll(selector)].some(el => { const r = el.getBoundingClientRect(), s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.display !== 'none' && s.visibility !== 'hidden' && s.opacity !== '0'; });
  const poll = setInterval(() => {
   const now = performance.now(), html = visible('#designer-startup'), react = visible('[data-testid="loading-3d"]'), actualReact = visible('[data-testid="loading-3d"]:not(#designer-startup)');
   if (html && state.htmlLoadingSeen === null) state.htmlLoadingSeen = now;
   if (react && state.reactLoadingSeen === null) state.reactLoadingSeen = now;
   if (actualReact && state.actualReactLoadingSeen === null) state.actualReactLoadingSeen = now;
   if (state.actualReactLoadingSeen !== null && !actualReact && state.actualReactLoadingHidden === null) state.actualReactLoadingHidden = now;
   if ((html || react) && state.loadingSeen === null) state.loadingSeen = now;
   // Preserve the legacy selector, which also matches the HTML startup in #52.
   if (state.reactLoadingSeen !== null && !document.querySelector('[data-testid="loading-3d"]') && state.loadingHidden === null) state.loadingHidden = now;
   const first = Number(document.querySelector('[data-first-picture-ms]')?.getAttribute('data-first-picture-ms'));
   if (first > 0 && state.firstPictureObserved === null) state.firstPictureObserved = now;
   if (state.loadingSeen !== null && !html && !react && first > 0 && state.allLoadingHidden === null) { state.allLoadingHidden = now; clearInterval(poll); }
  }, 30);
 });
 try {
  const start = Date.now(); const response = await page.goto(TARGETS[target] + '/demo?view=3d&pitch=1', { waitUntil: 'domcontentloaded' }); row.status = response?.status(); row.dclMs = Date.now() - start;
  await page.getByTestId('wallpaint-3d-gl').waitFor(); row.glMountedMs = Date.now() - start;
  await page.getByTestId('loading-3d').waitFor({ state: 'hidden' }); row.first3dMs = Date.now() - start;
  await wait3d(page); row.canvasFirstPictureMs = Number(await page.getByTestId('wallpaint-3d-gl').getAttribute('data-first-picture-ms'));
  await page.waitForTimeout(2500);
  Object.assign(row, await page.evaluate(() => ({ timeOrigin: performance.timeOrigin, timeline: window.__finishLoad, brand: document.documentElement.dataset.brand,
   nav: performance.getEntriesByType('navigation')[0].toJSON(), paints: performance.getEntriesByType('paint').map(p => ({ name: p.name, startTime: p.startTime })), resources: performance.getEntriesByType('resource').map(r => ({ url: r.name, start: r.startTime, end: r.responseEnd, transferBytes: r.transferSize, decodedBytes: r.decodedBodySize, encodedBytes: r.encodedBodySize, initiator: r.initiatorType })),
   pictureDiagnostics: { ...document.querySelector('[data-testid="wallpaint-3d-gl"]').dataset } })));
  row.requests = allRequests.map(r => ({ ...r, startMs: r.startEpoch - row.timeOrigin, beforePicture: r.startEpoch - row.timeOrigin <= row.canvasFirstPictureMs }));
 } catch (error) { row.fatal = String(error).slice(0, 1000); }
 finally {
  row.blockedWrites = log.blockedWrites; row.endedAt = new Date().toISOString();
  await context.close(); await browser.close(); save(`load-${branch}.json`, report);
  console.log(JSON.stringify({ target, device, run, legacyWallMs: row.first3dMs, canvasMs: row.canvasFirstPictureMs, loadingSeenMs: row.timeline?.loadingSeen, reactLoadingSeenMs: row.timeline?.reactLoadingSeen, errors: row.pageErrors.length, fatal: row.fatal }));
 }
}
report.healthAfter = [];
for (const target of ['base', ...branches]) report.healthAfter.push(await health(target));
report.healthStable = report.healthBefore.every((before, i) => before.body.commit === report.healthAfter[i].body.commit);
report.endedAt = new Date().toISOString(); save(`load-${branch}.json`, report);
if (!report.healthStable) throw Error('A deployment changed during the timing campaign; all rows are retained, campaign is not valid final proof.');
