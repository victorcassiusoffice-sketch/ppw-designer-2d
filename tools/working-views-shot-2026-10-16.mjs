import { chromium, expect } from '@playwright/test';
import { mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import sharp from 'sharp';
const base = process.argv[2] ?? 'http://127.0.0.1:5173';
if (!['localhost', '127.0.0.1'].includes(new URL(base).hostname)) throw new Error('Local preview only');
const out = 'docs/qa-working-views-2026-10-16'; mkdirSync(out, { recursive: true });
const property = {
  id: 'qa-working-views', name: 'Coordination house', activeRoomId: 'room', activeLevelId: 'ground', wallHeightM: 2.7,
  rooms: [{ id: 'room', name: 'Ground room', polygon: [{ x: 0, y: 0 }, { x: 8, y: 0 }, { x: 8, y: 6 }, { x: 0, y: 6 }], placedItems: [] }],
  services: { version: 1, fixtures: [
    { id: 'sink', levelId: 'ground', kind: 'sink', x: 3, y: 4, widthM: .6, depthM: .5, heightM: .9, rotation: 0 },
    { id: 'board', levelId: 'ground', kind: 'electrical-board', x: 6, y: 4, widthM: .4, depthM: .12, heightM: .6, elevationM: 1.1, rotation: 0 },
  ], runs: [
    { id: 'water', levelId: 'ground', system: 'cold-water', materialId: 'hpl-aquasafe-upvc-20', diameterMm: 20, startElevationM: -.3, endElevationM: 2.4, points: [{x:1,y:1,elevationM:-.3},{x:1,y:1,elevationM:2.4},{x:1,y:4,elevationM:2.4},{x:3,y:4,elevationM:2.4}] },
    { id: 'electric', levelId: 'ground', system: 'electrical', materialId: 'hpl-aquaduct-ldpe-20', diameterMm: 20, startElevationM: 0, endElevationM: 1.4, points: [{x:5,y:1,elevationM:0},{x:5,y:1,elevationM:1.4},{x:5,y:4,elevationM:1.4},{x:6,y:4,elevationM:1.4}] },
  ] },
};
const report = { base, date: '2026-10-16', bundle: readdirSync('dist/assets').find(f => /^App-[\w-]+\.js$/.test(f)), cases: [] };
const browser = await chromium.launch({ headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const pixels = async (a,b) => { const [aa,bb] = await Promise.all([sharp(a).raw().toBuffer(),sharp(b).raw().toBuffer()]); if(aa.length!==bb.length)return 1; let diff=0; for(let i=0;i<aa.length;i++) if(Math.abs(aa[i]-bb[i])>20) diff++; return diff/aa.length; };
try {
for (const [name, viewport] of [['desktop',{width:1280,height:900}],['phone',{width:390,height:844}]]) {
  const context = await browser.newContext({ viewport, hasTouch: name==='phone', isMobile: name==='phone', deviceScaleFactor: 1 });
  await context.addInitScript(p => { if(sessionStorage.getItem('qa-working-views')) return; localStorage.clear();localStorage.setItem('ppw_designer_coach_v1','1');localStorage.setItem('ppw_property_v2',JSON.stringify({version:2,state:{property:p,pxPerMetre:70,showGrid:true}}));sessionStorage.setItem('qa-working-views','1'); },property);
  const page = await context.newPage();page.setDefaultTimeout(30000);
  const entry={name,shots:[],checks:[],errors:[],writes:[],failures:[]};report.cases.push(entry);
  page.on('console',m=>{if(m.type()==='error')entry.errors.push(m.text());});page.on('pageerror',e=>entry.errors.push(e.message));
  await page.route('**/api/**',async route=>{if(!['GET','HEAD','OPTIONS'].includes(route.request().method())){entry.writes.push(route.request().url());await route.abort();}else await route.continue();});
  const state=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('ppw_property_v2')).state.property);
  const open=async()=>{const services=page.getByRole('dialog',{name:'Building services'}),house=page.getByTestId('wallpaint-3d-overlay');const root=await services.isVisible()?services:await house.isVisible()?house:page.getByTestId('plan-navigation');const trigger=root.getByTestId('discipline-toggle');if(await trigger.getAttribute('aria-expanded')!=='true')await trigger.click();await page.locator('.discipline-popover').waitFor();};
  const close=async()=>{await page.keyboard.press('Escape');await expect(page.locator('.discipline-popover')).toHaveCount(0);};
  const preset=async id=>{await open();await page.getByLabel('Working view',{exact:true}).selectOption(id);await close();await page.waitForTimeout(300);};
  const shot=async label=>{await page.waitForTimeout(350);const path=`${out}/${name}-${label}.png`;await page.screenshot({path});entry.shots.push(path);const layout=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth-innerWidth,clipped:[...document.querySelectorAll('.discipline-popover,.services-header,.services-tools,.house-camera-row')].filter(e=>{const b=e.getBoundingClientRect();return b.width>0&&(b.left < -1||b.right>innerWidth+1||b.top < -1||b.bottom>innerHeight+1);}).map(e=>e.className)}));expect(layout.overflow).toBeLessThanOrEqual(1);expect(layout.clipped).toEqual([]);entry.checks.push({label,layout});};
  try {
    await page.goto(`${base}/designer?view=2d&pitch=1`,{waitUntil:'networkidle'});await page.locator('.konvajs-content canvas').first().waitFor();const canonical=await state();
    for(const mode of ['plan','house']) {
      if(mode==='house'){await page.getByRole('button',{name:'3D House',exact:true}).click();await page.getByTestId('wallpaint-3d-gl').waitFor();await page.getByTestId('loading-3d').waitFor({state:'hidden',timeout:60000});await page.waitForTimeout(600);}
      await open();await shot(`${mode}-layers`);await close();
      for(const id of ['pipes','plumbing-electrical-walls']){await preset(id);await shot(`${mode}-${id}`);expect(await state()).toEqual(canonical);}
      for(const id of ['architect','engineer','plumber','electrician','client']){await preset(id);expect(await state()).toEqual(canonical);}
      await preset('all');
      if(mode==='house') {
        const canvas=page.getByTestId('wallpaint-3d-gl');const before=await canvas.screenshot();await preset('pipes');await preset('all');const delta=await pixels(before,await canvas.screenshot());expect(delta).toBeLessThan(.003);entry.checks.push({name:'Main house camera unchanged after filtering',pixelDelta:delta});
      }
    }
    await page.goto(`${base}/designer?view=2d&panel=services&pitch=1`,{waitUntil:'networkidle'});await page.getByRole('dialog',{name:'Building services'}).waitFor();await page.getByRole('button',{name:'2D plan',exact:true}).click();
    const svg=page.locator('svg[aria-label="Scaled services floor plan"]');const view=await svg.getAttribute('viewBox');
    await open();await shot('services-plan-layers');await close();
    await preset('pipes');expect(await svg.locator('[data-service-id="water"]').count()).toBeGreaterThan(0);expect(await svg.locator('[data-service-id="electric"]').count()).toBe(0);expect(await svg.locator('[data-service-port]').count()).toBe(0);expect(await svg.locator('polygon').count()).toBe(0);await shot('services-plan-pipes');
    await preset('plumbing-electrical-walls');await expect(svg.locator('polygon').first()).toHaveAttribute('fill','none');await expect(svg.locator('polygon').first()).toHaveAttribute('stroke','#586b62');expect(await svg.getAttribute('viewBox')).toBe(view);await shot('services-plan-combined');
    await open();await page.locator('[data-visibility-part="equipment"]').uncheck();await close();expect(await svg.locator('[data-service-port]').count()).toBe(0);await shot('services-plan-routes-walls');
    await preset('all');await page.getByRole('button',{name:'3D edit',exact:true}).click();const canvas=page.locator('.services-three canvas');await canvas.waitFor();await page.waitForTimeout(800);
    const before=await canvas.screenshot();await preset('pipes');await shot('services-3d-pipes');await preset('plumbing-electrical-walls');await shot('services-3d-combined');await preset('all');const delta=await pixels(before,await canvas.screenshot());expect(delta).toBeLessThan(.003);entry.checks.push({name:'Services camera unchanged after filtering',pixelDelta:delta});
    await open();await page.getByRole('button',{name:'Hide all',exact:true}).click();await close();expect((await state()).services).toEqual(canonical.services);await shot('services-3d-hidden');await preset('all');
    expect(entry.errors).toEqual([]);expect(entry.writes).toEqual([]);
  } catch(error){entry.failures.push(String(error));await page.screenshot({path:`${out}/${name}-failure.png`});}
  await context.close();writeFileSync(`${out}/report.json`,JSON.stringify(report,null,2));
}
} finally {await browser.close();writeFileSync(`${out}/report.json`,JSON.stringify(report,null,2));}
console.log(JSON.stringify(report,null,2));if(report.cases.some(c=>c.failures.length||c.errors.length||c.writes.length))process.exitCode=1;
