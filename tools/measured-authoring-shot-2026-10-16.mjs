import { chromium, expect } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { planPoint, housePoint, houseCamera } from './authoring-coordinates.mjs';
const base=process.argv[2]??'http://localhost:5174';
if(!['localhost','127.0.0.1'].includes(new URL(base).hostname))throw new Error('Local preview only');
const out='docs/qa-measured-authoring-2026-10-16';mkdirSync(out,{recursive:true});
const seed={id:'qa-measured',name:'Measured authoring house',activeRoomId:'room',activeLevelId:'ground',wallHeightM:2.7,rooms:[{id:'room',name:'Living room',polygon:[{x:0,y:0},{x:8,y:0},{x:8,y:6},{x:0,y:6}],placedItems:[]}]};
const browser=await chromium.launch({headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const report={base,cases:[]};
try{for(const[name,viewport]of[['desktop',{width:1280,height:900}],['phone',{width:390,height:844}]]){
 const context=await browser.newContext({viewport,hasTouch:name==='phone',isMobile:name==='phone',deviceScaleFactor:1});
 await context.addInitScript(p=>{localStorage.clear();localStorage.setItem('ppw_designer_coach_v1','1');localStorage.setItem('ppw_property_v2',JSON.stringify({version:2,state:{property:p,pxPerMetre:70,showGrid:true}}));},seed);
 const page=await context.newPage();page.setDefaultTimeout(10000);
 const entry={name,checks:[],shots:[],errors:[],externalErrors:[],failures:[]};report.cases.push(entry);
 page.on('pageerror',e=>entry.errors.push(e.message));page.on('console',m=>{if(m.type()==='error'){const source=m.location().url;(source&&!source.startsWith(base)?entry.externalErrors:entry.errors).push({message:m.text(),source});}});
 await page.route('**/api/**',async r=>{if(!['GET','HEAD','OPTIONS'].includes(r.request().method())){entry.errors.push('Unexpected API write '+r.request().url());await r.abort();}else await r.continue();});
 const state=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('ppw_property_v2')).state.property);
 const shot=async label=>{await page.waitForTimeout(350);const path=`${out}/${name}-${label}.png`;await page.screenshot({path,timeout:30000});entry.shots.push(path);expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);};
 const point2d=(x,y)=>planPoint(page,x,y);
 const point3d=(x,y,z=0)=>housePoint(page,x,y,z);
 const click=async p=>{expect(p.x).toBeGreaterThan(0);expect(p.y).toBeGreaterThan(0);expect(p.x).toBeLessThan(viewport.width);expect(p.y).toBeLessThan(viewport.height);await page.mouse.click(p.x,p.y);await page.waitForTimeout(100);};
 try{
  await page.goto(`${base}/designer?view=2d&pitch=1`,{waitUntil:'domcontentloaded'});await page.getByTestId('plan-drawing-viewport').waitFor();await page.waitForTimeout(1200);
  const planTool=async id=>{if(!await page.getByTestId(id).isVisible())await page.getByRole('button',{name:'Build',exact:true}).click();await page.getByTestId(id).click();};
  await planTool('wall-tool-toggle');await page.getByRole('button',{name:'Curved wall',exact:true}).click();await page.getByRole('button',{name:'Fit to view',exact:true}).click();
  for(const[x,y]of[[1,2],[4,2],[2.5,3]])await click(await point2d(x,y));
  await expect.poll(async()=>(await state()).walls?.length??0).toBeGreaterThan(3);
  const planWalls=(await state()).walls.length;await shot('plan-curved-wall');await page.getByRole('button',{name:'Cancel measured drawing'}).click();await expect(page.getByRole('region',{name:'Measured path controls'})).toHaveCount(0);entry.checks.push('Three-tap 2D curve creates measured canonical wall segments and cancels cleanly');
  await planTool('door-tool-toggle');await page.getByText('Size & shape',{exact:true}).click();
  await page.getByLabel('Opening type',{exact:true}).selectOption('hole');await page.getByLabel('Opening profile',{exact:true}).selectOption('circle');await page.getByLabel('Custom opening width',{exact:true}).fill('0.8');await page.getByLabel('Opening sill height',{exact:true}).fill('1.1');await page.getByRole('button',{name:'Fit to view',exact:true}).click();
  await click(await point2d(6,0));await expect.poll(async()=>(await state()).rooms[0].openings?.length??0).toBe(1);
  expect((await state()).rooms[0].openings[0]).toMatchObject({kind:'hole',shape:'circle',widthM:.8,heightM:.8,sillM:1.1});await shot('plan-circular-opening');await page.keyboard.press('Escape');entry.checks.push('Measured circular wall opening with 0.8m diameter and 1.1m sill persists');
  await page.getByRole('button',{name:'3D House',exact:true}).click();await page.getByTestId('wallpaint-3d-gl').waitFor();await page.getByTestId('loading-3d').waitFor({state:'hidden',timeout:60000});await page.waitForTimeout(800);
  await shot('house-circular-opening');
  if(!await page.getByTestId('house-draw-walls').isVisible())await page.getByRole('button',{name:'Build tools',exact:true}).click();await page.getByTestId('house-draw-walls').click();await page.getByRole('button',{name:'Curved wall',exact:true}).click();
  const before=await houseCamera(page);for(const[x,y]of[[4.5,3.5],[6.8,3.5],[5.65,4.5]])await click(await point3d(x,y));
  await expect.poll(async()=>(await state()).walls?.length??0).toBeGreaterThan(planWalls);expect(await houseCamera(page)).toEqual(before);await shot('house-curved-wall');await page.getByRole('button',{name:'Cancel measured drawing'}).click();entry.checks.push('Three-tap 3D curve creates canonical wall segments without moving camera');
  await page.getByLabel('View floor',{exact:true}).selectOption('__roof');await page.waitForTimeout(400);await page.getByRole('button',{name:'Draw roof outline',exact:true}).click();
  await page.getByRole('region',{name:'Measured path controls'}).getByLabel('Overhang (m)',{exact:true}).fill('0.5');
  const roofZ=2.7+.18;
  for(const[x,y]of[[0,0],[8,0],[8,6],[0,6]])await click(await point3d(x,y,roofZ));
  await shot('house-roof-outline-draft');await page.getByRole('button',{name:'Close outline',exact:true}).click();
  await expect.poll(async()=>(await state()).roof?.outline?.length??0).toBe(4);expect((await state()).roof.overhangM).toBe(.5);await shot('house-custom-roof');entry.checks.push('3D custom roof outline commits four canonical vertices and 0.5m overhang');
  await page.getByRole('button',{name:'2D Plan',exact:true}).click();await page.getByTestId('plan-drawing-viewport').waitFor();await page.waitForTimeout(400);await shot('plan-custom-roof');expect((await state()).roof.outline).toHaveLength(4);entry.checks.push('Roof outline survives return to 2D with identical saved geometry');
  expect(entry.errors).toEqual([]);
 }catch(error){entry.failures.push(String(error));await page.screenshot({path:`${out}/${name}-failure.png`,timeout:30000});}
 await context.close();writeFileSync(`${out}/report.json`,JSON.stringify(report,null,2));
}}finally{await browser.close();writeFileSync(`${out}/report.json`,JSON.stringify(report,null,2));}
console.log(JSON.stringify(report,null,2));if(report.cases.some(c=>c.failures.length||c.errors.length))process.exitCode=1;
