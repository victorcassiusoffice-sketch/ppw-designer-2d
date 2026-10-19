/** Actual app captures for the guided pitch. No synthetic dashboard images or API writes. */
import { chromium, expect } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import sharp from 'sharp';
const base = process.argv[2] ?? 'http://127.0.0.1:5174';
if (!['localhost', '127.0.0.1'].includes(new URL(base).hostname)) throw new Error('Local capture only');
const output = 'docs/qa-eco-city-evidence-2026-10-19';
mkdirSync(output, { recursive: true }); mkdirSync('public/pitch/eco-city', { recursive: true });
const browser = await chromium.launch({ headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const report = { base, cases: [] };
const servicesExample = {
  id: 'pitch-services-example', name: 'Illustrative service coordination', activeRoomId: 'room', activeLevelId: 'ground', wallHeightM: 2.7,
  rooms: [{ id: 'room', name: 'Bathroom and service zone', polygon: [{x:0,y:0},{x:8,y:0},{x:8,y:6},{x:0,y:6}], placedItems: [] }],
  services: { version: 1, fixtures: [
    { id: 'sink', levelId: 'ground', kind: 'sink', x: 3, y: 4, widthM: .6, depthM: .5, heightM: .9, rotation: 0 },
    { id: 'toilet', levelId: 'ground', kind: 'toilet', x: 2, y: 4, widthM: .4, depthM: .65, heightM: .8, rotation: 0 },
    { id: 'board', levelId: 'ground', kind: 'electrical-board', x: 6, y: 4, widthM: .4, depthM: .12, heightM: .6, elevationM: 1.1, rotation: 0 },
  ], runs: [
    { id: 'water', levelId: 'ground', system: 'cold-water', materialId: 'hpl-aquasafe-upvc-20', diameterMm: 20, startElevationM: -.3, endElevationM: .6, points: [{x:1,y:1,elevationM:-.3},{x:1,y:4,elevationM:-.3},{x:3,y:4,elevationM:-.3},{x:3,y:4,elevationM:.6}] },
    { id: 'electric', levelId: 'ground', system: 'electrical', materialId: 'hpl-aquaduct-ldpe-20', diameterMm: 20, startElevationM: 0, endElevationM: 1.4, points: [{x:5,y:1,elevationM:0},{x:5,y:1,elevationM:1.4},{x:5,y:4,elevationM:1.4},{x:6,y:4,elevationM:1.4}] },
  ] },
};
try {
  for (const name of ['city', 'services', 'materials', 'coordination']) {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });
    await ctx.addInitScript(() => localStorage.setItem('ppw_designer_coach_v1', '1'));
    if (name === 'services') await ctx.addInitScript(property => localStorage.setItem('ppw_property_v2', JSON.stringify({version:2,state:{property,pxPerMetre:70,showGrid:true}})), servicesExample);
    const page = await ctx.newPage(); page.setDefaultTimeout(45000);
    const row = { name, errors: [], writes: [] }; report.cases.push(row);
    page.on('pageerror', error => row.errors.push(error.message));
    page.on('console', msg => { if (msg.type() === 'error') row.errors.push(msg.text()); });
    await page.route('**/api/**', async route => { if (!['GET','HEAD','OPTIONS'].includes(route.request().method())) { row.writes.push(route.request().url()); await route.abort(); } else await route.continue(); });
    const panel = name === 'coordination' ? 'shared' : name;
    await page.goto(`${base}/${name === 'services' ? 'designer' : 'demo'}?view=${name === 'materials' ? '2d' : '3d'}&panel=${panel}&pitch=1`, { waitUntil: 'domcontentloaded' });
    if (name === 'city') {
      const city = page.getByTestId('city-workspace'); await city.waitFor();
      await city.getByRole('button', { name: 'Try an eco district', exact: true }).click();
      await city.getByRole('button', { name: '3D', exact: true }).click();
      await city.locator('canvas').waitFor();
      await city.getByRole('button', { name: 'Dismiss city message', exact: true }).click();
    } else if (name === 'services') {
      await page.getByRole('heading', { name: 'Building services', exact: true }).waitFor();
      await page.locator('.services-three canvas').waitFor();
    } else if (name === 'materials') await page.getByTestId('materials-panel').waitFor();
    else {
      const workspace = page.getByTestId('shared-project-workspace'); await workspace.waitFor();
      await workspace.getByRole('button', { name: 'Team & logistics', exact: true }).click();
    }
    await page.evaluate(() => document.fonts.ready);
    await page.getByTestId('toast').first().waitFor({ state: 'hidden', timeout: 6000 }).catch(() => {});
    await page.waitForTimeout(1400);
    row.overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    expect(row.overflow).toBeLessThanOrEqual(1); expect(row.errors).toEqual([]); expect(row.writes).toEqual([]);
    row.screenshot = `${output}/${name}-desktop1280.png`;
    const png = await page.screenshot({ path: row.screenshot });
    await sharp(png).webp({ quality: 86, effort: 5 }).toFile(`public/pitch/eco-city/${name}.webp`);
    await ctx.close(); console.log(JSON.stringify(row));
  }
} finally { await browser.close(); writeFileSync(`${output}/report.json`, JSON.stringify(report, null, 2)); }
