import { chromium, expect } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { planPoint, housePoint, houseCamera } from './authoring-coordinates.mjs';
const base = process.argv[2] ?? 'http://localhost:5174';
if (!['localhost', '127.0.0.1'].includes(new URL(base).hostname) && !/^ppw-designer-2d-[\w-]+\.vercel\.app$/.test(new URL(base).hostname)) throw new Error('Local or feature preview only');
const out = 'docs/qa-authoring-2026-10-16'; mkdirSync(out, { recursive: true });
const property = { id:'qa-authoring', name:'Authoring house', activeRoomId:'room', activeLevelId:'ground', wallHeightM:2.7,
  rooms:[{id:'room',name:'Living room',polygon:[{x:0,y:0},{x:8,y:0},{x:8,y:6},{x:0,y:6}],placedItems:[],
    openings:[{id:'door-near',kind:'door',edgeIndex:0,offsetM:2,widthM:.9,flipFacing:false,flipHand:false},{id:'door-far',kind:'door',edgeIndex:2,offsetM:2,widthM:.9,flipFacing:false,flipHand:false}]}] };
const report={base,cases:[]};
const browser=await chromium.launch({headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try { for(const [name,viewport] of [['desktop',{width:1280,height:900}],['phone',{width:390,height:844}]]) {
  const context=await browser.newContext({viewport,hasTouch:name==='phone',isMobile:name==='phone',deviceScaleFactor:1});
  await context.addInitScript(p=>{localStorage.clear();localStorage.setItem('ppw_designer_coach_v1','1');localStorage.setItem('ppw_property_v2',JSON.stringify({version:2,state:{property:p,pxPerMetre:70,showGrid:true}}));},property);
  const page=await context.newPage();page.setDefaultTimeout(15000);
  const entry={name,checks:[],shots:[],errors:[],externalErrors:[],failures:[]};report.cases.push(entry);
  page.on('pageerror',e=>entry.errors.push(e.message));page.on('console',m=>{if(m.type()==='error') { const source=m.location().url; (source && !source.startsWith(base)?entry.externalErrors:entry.errors).push({message:m.text(),source}); }});
  await page.route('**/api/**',async r=>{if(!['GET','HEAD','OPTIONS'].includes(r.request().method())) {entry.errors.push('Unexpected write '+r.request().url());await r.abort();}else await r.continue();});
  const shot=async label=>{await page.getByTestId('toast').waitFor({state:'hidden',timeout:12000}).catch(()=>{});await page.waitForTimeout(300);const path=`${out}/${name}-${label}.png`;await page.screenshot({path});entry.shots.push(path);expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);};
  const state=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('ppw_property_v2')).state.property);
  const point2d=(x,y)=>planPoint(page,x,y);
  const point3d=(x,y)=>housePoint(page,x,y);
  const click=async p=>{expect(p).toBeTruthy();await page.mouse.click(p.x,p.y);};
  const openCatalog=async mode=>{
    if(mode==='3d') await page.getByTestId('house-mode-furnish').click();
    else await page.locator('[data-testid="dock-catalog-open"],[data-testid="sims-catalog-open"]').filter({visible:true}).first().click();
    const all=page.locator('[data-testid="dock-cat-all"],[data-testid="sims-cat-all"]').filter({visible:true}).first();
    if(await all.isVisible())await all.click();
    return page.locator('[data-testid="dock-strip"],[data-testid="sims-thumb-strip"]').filter({visible:true}).first();
  };
  try {
    await page.goto(`${base}/designer?view=2d&pitch=1`,{waitUntil:'domcontentloaded'});
    await page.getByTestId('plan-drawing-viewport').waitFor();
    await page.waitForTimeout(1000);
    const door=await point2d(2,0);await click(door);
    await expect(page.getByTestId('opening-selection-editor')).toBeVisible();
    await page.getByRole('spinbutton',{name:'Opening width',exact:true}).fill('1.1');await page.getByRole('spinbutton',{name:'Opening width',exact:true}).press('Enter');
    expect((await state()).rooms[0].openings[0].widthM).toBe(1.1);expect(await point2d(2,0)).toEqual(door);
    await shot('plan-door-edit');await click(await point2d(4,3));await expect(page.getByTestId('opening-selection-editor')).toHaveCount(0);entry.checks.push('2D door selection, measured edit, click-away dismissal and unchanged viewport');
    let strip=await openCatalog('2d');let card=strip.locator('[data-product-id]').filter({visible:true}).first();await card.waitFor();
    if(name==='phone'){
      const details=strip.locator('.catalog-tile-details').first(), b=await details.boundingBox();
      expect(b.y+b.height).toBeLessThan(viewport.height);await details.click();await expect(page.getByTestId('mobile-product-popup')).toBeVisible();
      await page.getByTestId('mobile-product-popup').getByRole('button',{name:'Close',exact:true}).click();await expect(page.getByTestId('mobile-product-popup')).toHaveCount(0);entry.checks.push('Phone product info action is visible, usable and dismissible without adding');
    }
    const box=await card.boundingBox();const target=await point2d(4,3);
    await page.mouse.move(box.x+box.width/2,box.y+Math.min(box.height/2,35));await page.mouse.down();await page.waitForTimeout(360);await page.mouse.move(target.x,target.y+(name==='phone'?56:0),{steps:18});await page.mouse.up();
    await expect.poll(async()=>(await state()).rooms.reduce((n,r)=>n+r.placedItems.length,0)).toBe(1);await shot('plan-direct-drop');entry.checks.push('Direct 2D catalogue drop commits exactly one item without confirm/add');
    await page.keyboard.press('Escape');
    await page.getByRole('button',{name:'3D House',exact:true}).click();await page.getByTestId('wallpaint-3d-gl').waitFor();await page.getByTestId('loading-3d').waitFor({state:'hidden',timeout:60000});await page.waitForTimeout(500);
    const before=await houseCamera(page);
    const chosen={id:'door-far',show:'stub',p:await housePoint(page,6,6,.335)};await click(chosen.p);
    await expect(page.getByTestId('opening-selection-editor')).toBeVisible();await page.getByRole('button',{name:'Swap hinge',exact:true}).click();
    expect((await state()).rooms[0].openings.find(o=>o.id===chosen.id).flipHand).toBe(true);
    expect(await houseCamera(page)).toEqual(before);await shot('house-door-cutaway');
    const scene=await page.getByTestId('wallpaint-3d-canvas').boundingBox();await click({x:scene.x+20,y:scene.y+30});await expect(page.getByTestId('opening-selection-editor')).toHaveCount(0);entry.checks.push(`3D ${chosen.show} door selection, hinge edit and click-away dismissal preserve camera`);
    strip=await openCatalog('3d');card=strip.locator('[data-product-id]').filter({visible:true}).first();await card.waitFor();const b=await card.boundingBox();const t=await point3d(6,4);
    const camera=await houseCamera(page);await page.mouse.move(b.x+b.width/2,b.y+Math.min(b.height/2,35));await page.mouse.down();await page.waitForTimeout(360);await page.mouse.move(t.x,t.y+(name==='phone'?56:0),{steps:18});await page.mouse.up();
    await expect.poll(async()=>(await state()).rooms.reduce((n,r)=>n+r.placedItems.length,0)).toBe(2);expect(await houseCamera(page)).toEqual(camera);await shot('house-direct-drop');entry.checks.push('3D direct catalogue drop commits exactly one item and preserves camera');
    expect(entry.errors).toEqual([]);
  }catch(error){entry.failures.push(String(error));await page.screenshot({path:`${out}/${name}-failure.png`});}
  await context.close();writeFileSync(`${out}/report.json`,JSON.stringify(report,null,2));
}}finally{await browser.close();writeFileSync(`${out}/report.json`,JSON.stringify(report,null,2));}
console.log(JSON.stringify(report,null,2));if(report.cases.some(c=>c.failures.length||c.errors.length))process.exitCode=1;
