import { launch, newCtx, watch, save, TARGETS, wait3d } from './lib.mjs';
const branch = process.argv[2] ?? 'site', device = process.argv[3] ?? 'phone';
const report = { at: new Date().toISOString(), branch, device,
  method: 'One diagnostic CDP CPU-profiler pair through first picture. Fresh browser per target, native GPU, same pinned host and viewport. Sampling adds overhead; these are attribution samples, not replacements for formal timing pairs. Sample weights are clipped to NavigationStart through the app first-picture mark.', rows: [] };
for (const target of ['base', branch]) {
  const browser = await launch(), { context } = await newCtx(browser, device), page = await context.newPage(), cdp = await context.newCDPSession(page);
  const row = { target, url: TARGETS[target] + '/demo?view=3d&pitch=1' }; report.rows.push(row); watch(page, row);
  try {
    await cdp.send('Performance.enable'); await cdp.send('Debugger.enable');
    await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 1000 }); await cdp.send('Profiler.start');
    await page.goto(row.url, { waitUntil: 'domcontentloaded' }); await wait3d(page);
    const data = await page.evaluate(() => ({ firstPictureMs: Number(document.querySelector('[data-first-picture-ms]').dataset.firstPictureMs), now: performance.now(),
      timeOrigin: performance.timeOrigin, nav: performance.getEntriesByType('navigation')[0].toJSON(),
      resources: performance.getEntriesByType('resource').filter(r => /\/App-|\/ThreeStage-|vendor-three|vendor-react/.test(r.name)).map(r => ({ name: r.name, start: r.startTime, responseStart: r.responseStart, end: r.responseEnd })) }));
    Object.assign(row, data);
    const { metrics } = await cdp.send('Performance.getMetrics'); row.metrics = Object.fromEntries(metrics.map(m => [m.name, m.value]));
    const { profile } = await cdp.send('Profiler.stop');
    const nodes = new Map(profile.nodes.map(n => [n.id, n])), parent = new Map();
    for (const node of nodes.values()) for (const child of node.children ?? []) parent.set(child, node.id);
    const navStart = row.metrics.NavigationStart * 1e6, end = navStart + row.firstPictureMs * 1000;
    row.window = { navigationStartUs: navStart, firstPictureUs: end, profileStartUs: profile.startTime, profileEndUs: profile.endTime,
      clockDifferenceMs: (row.metrics.Timestamp - row.metrics.NavigationStart) * 1000 - row.now };
    const self = new Map(), total = new Map(); let clock = profile.startTime;
    for (let i = 0; i < profile.samples.length; i++) {
      const finish = clock + profile.timeDeltas[i], weight = Math.max(0, Math.min(finish, end) - Math.max(clock, navStart)); clock = finish;
      if (!weight) continue;
      let id = profile.samples[i]; self.set(id, (self.get(id) ?? 0) + weight);
      while (nodes.has(id)) { total.set(id, (total.get(id) ?? 0) + weight); if (!parent.has(id)) break; id = parent.get(id); }
    }
    const ranked = weights => [...weights.entries()].sort((a, b) => b[1] - a[1]).slice(0, 35).map(([id, us]) => ({ id, ms: us / 1000, frame: nodes.get(id).callFrame }));
    row.self = ranked(self); row.total = ranked(total);
    row.topStacks = row.self.slice(0, 12).map(item => {
      const stack = []; let id = item.id;
      while (nodes.has(id)) { stack.push(nodes.get(id).callFrame); if (!parent.has(id)) break; id = parent.get(id); }
      return { selfMs: item.ms, stack };
    });
    const sourceCache = new Map(); row.sourceSnippets = [];
    for (const item of row.self.slice(0, 12)) {
      const frame = item.frame; if (!frame.url || frame.lineNumber < 0) continue;
      if (!sourceCache.has(frame.scriptId)) sourceCache.set(frame.scriptId, (await cdp.send('Debugger.getScriptSource', { scriptId: frame.scriptId })).scriptSource.split('\n'));
      const line = sourceCache.get(frame.scriptId)[frame.lineNumber] ?? '';
      row.sourceSnippets.push({ frame, text: line.slice(Math.max(0, frame.columnNumber - 25), frame.columnNumber + 500) });
    }
    save(`mount-cpu-${branch}-${device}-${target}.json`, profile);
  } catch (error) { row.failure = String(error).split('\n')[0]; }
  finally { await browser.close(); row.browserClosed = true; save(`mount-cpu-${branch}-${device}-pair.json`, report);
    console.log(JSON.stringify({ target, firstPictureMs: row.firstPictureMs, window: row.window, topSelf: row.self?.slice(0, 6), failure: row.failure, browserClosed: true })); }
}
