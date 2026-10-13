/**
 * Demo-clean tap-through (row D6-DESIGNER-DEMO-CLEAN-1013).
 *
 * Opens the public /demo, then taps every visible button it can reach (one at
 * a time, Escape + reload between taps) and greps the WHOLE DOM after each tap:
 * every text node outside <script>/<style>, plus title, aria-label, alt,
 * placeholder, value and <option> text. A price or a retailer/client name
 * anywhere is a hit.
 *
 *   node tools/demo-clean/scan.mjs <base-url> [out-dir]
 *
 * Exit code 0 = 0 hits at 1280 and 390 for every start URL; 1 = hits.
 */
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const BASE = (process.argv[2] ?? 'http://localhost:5173').replace(/\/+$/, '');
const OUT = process.argv[3] ?? 'demo-clean-out';
mkdirSync(OUT, { recursive: true });

/** Prices, currencies and the retailer/client names a demo visitor must not see. */
export const FORBIDDEN = /\bRs\.?\s?\d|\bRs\b|\bMUR\b|\bUSD\b|\bEUR\b|\bGBP\b|€|£|\$\s?\d|\bSofap\b|sofaponlinestore|\bTintEX\b|\bPermoglaze\b|\bMauvilac\b|\bPolytol\b|Spa Concept|\bCourts\b|Cap Tamarin|Trimetys|\bK1\b|K1[- ]Sport|\bEmcar\b|\bDuraco\b|Kalachand|\bVAT\b/i;

const STARTS = process.env.DEMO_CLEAN_STARTS?.split(',') ?? ['/demo', '/demo?view=2d'];
const VIEWPORTS = [
  { name: '1280', viewport: { width: 1280, height: 800 }, mobile: false },
  { name: '390', viewport: { width: 390, height: 844 }, mobile: true },
];
/** Taps that leave the demo or wipe it; everything else is fair game. */
const SKIP = /clear|reset|delete|remove|sign in|log in|sign up|book|new tab|generate|submit|send|upload|import|download|save|export|share|print|undo|redo/i;

async function collect(page) {
  return page.evaluate((src) => {
    const re = new RegExp(src, 'i');
    const hits = new Set();
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const parent = n.parentElement;
      if (!parent || parent.closest('script,style,noscript')) continue;
      const t = n.textContent.trim();
      if (t && re.test(t)) hits.add(`text: ${t.slice(0, 140)}`);
    }
    for (const el of document.querySelectorAll('*')) {
      for (const a of ['title', 'aria-label', 'alt', 'placeholder', 'aria-description', 'data-tooltip']) {
        const v = el.getAttribute(a);
        if (v && re.test(v)) hits.add(`${a}: ${v.slice(0, 140)}`);
      }
      if ((el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') && el.value && re.test(el.value)) hits.add(`value: ${el.value.slice(0, 140)}`);
    }
    if (re.test(document.title)) hits.add(`document.title: ${document.title}`);
    return [...hits];
  }, FORBIDDEN.source);
}

const CANDIDATES = 'button, [role="button"], [role="tab"], [role="radio"], [role="menuitem"], summary';

/** Visible, enabled tap targets, keyed by data-testid or their label. */
async function buttonLabels(page) {
  return page.evaluate((sel) => {
    const seen = new Set();
    const out = [];
    for (const el of document.querySelectorAll(sel)) {
      const r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) continue;
      const s = getComputedStyle(el);
      if (s.visibility === 'hidden' || s.display === 'none' || el.disabled) continue;
      const label = (el.getAttribute('aria-label') || el.textContent || el.getAttribute('title') || '').trim().replace(/\s+/g, ' ').slice(0, 80);
      const key = el.getAttribute('data-testid') || label;
      if (!key || seen.has(key)) continue;
      seen.add(key);
      out.push({ label, key });
    }
    return out;
  }, CANDIDATES);
}

/** DOM click on the first visible target with this key (no hit-testing: a
 * floating card over the button must not stop the scan). */
async function clickKey(page, key) {
  return page.evaluate(([sel, k]) => {
    for (const el of document.querySelectorAll(sel)) {
      const r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2 || el.disabled) continue;
      const label = (el.getAttribute('aria-label') || el.textContent || el.getAttribute('title') || '').trim().replace(/\s+/g, ' ').slice(0, 80);
      if ((el.getAttribute('data-testid') || label) !== k) continue;
      el.click();
      return true;
    }
    return false;
  }, [CANDIDATES, key]);
}

