import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const base='http://127.0.0.1:5176',out='docs/qa-sims-fix-round-2-2026-10-25/rotation/p1-regressions';mkdirSync(out,{recursive:true});
const report={base,cases:[]};const persist=()=>writeFileSync(`${out}/report.json`,JSON.stringify(report,null,2));
if(process.env.FIX_DEVICE){try{report.cases=JSON.parse(readFileSync(`${out}/report.json`,'utf8')).cases.filter(c=>c.device!==process.env.FIX_DEVICE);}catch{}}
const browser=await chromium.launch({headless:true});
const fixture={id:'fix-acceptance',name:'Interaction acceptance',activeRoomId:'room',activeLevelId:'ground',wallHeightM:2.7,rooms:[{id:'room',name:'Measured room',polygon:[{x:0,y:0},{x:12,y:0},{x:12,y:10},{x:0,y:10}],placedItems:[{instanceId:'chair',productId:'courts-stellar-celosia-chair',x:5,y:4,rotation:0},{instanceId:'table',productId:'demo-console-table',x:2,y:6,rotation:0}]}]};
try {for(const [device,viewport] of [['desktop',{width:1280,height:800}],['phone',{width:390,height:844}]]){
 if(process.env.FIX_DEVICE&&process.env.FIX_DEVICE!==device)continue;
 const context=await browser.newContext({viewport,isMobile:device==='phone',hasTouch:device==='phone',reducedMotion:'reduce'});
 const page=await context.newPage();page.setDefaultTimeout(30000);
 const row={device,checks:[],shots:[],consoleErrors:[],pageErrors:[]};report.cases.push(row);
 page.on('console',m=>{if(m.type()==='error')row.consoleErrors.push(m.text());});page.on('pageerror',e=>row.pageErrors.push(String(e)));
 await page.route('**/api/**',route=>['GET','HEAD','OPTIONS'].includes(route.request().method())?route.continue():route.abort());
 await page.addInitScript(()=>{localStorage.clear();sessionStorage.clear();localStorage.setItem('ppw_designer_coach_v1','1');});
 await page.goto(`${base}/demo?view=2d&pitch=1`,{waitUntil:'networkidle'});
 await page.getByTestId('plan-drawing-viewport').waitFor();
 await page.waitForTimeout(1200);
 const reset=async()=>{await page.evaluate(async p=>{const {usePropertyStore:s}=await import('/src/store/propertyStore.ts');const {useDesignerUIStore:u}=await import('/src/store/designerUIStore.ts');const {usePlacementIntentStore:i}=await import('/src/store/placementIntentStore.ts');i.getState().setArmed(null);s.setState({property:p,selectedInstanceId:null});u.getState().setTool('hand');},fixture);await page.waitForTimeout(250);};
 await reset();await page.getByRole('button',{name:'3D House',exact:true}).click();await page.getByTestId('wallpaint-3d-gl').waitFor();await page.getByTestId('loading-3d').waitFor({state:'hidden'});await page.waitForTimeout(300);
 const state=()=>page.evaluate(()=>({property:JSON.parse(localStorage.getItem('ppw_property_v2')).state.property,camera:window.__ppwRoomView3d?.camera(),ghost:document.querySelector('[data-testid="wallpaint-3d"]')?.getAttribute('data-catalog-preview')}));
 const shot=async name=>{const path=`${out}/${device}-${name}.png`;await page.screenshot({path});row.shots.push({name,path,state:await state()});persist();};
 const check=async(name,fn)=>{try{await fn();row.checks.push({name,pass:true});}catch(e){row.checks.push({name,pass:false,error:String(e)});await shot('FAILED-'+name);}persist();};
 await check('P1-1-selection-keeps-canvas-and-immediate-drag',async()=>{
  const box=page.getByTestId('wallpaint-3d');const before=await box.boundingBox();const p=await page.evaluate(()=>window.__ppwRoomView3d.itemScreenPoint('chair'));
  await shot('selection-before');await page.mouse.click(p.x,p.y);await page.getByTestId('house-selection-strip').waitFor();await page.waitForTimeout(150);
  const after=await box.boundingBox();row.selectionBoxes={before,after};assert.equal(after.y,before.y);assert.equal(after.height,before.height);
  await shot('selection-after');const saved=(await state()).property.rooms.flatMap(r=>r.placedItems).find(i=>i.instanceId==='chair');
  await page.mouse.move(p.x,p.y);await page.mouse.down();await page.mouse.move(p.x+40,p.y+30,{steps:10});await page.mouse.up();await page.waitForTimeout(200);
  const moved=(await state()).property.rooms.flatMap(r=>r.placedItems).find(i=>i.instanceId==='chair');assert.notDeepEqual({x:moved.x,y:moved.y},{x:saved.x,y:saved.y});await shot('selection-immediate-drag');
 });
 await check('P1-3-carried-angle-and-saved-pose',async()=>{
  for(const id of ['courts-gessica-dining-6','courts-stellar-celosia-chair']){
   await reset();await page.evaluate(async id=>(await import('/src/store/placementIntentStore.ts')).usePlacementIntentStore.getState().setArmed(id),id);
   const p=await page.evaluate(()=>window.__ppwRoomView3d.floorScreenPoint(8,7));await page.mouse.move(p.x,p.y);await page.waitForTimeout(120);
   for(const angle of [0,45,90]){
    if(angle)await page.getByRole('button',{name:'Turn carried object right',exact:true}).click();
    await page.mouse.move(p.x+1,p.y);await page.waitForTimeout(100);
    assert.equal((await page.getByTestId('carried-angle').innerText()),`${angle}°`);
    const pose=JSON.parse((await state()).ghost);assert.equal(pose.rotation,angle);assert.equal(pose.valid,true);
    await shot(`${id.includes('gessica')?'dining':'chair'}-carried-${angle}`);
   }
   await page.mouse.click(p.x,p.y);await page.waitForTimeout(200);const added=(await state()).property.rooms.flatMap(r=>r.placedItems).find(i=>i.productId===id&&i.instanceId!=='chair');assert.equal(added?.rotation,90);await shot(`${id.includes('gessica')?'dining':'chair'}-saved-90`);
  }
 });
 await page.getByRole('button',{name:'2D Plan',exact:true}).click();await page.getByTestId('plan-drawing-viewport').waitFor();await reset();await page.waitForTimeout(300);
 await check('P1-2-high-plan-handle-four-turns',async()=>{
  // Place an actual office chair near the viewport's upper edge without
  // changing its dimensions; camera pan here is fixture setup only.
  await page.evaluate(async()=>{const s=(await import('/src/store/propertyStore.ts')).usePropertyStore; s.getState().updateItem('chair',{x:5,y:.25});s.getState().selectItemAcrossRooms('chair');});await page.waitForTimeout(200);
  const info=async()=>page.evaluate(()=>{const stage=window.Konva?.stages?.find(s=>s.findOne('.item-rotate-handle'));const handle=stage?.findOne('.item-rotate-handle');if(!handle)return null;const pos=handle.getAbsolutePosition(),rect=stage.container().getBoundingClientRect(),parent=handle.getParent(),r=parent.findOne(n=>n.getAttr&&n.getAttr('data-testid')==='placed-hit');return {anchor:{x:rect.left+pos.x,y:rect.top+pos.y},centre:{x:rect.left+parent.getAbsoluteTransform().point({x:r.width()/2,y:r.height()/2}).x,y:rect.top+parent.getAbsoluteTransform().point({x:r.width()/2,y:r.height()/2}).y}};});
  // Use the public world transform and measured footprint, not a model write,
  // to derive the new screen-sized affordance's location.
  const anchor=info;
  await shot('high-plan-selected');
  const cdp=device==='phone'?await context.newCDPSession(page):null;
  for(let turn=1;turn<=4;turn++){
   const q=await anchor();row.planAnchors??=[];row.planAnchors.push(q);
   const topElement=await page.evaluate(p=>document.elementFromPoint(p.x,p.y)?.tagName,q.anchor);assert.equal(topElement,'CANVAS','rotation handle is covered by DOM chrome');
   const dx=q.anchor.x-q.centre.x,dy=q.anchor.y-q.centre.y,start=Math.atan2(dy,dx),radius=Math.hypot(dx,dy);
   const touch=(x,y)=>({id:1,x,y,radiusX:3,radiusY:3,force:1});
   if(cdp)await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[touch(q.anchor.x,q.anchor.y)]});else{await page.mouse.move(q.anchor.x,q.anchor.y);await page.mouse.down();}
   for(let n=1;n<=12;n++){const a=start+n*Math.PI/4/12,x=q.centre.x+Math.cos(a)*radius,y=q.centre.y+Math.sin(a)*radius;if(cdp)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[touch(x,y)]});else await page.mouse.move(x,y);}
   if(cdp)await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});else await page.mouse.up();await page.waitForTimeout(100);const item=(await state()).property.rooms.flatMap(r=>r.placedItems).find(i=>i.instanceId==='chair');assert.equal(item.rotation,turn*45);await shot(`high-plan-turn-${turn}`);
  }
 });
 row.overflow=await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth);persist();await context.close();
}}finally{persist();await browser.close();}
if(report.cases.some(c=>c.checks.some(t=>!t.pass)||c.consoleErrors.length||c.pageErrors.length))process.exitCode=1;
