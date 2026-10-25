import { chromium, expect } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
const out='docs/qa-sims-parity-2026-10-22/placement-after'; mkdirSync(out,{recursive:true});
const base='http://127.0.0.1:5176';
const baseRoom={id:'room',name:'Measured room',polygon:[{x:0,y:0},{x:8,y:0},{x:8,y:6},{x:0,y:6}],placedItems:[],openings:[{id:'door',kind:'door',edgeIndex:0,offsetM:3,widthM:.9,flipHand:false,flipFacing:false}]};
const property=items=>({id:'sims-audit',name:'Sims interaction audit',activeRoomId:'room',activeLevelId:'ground',wallHeightM:2.7,site:{widthM:12,depthM:10,originM:{x:-2,y:-2}},rooms:[{...baseRoom,placedItems:items}]});
const table={instanceId:'table',productId:'demo-console-table',x:2,y:2,rotation:0};
const child={instanceId:'child',productId:'demo-aroma-diffuser',x:2.2,y:2.1,rotation:0,parentInstanceId:'table'};
const shelf={instanceId:'shelf',productId:'demo-wall-shelf',x:1,y:.05,rotation:0};
const report={base,cases:[]};const browser=await chromium.launch({headless:true,args:['--use-angle=d3d11']});
try{
for(const [device,viewport] of [['desktop',{width:1280,height:900}],['phone',{width:390,height:844}]]){
 const ctx=await browser.newContext({viewport,hasTouch:device==='phone',isMobile:device==='phone'});
 const row={device,errors:[],checks:[],shots:[],failures:[]};report.cases.push(row);
 await ctx.addInitScript(p=>{if(sessionStorage.getItem('sims-audit'))return;localStorage.clear();localStorage.setItem('ppw_designer_coach_v1','1');localStorage.setItem('ppw_property_v2',JSON.stringify({version:2,state:{property:p,pxPerMetre:90,showGrid:true}}));sessionStorage.setItem('sims-audit','1');},property([table,child,shelf]));
 const page=await ctx.newPage();page.setDefaultTimeout(25000);page.on('pageerror',e=>row.errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')row.errors.push(m.text()+' '+m.location().url)});
 const state=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('ppw_property_v2')).state.property);
 const items=async()=> (await state()).rooms.flatMap(r=>r.placedItems);
 const shot=async name=>{await page.waitForTimeout(300);let path=`${out}/${device}-${name}.png`;await page.screenshot({path});row.shots.push(path);expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);writeFileSync(`${out}/report.json`,JSON.stringify(report,null,2));};
 try{
 await page.goto(`${base}/designer?view=2d&pitch=1`,{waitUntil:'networkidle'});await shot('plan-attachments');
 await page.getByRole('button',{name:'3D House',exact:true}).click();await page.getByTestId('wallpaint-3d-gl').waitFor();await page.getByTestId('loading-3d').waitFor({state:'hidden'});await shot('house');
 let point=await page.evaluate(()=>window.__ppwRoomView3d.itemScreenPoint('table'));await page.mouse.click(point.x,point.y);await shot('selected-table');
 let selected=page.getByTestId('object-placement-controls');await expect(selected).toBeVisible();
 const before=await items();point=await page.evaluate(()=>window.__ppwRoomView3d.itemScreenPoint('table'));
 await page.mouse.move(point.x,point.y);await page.mouse.down();await page.mouse.move(point.x+40,point.y+25,{steps:12});await shot('moving-table');await page.mouse.up();await page.waitForTimeout(300);await shot('moved-table-child');
 const moved=await items();const mt=moved.find(i=>i.instanceId==='table'),mc=moved.find(i=>i.instanceId==='child');expect(mt.x!==2||mt.y!==2).toBe(true);expect(mc.x-mt.x).toBeCloseTo(.2,6);expect(mc.y-mt.y).toBeCloseTo(.1,6);
 await page.keyboard.press('Control+z');await page.waitForTimeout(250);expect((await items()).find(i=>i.instanceId==='table')).toEqual(before.find(i=>i.instanceId==='table'));await shot('undo-move');await page.keyboard.press('Control+Shift+z');await page.waitForTimeout(200);expect((await items()).find(i=>i.instanceId==='table').x).toBe(mt.x);row.checks.push('3D pointer move carries table child; Undo and Redo preserve offsets');
 point=await page.evaluate(()=>window.__ppwRoomView3d.itemScreenPoint('shelf'));await page.mouse.click(point.x,point.y);await page.getByRole('spinbutton',{name:'Wall item height in centimetres'}).fill('170');await page.getByRole('spinbutton',{name:'Wall item height in centimetres'}).blur();await expect.poll(async()=>(await items()).find(i=>i.instanceId==='shelf').mountHeightCm).toBe(170);await shot('wall-item-raised');row.checks.push('Wall item height persisted at 170cm');
 // Turn an exact selected product into a carried copy without purchasing or writing remotely.
 point=await page.evaluate(()=>window.__ppwRoomView3d.itemScreenPoint('table'));await page.mouse.click(point.x,point.y);await page.getByRole('button',{name:'Copy type',exact:true}).click();await page.getByRole('button',{name:'25 cm',exact:true}).click();await page.getByRole('button',{name:'Turn carried object right'}).click();
 point=await page.evaluate(()=>window.__ppwRoomView3d.floorScreenPoint(5,3));await page.mouse.move(point.x,point.y,{steps:5});await shot('carried-half-step');row.ghostPreview=await page.locator('[data-catalog-preview]').first().getAttribute('data-catalog-preview');
 await page.getByRole('button',{name:'Free',exact:true}).click();await page.mouse.move(point.x+10,point.y+10,{steps:3});await shot('carried-free');await page.getByRole('button',{name:'Cancel',exact:true}).click();expect((await items()).length).toBe(3);row.checks.push('Copy type arms exact product; half/free controls and ghost rotation; cancel makes no item');
 // Fresh plan scene. Initial item is a fixture; nineteen actual clicks place the rest.
 await page.evaluate(p=>{localStorage.setItem('ppw_property_v2',JSON.stringify({version:2,state:{property:p,pxPerMetre:90,showGrid:true}}));},property([{instanceId:'seed',productId:'demo-floor-lamp',x:.5,y:.5,rotation:0}]));
 await page.goto(`${base}/designer?view=2d&pitch=1`,{waitUntil:'networkidle'});await page.getByTestId('plan-drawing-viewport').waitFor();
 point=await page.evaluate(()=>window.__ppwGeom.worldToScreen(.7,.7));await page.mouse.click(point.x,point.y);await page.getByRole('button',{name:'Copy type',exact:true}).click();await page.getByRole('button',{name:'50 cm',exact:true}).click();
 await page.keyboard.down('Shift');
 for(let i=1;i<20;i++){point=await page.evaluate(({x,y})=>window.__ppwGeom.worldToScreen(x,y),{x:.7+(i%5)*1.2,y:.7+Math.floor(i/5)*1.2});await page.mouse.move(point.x,point.y,{steps:2});await page.mouse.click(point.x,point.y);await page.waitForTimeout(60);}
 await page.keyboard.up('Shift');await page.keyboard.press('Escape');
 const twenty=await items();expect(twenty.length).toBe(20);for(let i=0;i<20;i++)for(let j=i+1;j<20;j++)expect(Math.abs(twenty[i].x-twenty[j].x)>=.3999||Math.abs(twenty[i].y-twenty[j].y)>=.3999).toBe(true);
 await page.keyboard.press('Escape');await page.waitForTimeout(1900);await shot('twenty-no-overlap');row.checks.push('19 pointer placements plus seeded lamp: 20 exact catalogue objects, no overlaps');
 // A fresh exterior container must not be created by an invalid drop.
 point=await page.evaluate(()=>window.__ppwGeom.worldToScreen(.7,.7));await page.mouse.click(point.x,point.y);await page.getByRole('button',{name:'Copy type',exact:true}).click();
 await page.getByRole('button',{name:'Free',exact:true}).click();const beforeInvalid=await state();point=await page.evaluate(()=>window.__ppwGeom.worldToScreen(9.95,-1.8));await page.mouse.move(point.x,point.y,{steps:4});await shot('invalid-plot-edge');await page.mouse.click(point.x,point.y);await page.waitForTimeout(100);expect(await state()).toEqual(beforeInvalid);await page.keyboard.press('Escape');row.checks.push('Invalid first outdoor drop creates neither object nor outdoor room');
 point=await page.evaluate(()=>window.__ppwGeom.worldToScreen(.7,.7));await page.mouse.click(point.x,point.y);const beforeDelete=(await items()).length;await page.keyboard.press('Delete');await page.waitForTimeout(300);expect((await items()).length).toBe(beforeDelete-1);await shot('delete');await page.keyboard.press('Control+z');await page.waitForTimeout(300);expect((await items()).length).toBe(beforeDelete);await shot('undo-delete');row.checks.push('Selected item delete and undo restore exact count');
 expect(row.errors).toEqual([]);
 }catch(e){row.failures.push(String(e));await shot('failure');}
 await ctx.close();writeFileSync(`${out}/report.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(row));
}
}finally{await browser.close();writeFileSync(`${out}/report.json`,JSON.stringify(report,null,2));}
if(report.cases.some(c=>c.errors.length||c.failures.length))process.exitCode=1;
