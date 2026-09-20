/**
 * energy-meter-shot — drives the Energy readout through the three states a
 * customer actually meets and photographs each one (2026-09-09).
 *
 *   node tools/energy-meter-shot-2026-09-09.mjs <base> <outDir> [phone]
 *
 * Seeds a plan straight into localStorage the way the e2e helpers do, so no
 * clicking is needed to reach a state; the meter itself is then read out of
 * the live DOM, so what is asserted is what a customer sees.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const base = process.argv[2] ?? 'http://127.0.0.1:5173';
const out = process.argv[3] ?? 'docs/sims-world-2026-08-29/energy-meter-2026-09-09';
const phone = process.argv[4] === 'phone';
fs.mkdirSync(out, { recursive: true });

const PANEL = 'emcar-jinko-475';
const POLY = [
  { x: 0, y: 0 },
  { x: 6, y: 0 },
  { x: 6, y: 5 },
  { x: 0, y: 5 },
];

/**
 * A plan with `panels` modules already on the roof. The roof is seeded the way
 * the app persists it - a `kind:'roof'` level plus a mirrored `kind:'roof'`
 * room - because there is no exposed store to poke from outside.
 */
const plan = (items, panels = 0) => {
  const prop = {
    id: 'prop-e',
    name: 'Energy',
    activeRoomId: 'r1',
    levels: [{ id: 'ground', name: 'Ground floor', index: 0 }],
    rooms: [{ id: 'r1', name: 'Gym', polygon: POLY, placedItems: items, openings: [], floorTiles: [], levelId: 'ground' }],
  };
  if (panels > 0) {
    prop.levels.push({ id: 'roof', name: 'Roof', index: 1, kind: 'roof' });
    prop.rooms.push({
      id: 'roof-r1',
      name: 'Gym',
      polygon: POLY,
      kind: 'roof',
      levelId: 'roof',
      openings: [],
      floorTiles: [],
      // 1.903 x 1.134 m modules on the tile lattice from the 0.05 m inset.
      placedItems: Array.from({ length: panels }, (_, i) => ({
        instanceId: `pv${i + 1}`,
        productId: PANEL,
        x: 0.05 + (i % 3) * 1.903,
        y: 0.05 + Math.floor(i / 3) * 1.134,
        rotation: 0,
      })),
    });
  }
  return prop;
};

const item = (id, productId, x, y) => ({ instanceId: id, productId, x, y, rotation: 0 });

const STATES = [
  {
    key: '1-load-no-panels',
    title: 'a treadmill, no panels',
    items: [item('t1', 'k1-nordictrack-2450', 1, 1), item('t2', 'k1-vision-t600-03', 3.2, 1)],
  },
  {
    key: '2-partial',
    title: 'a gym of machines, one panel',
    items: [
      item('t1', 'k1-nordictrack-2450', 1, 1),
      item('t2', 'k1-vision-t600-03', 3.2, 1),
      item('t3', 'k1-vision-t600e-02', 1, 3),
      item('t4', 'k1-nordictrack-x16', 3.2, 3),
    ],
    panels: 1,
  },
  {
    key: '3-covered',
    title: 'enough panels',
    items: [item('t1', 'k1-nordictrack-2450', 1, 1)],
    panels: 6,
  },
];

const browser = await chromium.launch();
for (const st of STATES) {
  const ctx = await browser.newContext({
    viewport: phone ? { width: 390, height: 844 } : { width: 1366, height: 900 },
    deviceScaleFactor: 2,
    isMobile: phone,
    hasTouch: phone,
  });
  const page = await ctx.newPage();
  // The sandbox cannot reach Google Fonts, so document.fonts.ready never
  // settles and every screenshot times out "waiting for fonts to load".
  // Aborting the request lets the promise resolve on the fallback stack.
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  const errs = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errs.push(m.text());
  });
  const prop = plan(st.items, st.panels ?? 0);
  await page.addInitScript((p) => {
    localStorage.clear();
    localStorage.setItem('ppw_designer_coach_v1', '1');
    localStorage.setItem('ppw_property_v2', JSON.stringify({ state: { property: p, showGrid: true, pxPerMetre: 100 }, version: 2 }));
  }, prop);
  await page.goto(`${base}/designer`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.konvajs-content canvas', { state: 'attached', timeout: 30000 });
  await page.waitForTimeout(1500);

  const shot = path.join(out, `${phone ? 'phone' : 'desktop'}-${st.key}.png`);
  const chip = page.locator('[data-testid="energy-readout"]');
  if (await chip.count()) await chip.click().catch(() => {});
  await page.waitForTimeout(700);

  const reading = await page.evaluate(() => {
    const q = (t) => document.querySelector(`[data-testid="${t}"]`);
    const el = (t) => q(t)?.textContent?.replace(/\s+/g, ' ').trim() ?? null;
    return {
      status: q('energy-summary')?.getAttribute('data-status') ?? null,
      headline: el('energy-status'),
      meterFill: q('energy-meter')?.getAttribute('data-fill') ?? null,
      chipFill: q('energy-meter-chip')?.getAttribute('data-fill') ?? null,
      detail: el('energy-detail'),
      action: el('energy-hint'),
      generation: el('energy-generation'),
      load: el('energy-load'),
    };
  });
  console.log(`\n--- ${st.key} (${st.title}) ---`);
  console.log(JSON.stringify(reading, null, 1));
  if (errs.length) console.log('CONSOLE ERRORS:', errs.slice(0, 3));
  const cdp = await ctx.newCDPSession(page);
  const { data } = await cdp.send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(shot, Buffer.from(data, 'base64'));
  await ctx.close();
}
await browser.close();
