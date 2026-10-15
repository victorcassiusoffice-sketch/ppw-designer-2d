/** Disposable local headless QA; no external writes, orders or publication. */
import { chromium, expect } from '@playwright/test';
import { mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import sharp from 'sharp';
const base = process.argv[2] ?? 'http://127.0.0.1:5173';
if (!['localhost', '127.0.0.1'].includes(new URL(base).hostname)) throw new Error('Local preview only.');
const out = 'docs/qa-services-spatial-2026-10-15'; mkdirSync(out, { recursive: true });
const report = { date: '2026-10-15', base, bundle: readdirSync('dist/assets').find(f => /^App-[\w-]+\.js$/.test(f)), cases: [] };
const browser = await chromium.launch({ headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
try {
  for (const [name, viewport] of [['desktop', { width: 1280, height: 900 }], ['phone', { width: 390, height: 844 }]]) {
    const context = await browser.newContext({ viewport, hasTouch: name === 'phone', isMobile: name === 'phone', deviceScaleFactor: 1 });
    await context.addInitScript(() => {
      if (sessionStorage.getItem('qa-service-spatial')) return;
      localStorage.clear(); localStorage.setItem('ppw_designer_coach_v1', '1');
      localStorage.setItem('ppw_property_v2', JSON.stringify({ version: 2, state: { pxPerMetre: 70, showGrid: true, property: {
        id: 'qa-services-spatial', name: 'Services coordination study', activeRoomId: 'room', wallHeightM: 2.7,
        rooms: [{ id: 'room', name: 'Ground room', polygon: [{ x: 0, y: 0 }, { x: 8, y: 0 }, { x: 8, y: 6 }, { x: 0, y: 6 }], placedItems: [] }],
      } } })); sessionStorage.setItem('qa-service-spatial', '1');
    });
    const page = await context.newPage(); page.setDefaultTimeout(30000);
    const result = { viewport: name, shots: [], checks: [], consoleErrors: [], pageErrors: [], writes: [], failures: [] }; report.cases.push(result);
    page.on('console', m => { if (m.type() === 'error') result.consoleErrors.push(m.text()); });
    page.on('pageerror', error => result.pageErrors.push(error.message));
    await page.route('**/api/**', async route => {
      if (!['GET', 'HEAD', 'OPTIONS'].includes(route.request().method())) { result.writes.push(route.request().url()); await route.abort(); }
      else await route.continue();
    });
    const state = () => page.evaluate(() => JSON.parse(localStorage.getItem('ppw_property_v2')).state.property);
    const click = async (x, y) => name === 'phone' ? page.touchscreen.tap(x, y) : page.mouse.click(x, y);
    const drag = async (start, end) => {
      if(name==='phone') { const session=await context.newCDPSession(page);
        await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:start.x,y:start.y}]});
        for(let i=1;i<=8;i++)await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:start.x+(end.x-start.x)*i/8,y:start.y+(end.y-start.y)*i/8}]});
        await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]}); await session.detach();
      } else { await page.mouse.move(start.x,start.y);await page.mouse.down();await page.mouse.move(end.x,end.y,{steps:8});await page.mouse.up(); }
    };
    const worldPoint = async (x,y) => page.locator('.services-plan').evaluate((svg, p) => {
      const value = new DOMPoint(p.x, p.y).matrixTransform(svg.getScreenCTM()); return { x: value.x, y: value.y };
    }, { x,y });
    const world = async (x,y) => { const p=await worldPoint(x,y);await click(p.x,p.y); };
    const field = async (label, value) => { await page.getByLabel(label, { exact: true }).fill(String(value)); await page.getByLabel(label, { exact: true }).press('Tab'); };
    const shot = async label => {
      await page.waitForTimeout(250); const path = `${out}/${name}-${label}.png`; await page.screenshot({ path }); result.shots.push(path);
      const layout = await page.evaluate(() => ({ overflow: document.documentElement.scrollWidth - innerWidth,
        clipped: [...document.querySelectorAll('.services-header button,.services-header select,.services-tools select,.services-view-tools button')]
          .filter(el => { const b = el.getBoundingClientRect(); return b.width > 0 && (b.left < -1 || b.right > innerWidth + 1); }).map(el => el.textContent.trim()),
        canvasHeight: document.querySelector('.services-three-host:not([hidden])')?.clientHeight ?? document.querySelector('.services-plan')?.clientHeight,
      })); result.checks.push({ label, layout });
      expect(layout.overflow).toBeLessThanOrEqual(1); expect(layout.clipped).toEqual([]); expect(layout.canvasHeight).toBeGreaterThan(160);
    };
    try {
      await page.goto(`${base}/designer?panel=services&pitch=1`, { waitUntil: 'networkidle' });
      await expect(page.getByRole('dialog', { name: 'Building services' })).toBeVisible();
      await page.getByLabel('Route system', { exact: true }).selectOption('cold-water');
      await field('Start elevation (m)', 0); await field('End elevation (m)', 0);
      await drag(await worldPoint(1,1),await worldPoint(4,1)); expect((await state()).services).toBeUndefined();
      await field('End elevation (m)', 3); await world(4, 1); await world(4, 4);
      await page.getByRole('button', { name: 'Finish run', exact: true }).click();
      let model = await state(); expect(model.services.runs[0].points.map(p => p.elevationM)).toEqual([0, 0, 3, 3]);
      await page.getByRole('button', { name: 'Zoom services in', exact: true }).click(); const viewBox = await page.locator('.services-plan').getAttribute('viewBox');
      await shot('plan-route');
      await page.getByRole('button', { name: 'Continue from end', exact: true }).click(); await world(6, 4);
      await page.getByRole('button', { name: 'Finish run', exact: true }).click(); model = await state();
      expect(model.services.junctions).toHaveLength(1); expect(await page.locator('.services-plan').getAttribute('viewBox')).toBe(viewBox);
      await page.getByLabel('Place equipment', { exact: true }).selectOption('air-conditioner'); await world(2, 3);
      await field('Base elevation (m)', 2); await page.getByLabel('Supplier equipment reference', { exact: true }).selectOption('ignitech-inventor-indoor');
      const ac = (await state()).services.fixtures[0]; expect(ac.elevationM).toBe(2); expect(ac.productReferenceId).toBe('ignitech-inventor-indoor');
      await shot('raised-equipment');
      await page.getByRole('button', { name: '3D edit', exact: true }).click();
      await expect(page.locator('.services-three canvas')).toBeVisible(); await page.waitForTimeout(1500); await shot('3d-services');
      const insetFrame = await page.locator('.services-three canvas').screenshot();
      await page.getByRole('button', { name: 'Hide details', exact: true }).click();
      await page.waitForTimeout(400);
      const expandedFrame = await page.locator('.services-three canvas').screenshot();
      const [insetInfo, expandedInfo] = await Promise.all([sharp(insetFrame).metadata(), sharp(expandedFrame).metadata()]);
      const compareWidth = Math.min(insetInfo.width, expandedInfo.width), compareHeight = Math.min(insetInfo.height, expandedInfo.height);
      const centredPixels = (frame, info) => sharp(frame).extract({ left: Math.floor((info.width - compareWidth)/2), top: Math.floor((info.height - compareHeight)/2), width: compareWidth, height: compareHeight }).raw().toBuffer();
      const [insetPixels, expandedPixels] = await Promise.all([centredPixels(insetFrame,insetInfo), centredPixels(expandedFrame,expandedInfo)]);
      let resizeChanges=0;for(let i=0;i<insetPixels.length;i++)if(Math.abs(insetPixels[i]-expandedPixels[i])>12)resizeChanges++;
      const resizeFraction=resizeChanges/insetPixels.length;
      expect(resizeFraction).toBeLessThan(.04);
      result.checks.push({name:'Inspector resize preserves centred drawing pixel scale',changedFraction:resizeFraction,from:{width:insetInfo.width,height:insetInfo.height},to:{width:expandedInfo.width,height:expandedInfo.height}});
      await page.getByRole('button', { name: 'Zoom services in', exact: true }).click(); await page.waitForTimeout(500);
      const canvas = page.locator('.services-three canvas'), before = await canvas.screenshot();
      await page.getByLabel('Route system', { exact: true }).selectOption('data');
      await page.getByLabel('Services tools').getByRole('button', { name: 'Select', exact: true }).click(); await page.waitForTimeout(500);
      const after = await canvas.screenshot(); const [a, b] = await Promise.all([sharp(before).raw().toBuffer(), sharp(after).raw().toBuffer()]);
      let changed = 0; for (let i = 0; i < a.length; i++) if (Math.abs(a[i] - b[i]) > 8) changed++;
      const changedFraction = changed / a.length; expect(changedFraction).toBeLessThan(.02); result.checks.push({ name: 'Camera unchanged by tool select', changedFraction });
      await page.getByLabel('Route system', { exact: true }).selectOption('data');
      if (name === 'phone') {
        const session=await context.newCDPSession(page), area=await canvas.boundingBox();
        const x=area.x+area.width*.48,y=area.y+area.height*.27;
        const frameBefore=await canvas.screenshot();
        await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{id:1,x:x-35,y},{id:2,x:x+35,y}]});
        for(let i=1;i<=6;i++)await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{id:1,x:x-35-i*3,y:y+i*2},{id:2,x:x+35+i*3,y:y+i*2}]});
        await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await session.detach();await page.waitForTimeout(600);
        expect(await page.getByRole('button',{name:'Finish run',exact:true}).count()).toBe(0);
        expect((await state()).services.runs).toHaveLength(2);
        const [one,two]=await Promise.all([sharp(frameBefore).raw().toBuffer(),sharp(await canvas.screenshot()).raw().toBuffer()]);
        let changes=0;for(let i=0;i<one.length;i++)if(Math.abs(one[i]-two[i])>8)changes++;
        expect(changes/one.length).toBeGreaterThan(.001);
        result.checks.push({name:'Two-finger navigation while routing changes camera without adding a draft',changedFraction:changes/one.length});
      }
      const drawBox = await canvas.boundingBox();
      await drag({x:drawBox.x+drawBox.width*.25,y:drawBox.y+drawBox.height*.7},{x:drawBox.x+drawBox.width*.7,y:drawBox.y+drawBox.height*.65});
      await expect(page.getByRole('button',{name:'Finish run',exact:true})).toBeEnabled();
      expect((await state()).services.runs).toHaveLength(2);
      result.checks.push('Press-drag creates an unsaved2point3D draft; Finish explicitly saves');
      await page.getByRole('button', { name: 'Finish run', exact: true }).click();
      model = await state(); expect(model.services.runs).toHaveLength(3); expect(model.services.runs[2].system).toBe('data');
      await page.getByLabel('Selected route node', { exact: true }).selectOption('1'); await field('Node elevationM', 2.5);
      expect((await state()).services.runs[2].points[1].elevationM).toBe(2.5); await shot('3d-node-height');
      await page.getByRole('button', { name: 'Fit', exact: true }).click(); await page.waitForTimeout(600);
      const raw = await sharp(await canvas.screenshot()).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      let sumX=0,sumY=0,count=0;
      for(let y=0;y<raw.info.height;y++) for(let x=0;x<raw.info.width;x++) { const k=(y*raw.info.width+x)*4;
        if(raw.data[k]>=215&&raw.data[k]<=230&&raw.data[k+1]>=155&&raw.data[k+1]<=175&&raw.data[k+2]>=70&&raw.data[k+2]<=100){sumX+=x;sumY+=y;count++;}
      }
      expect(count).toBeGreaterThan(2); const cb = await canvas.boundingBox();
      const start={x:cb.x+sumX/count,y:cb.y+sumY/count}, end={x:start.x+28,y:start.y-18};
      const originalPoint=(await state()).services.runs[2].points[1];
      await drag(start,end);
      await page.waitForTimeout(250); const movedPoint=(await state()).services.runs[2].points[1];
      expect(Math.hypot(movedPoint.x-originalPoint.x,movedPoint.y-originalPoint.y)).toBeGreaterThan(.1); expect(movedPoint.elevationM).toBe(2.5); expect(movedPoint.x*20).toBeCloseTo(Math.round(movedPoint.x*20)); expect(movedPoint.y*20).toBeCloseTo(Math.round(movedPoint.y*20));
      result.checks.push({name:'3D endpoint drag preserves precise height',before:originalPoint,after:movedPoint}); await shot('3d-node-drag');
      await page.getByRole('button', { name: '2D plan', exact: true }).click();
      expect((await state()).services.runs[2].points[1].elevationM).toBe(2.5); await shot('paired-plan');
      await page.keyboard.press('Escape'); expect(await page.getByRole('dialog', { name: 'Building services' }).count()).toBe(1);
      await page.keyboard.press('Escape'); await expect(page.getByRole('dialog', { name: 'Building services' })).toHaveCount(0);
      result.checks.push('Plan↔3D canonical parity, precise node height, chain junction and Escape verified');
    } catch (error) { result.failures.push(error.message); await page.screenshot({ path: `${out}/${name}-failure.png` }); }
    await context.close();
  }
} finally { await browser.close(); writeFileSync(`${out}/report.json`, JSON.stringify(report, null, 2)); }
console.log(JSON.stringify(report, null, 2));
if (report.cases.some(c => c.failures.length || c.consoleErrors.length || c.pageErrors.length || c.writes.length)) process.exitCode = 1;
