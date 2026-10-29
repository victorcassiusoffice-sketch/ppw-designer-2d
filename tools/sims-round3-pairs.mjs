// Fresh Chromium process per navigation. No throttling, no warmup loads.
// Usage: node tools/sims-round3-pairs.mjs <preview> [pairs=5] [output]
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
const [preview, countText = '5', out = '../olb-round3-scratch/paired-loads.json'] = process.argv.slice(2);
if (!preview) throw new Error('Preview URL required');
const count = Number(countText);
const targets = { production: 'https://onelivebuild.com', preview };
const report = { startedAt: new Date().toISOString(), method: 'Fresh Chromium process/profile per navigation, D3D11, no CPU/network throttling. Alternating pair order. Phone viewport/touch emulation, not physical phone. Same-minute start times required. Harness firstMs includes waiting for GL and loading-panel removal; app firstPictureMs is also retained. Transfer sizes include navigation and completed resources; settled bytes measured 2.5s after readiness. No warmup runs.', pairs: [] };
mkdirSync(dirname(out), { recursive: true });
const save = () => writeFileSync(out, JSON.stringify(report, null, 2));
async function run(target, device) {
  const browser = await chromium.launch({ headless: true, args: ['--use-angle=d3d11', ...(process.env.VERCEL_EDGE ? [`--host-resolver-rules=MAP *.vercel.app ${process.env.VERCEL_EDGE}`] : [])] });
  const row = { target, device, base: targets[target], startedAt: null, errors: [], writes: [], edgeOverride: process.env.VERCEL_EDGE ?? null };
  try {
    const context = await browser.newContext({ viewport: device === 'desktop' ? { width:1280,height:800 } : { width:390,height:844 }, isMobile: device === 'phone', hasTouch: device === 'phone' });
    await context.addInitScript(() => {
      localStorage.setItem('ppw_designer_coach_v1', '1');
      const st = window.__round3 = { loadingSeenMs:null, loadingHiddenMs:null, longTasks:[] };
      new PerformanceObserver(list => { for (const e of list.getEntries()) st.longTasks.push({ start:Math.round(e.startTime), duration:Math.round(e.duration) }); }).observe({ type:'longtask',buffered:true });
      setInterval(() => {
        const loading = [...document.querySelectorAll('[data-testid="loading-3d"]')].some(e => e.getBoundingClientRect().width && getComputedStyle(e).visibility !== 'hidden');
        const gl = document.querySelector('[data-testid="wallpaint-3d-gl"]');
        if (loading) st.loadingSeenMs ??= performance.now();
        if (!loading && gl?.getAttribute('data-first-picture-ms')) st.loadingHiddenMs ??= performance.now();
      }, 20);
    });
    await context.route('**/*', route => {
      if (!['GET','HEAD','OPTIONS'].includes(route.request().method())) { row.writes.push(route.request().method()); return route.abort(); }
      return route.continue();
    });
    const page = await context.newPage(); page.setDefaultTimeout(90000);
    page.on('pageerror', e => row.errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error') row.errors.push(m.text()); });
    const start = Date.now(); row.startedAt = new Date(start).toISOString();
    const response = await page.goto(`${targets[target]}/demo?view=3d&pitch=1`, { waitUntil:'domcontentloaded' });
    row.status = response?.status(); row.dclMs = Date.now()-start;
    await page.getByTestId('wallpaint-3d-gl').waitFor();
    await page.getByTestId('loading-3d').waitFor({ state:'hidden' });
    row.firstMs = Date.now()-start;
    await page.waitForTimeout(2500);
    Object.assign(row, await page.evaluate(() => {
      const gl = document.querySelector('[data-testid="wallpaint-3d-gl"]');
      const firstPictureMs = Number(gl?.getAttribute('data-first-picture-ms'));
      const resources = performance.getEntriesByType('resource');
      const nav = performance.getEntriesByType('navigation')[0];
      const through = resources.filter(r => r.responseEnd <= firstPictureMs);
      return {
        ...window.__round3, firstPictureMs:Math.round(firstPictureMs),
        firstTransferBytes:nav.transferSize + through.reduce((s,r) => s+r.transferSize,0),
        settledTransferBytes:nav.transferSize + resources.reduce((s,r) => s+r.transferSize,0),
        responseEndMs:Math.round(nav.responseEnd), fcpMs:performance.getEntriesByName('first-contentful-paint')[0]?.startTime,
        fonts:resources.filter(r=>/\.woff2/.test(r.name)).map(r=>({ name:r.name.split('/').pop(),bytes:r.transferSize })),
        snapshotRequests:resources.filter(r=>/modelSnapshot/.test(r.name)).length,
        gl:Object.fromEntries([...gl.attributes].filter(a=>a.name.startsWith('data-')).map(a=>[a.name,a.value])),
      };
    }));
  } catch (error) { row.fatal = String(error); }
  finally { await browser.close(); }
  return row;
}
for (const device of ['desktop','phone']) for (let n=1;n<=count;n++) {
  // Start sufficiently early in a minute to accommodate both cold visits.
  const ms = Date.now()%60000;
  if (ms > 18000) await new Promise(resolve=>setTimeout(resolve,60000-ms+250));
  const pair = { device, n, rows:[] }; report.pairs.push(pair); save();
  for (const target of n%2 ? ['production','preview'] : ['preview','production']) {
    const row = await run(target,device); pair.rows.push(row); save();
    console.log(JSON.stringify({device,n,target,start:row.startedAt,firstMs:row.firstMs,appMs:row.firstPictureMs,loadingMs:row.loadingSeenMs,bytes:row.firstTransferBytes,errors:row.errors,fatal:row.fatal}));
  }
  const [prod,next] = ['production','preview'].map(t=>pair.rows.find(r=>r.target===t));
  pair.sameMinute = prod.startedAt.slice(0,16) === next.startedAt.slice(0,16);
  pair.previewNoSlower = next.firstMs <= prod.firstMs;
  save();
}
report.endedAt = new Date().toISOString(); save();