async function open(page, url) {
  // Vercel preview hosts sometimes stall from this network: retry.
  for (let attempt = 1; ; attempt += 1) {
    try { await page.goto(BASE + url, { waitUntil: 'domcontentloaded', timeout: 60000 }); break; } catch (e) { if (attempt >= 3) throw e; }
  }
  // The designer is lazy-loaded behind a spinner: wait until it has mounted
  // (a scan of the spinner would report 0 hits and prove nothing).
  await page.waitForFunction(() => document.querySelectorAll('button').length >= 8, null, { timeout: 60000 });
  await page.waitForTimeout(2500);
}

const report = { base: BASE, at: new Date().toISOString(), runs: [] };
let total = 0;
// DEMO_CLEAN_RESOLVE=216.198.79.3 pins the host to one Vercel edge (some
// edges time out from some networks).
const RESOLVE = process.env.DEMO_CLEAN_RESOLVE ? [`--host-resolver-rules=MAP ${new URL(BASE).hostname} ${process.env.DEMO_CLEAN_RESOLVE}`] : [];
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', ...RESOLVE] });
const ONLY = process.env.DEMO_CLEAN_VIEWPORTS?.split(',');
for (const vp of VIEWPORTS.filter((v) => !ONLY || ONLY.includes(v.name))) {
  for (const start of STARTS) {
    const ctx = await browser.newContext({ viewport: vp.viewport, isMobile: vp.mobile, hasTouch: vp.mobile });
    const page = await ctx.newPage();
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)); });
    page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)));
    await open(page, start);
    const run = { viewport: vp.name, start, onLoad: await collect(page), taps: [], tapped: 0, tappedPaths: [], consoleErrors: errors };
    const tag = `${vp.name}-${start.replace(/[^a-z0-9]+/gi, '_')}`;
    await page.screenshot({ path: join(OUT, `${tag}-load.png`), timeout: 8000 }).catch(() => {});
    const buttons = (await buttonLabels(page)).filter((b) => !SKIP.test(b.key) && !SKIP.test(b.label));
    // Level 1: every target on the first screen. Level 2: every NEW target a
    // tap reveals (capped per parent). No reload between taps — software
    // WebGL makes a reload cost seconds; reload only when a tap leaves /demo.
    const visited = new Set(buttons.map((b) => b.key));
    const tap = async (key, path) => {
      if (!(await clickKey(page, key).catch(() => false))) return false;
      await page.waitForTimeout(400);
      run.tapped += 1;
      run.tappedPaths.push(path);
      if (!new URL(page.url()).pathname.startsWith('/demo')) { await open(page, start); return false; }
      let hits;
      try { hits = await collect(page); } catch { await open(page, start); return false; }
      if (hits.length) run.taps.push({ path, hits });
      return true;
    };
    for (const b of buttons) {
      if (run.tapped >= 320) break;
      if (!(await tap(b.key, b.key))) continue;
      const revealed = (await buttonLabels(page)).filter((c) => !visited.has(c.key) && !SKIP.test(c.key) && !SKIP.test(c.label)).slice(0, 30);
      for (const c of revealed) {
        visited.add(c.key);
        if (run.tapped >= 320) break;
        // The parent may have closed after an earlier child; re-open it.
        if (!(await tap(c.key, `${b.key} > ${c.key}`))) { if (await tap(b.key, b.key)) await tap(c.key, `${b.key} > ${c.key}`); }
      }
      await page.keyboard.press('Escape');
      await page.keyboard.press('Escape');
    }
    if (run.tapped < 20) { run.taps.push({ path: '(scan)', hits: [`only ${run.tapped} taps landed — not a valid pass`] }); }
    const n = run.onLoad.length + run.taps.reduce((s, t) => s + t.hits.length, 0);
    total += n;
    run.hitCount = n;
    report.runs.push(run);
    writeFileSync(join(OUT, 'report.json'), JSON.stringify(report, null, 2));
    console.log(`${vp.name} ${start}: tapped ${run.tapped}, hits ${n}, console errors ${errors.length}`);
    await ctx.close();
  }
}
await browser.close();
report.totalHits = total;
writeFileSync(join(OUT, 'report.json'), JSON.stringify(report, null, 2));
console.log(`TOTAL HITS ${total} -> ${join(OUT, 'report.json')}`);
process.exit(total === 0 ? 0 : 1);
