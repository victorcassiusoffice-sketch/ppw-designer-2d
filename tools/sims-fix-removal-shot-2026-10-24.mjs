import { chromium } from '@playwright/test';
import { mkdirSync,writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const base='http://127.0.0.1:5176',out='docs/qa-sims-parity-fix-2026-10-24/removal';mkdirSync(out,{recursive:true});
const report={base,cases:[]},save=()=>writeFileSync(`${out}/report.json`,JSON.stringify(report,null,2));
const property={id:'remove-acceptance',name:'Measured removal fixture',activeRoomId:'room',activeLevelId:'ground',wallHeightM:2.7,rooms:[{id:'room',name:'Room',polygon:[{x:0,y:0},{x:8,y:0},{x:8,y:6},{x:0,y:6}],floorFinish:{materialId:'rubber-composite'},openings:[{id:'door',kind:'door',edgeIndex:2,offsetM:2,widthM:.9,flipFacing:false,flipHand:false}],placedItems:[{instanceId:'chair',productId:'courts-stellar-celosia-chair',x:4,y:3,rotation:0},{instanceId:'table',productId:'demo-console-table',x:2,y:4,rotation:0},{instanceId:'child',productId:'demo-aroma-diffuser',x:2.25,y:4.1,rotation:0,parentInstanceId:'table'},{instanceId:'blind',productId:'courts-blind-white-180',x:2,y:.05,rotation:0}]}],walls:[{id:'free',a:{x:6,y:3.5},b:{x:6,y:5.5},levelId:'ground',thicknessM:.15}]};
const browser=await chromium.launch({headless:true});
try{for(const [device,viewport] of [['desktop',{width:1280,height:800}],['phone',{width:390,height:844}]]){
 if(process.env.FIX_DEVICE&&process.env.FIX_DEVICE!==device)continue;
 const context=await browser.newContext({viewport,isMobile:device==='phone',hasTouch:device==='phone',reducedMotion:'reduce'}),page=await context.newPage();page.setDefaultTimeout(15000);
 const row={device,checks:[],shots:[],consoleErrors:[],pageErrors:[]};report.cases.push(row);
 page.on('console',m=>{if(m.type()==='error')row.consoleErrors.push(m.text());});page.on('pageerror',e=>row.pageErrors.push(String(e)));
 await page.addInitScript(()=>{localStorage.clear();sessionStorage.clear();localStorage.setItem('ppw_designer_coach_v1','1');});
 await page.goto(`${base}/demo?view=2d&pitch=1`,{waitUntil:'networkidle'});await page.getByTestId('plan-drawing-viewport').waitFor();await page.waitForTimeout(1200);
 const reset=async()=>{await page.evaluate(async p=>{const s=(await import('/src/store/propertyStore.ts')).usePropertyStore;const u=(await import('/src/store/designerUIStore.ts')).useDesignerUIStore;const i=(await import('/src/store/placementIntentStore.ts')).usePlacementIntentStore;i.getState().setArmed(null);(await import('/src/store/toastStore.ts')).useToastStore.getState().clear();s.setState({property:p,selectedInstanceId:null});u.getState().setTool('hand');},property);await page.waitForTimeout(200);};
 const state=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('ppw_property_v2')).state.property);
 const shot=async name=>{const path=`${out}/${device}-${name}.png`;await page.screenshot({path});row.shots.push({name,path,property:await state()});save();};
 const check=async(name,fn)=>{try{await fn();row.checks.push({name,pass:true});}catch(e){row.checks.push({name,pass:false,error:String(e)});await shot('FAILED-'+name);}save();};
 await reset();await page.getByRole('button',{name:'3D House',exact:true}).click();await page.getByTestId('wallpaint-3d-gl').waitFor();await page.getByTestId('loading-3d').waitFor({state:'hidden'});await page.waitForTimeout(300);
 const select=async id=>{const p=await page.evaluate(id=>window.__ppwRoomView3d.itemScreenPoint(id),id);assert(p);await page.mouse.click(p.x,p.y);await page.waitForTimeout(150);};
 await check('P2-parent-refusal-and-height-cap',async()=>{
  await select('table');assert.equal(await page.getByTestId('view3d-object-turn').count(),0);await page.getByText('Move the objects on this surface before turning it.',{exact:true}).waitFor();await shot('parent-refusal');
  await select('blind');const height=page.getByRole('spinbutton',{name:'Wall item height in centimetres'});await height.fill('150');await height.blur();await page.waitForTimeout(100);
  assert.equal((await state()).rooms[0].placedItems.find(i=>i.instanceId==='blind').mountHeightCm,70);await page.getByText('70 cm is the highest for this wall and object.',{exact:true}).first().waitFor();await shot('height-cap-message');
 });
 await check('P2-tight-rotation-reason',async()=>{
  await reset();await page.evaluate(async()=>{const s=(await import('/src/store/propertyStore.ts')).usePropertyStore;s.getState().updateItem('chair',{x:.1,y:.1});s.getState().selectItemAcrossRooms('chair');});await page.waitForTimeout(200);
  const ring=page.getByTestId('view3d-object-turn').locator('svg').first(),b=await ring.boundingBox();assert(b);const c={x:b.x+b.width/2,y:b.y+b.height/2};await page.mouse.move(c.x,c.y-47);await page.mouse.down();for(let i=1;i<=8;i++){const a=(-90+i*45/8)*Math.PI/180;await page.mouse.move(c.x+Math.cos(a)*47,c.y+Math.sin(a)*47);}await page.mouse.up();
  assert.equal((await state()).rooms[0].placedItems.find(i=>i.instanceId==='chair').rotation,0);await page.getByText('Not enough space to turn here.',{exact:true}).first().waitFor();await shot('tight-rotation-refused');
 });
 await check('P2-indoor-blind-rejects-exterior',async()=>{
  await reset();await page.evaluate(async()=>{(await import('/src/store/placementIntentStore.ts')).usePlacementIntentStore.getState().setArmed('courts-blind-white-180');});
  const p=await page.evaluate(()=>window.__ppwRoomView3d.floorScreenPoint(4,-.25));assert(p);await page.mouse.move(p.x,p.y);await page.waitForTimeout(100);
  const ghost=JSON.parse(await page.getByTestId('wallpaint-3d').getAttribute('data-catalog-preview'));assert.equal(ghost.valid,false);const before=await state();await page.mouse.click(p.x,p.y);await page.waitForTimeout(100);assert.deepEqual(await state(),before);await shot('exterior-blind-refused');await page.keyboard.press('Escape');
 });
 for(const view of ['3d','2d']){
  if(view==='2d'){await page.getByRole('button',{name:'2D Plan',exact:true}).click();await page.getByTestId('plan-drawing-viewport').waitFor();}
  const point=async(kind)=>page.evaluate(({kind,view})=>{if(view==='2d'){const m={item:[4.3,3.3],opening:[6,6],wall:[6,4.5],floor:[5,4.5],boundary:[0,3]}[kind];return window.__ppwGeom.worldToScreen(...m);}const b=window.__ppwRoomView3d;return kind==='item'?b.itemScreenPoint('chair'):kind==='opening'?b.openingScreenPoint('door'):kind==='wall'?b.wallScreenPoint({kind:'free',wallId:'free'}):kind==='boundary'?b.wallScreenPoint({kind:'edge',roomId:'room',edgeIndex:3}):b.floorScreenPoint(5,4.5);},{kind,view});
  const arm=async()=>{if(view==='3d'){const button=page.getByTestId('remove-tool-3d');if(!await button.isVisible())await page.getByRole('button',{name:'Build tools',exact:true}).click();await button.click();await page.getByTestId('remove-3d-hud').waitFor();}else{await page.keyboard.press('j');await page.getByTestId('remove-hud').waitFor();}};
  await check(`remove-${view}-targets-and-undo`,async()=>{
   for(const kind of ['item','opening','wall','floor']){
    await reset();await arm();const before=await state(),p=await point(kind);assert(p,`no ${kind} point`);await page.mouse.move(p.x,p.y);await page.waitForTimeout(100);await shot(`${view}-${kind}-highlight`);
    const hud=await (view==='3d'?page.getByTestId('remove-3d-hud'):page.getByTestId('remove-hud').locator('[data-target-kind]')).getAttribute('data-target-kind');assert.equal(hud,kind);
    await page.mouse.click(p.x,p.y);await page.waitForTimeout(150);const after=await state();assert.notDeepEqual(after,before,`${kind} not removed`);assert.deepEqual(after.rooms[0].polygon,before.rooms[0].polygon);await shot(`${view}-${kind}-removed`);
    await page.keyboard.press('Control+z');await page.waitForTimeout(100);assert.deepEqual(await state(),before,`${kind} Undo differs`);await shot(`${view}-${kind}-undo`);await page.keyboard.press('Escape');
   }
  });
  await check(`remove-${view}-cancel-and-perimeter-refusal`,async()=>{
   await reset();await arm();const before=await state(),p=await point('item');await page.mouse.move(p.x,p.y);await page.keyboard.press('Escape');await page.mouse.click(p.x,p.y);assert.deepEqual(await state(),before);
   await arm();const wall=await point('boundary');assert(wall);await page.mouse.move(wall.x,wall.y);await page.waitForTimeout(80);await page.mouse.click(wall.x,wall.y);assert.deepEqual(await state(),before);await page.getByText(/Room-boundary removal is not available here/).first().waitFor();await shot(`${view}-boundary-refused`);await page.keyboard.press('Escape');
  });
 }
 row.overflow=await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth);await context.close();save();
}}finally{save();await browser.close();}
if(report.cases.some(c=>c.checks.some(t=>!t.pass)||c.consoleErrors.length||c.pageErrors.length))process.exitCode=1;
