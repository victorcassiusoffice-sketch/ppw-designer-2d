import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const base='http://127.0.0.1:5176',out='docs/qa-sims-parity-2026-10-22/after-rotation';mkdirSync(out,{recursive:true});
const property={id:'rotation-acceptance',name:'Rotation acceptance',activeRoomId:'room',activeLevelId:'ground',wallHeightM:2.7,rooms:[{id:'room',name:'Measured room',polygon:[{x:0,y:0},{x:8,y:0},{x:8,y:6},{x:0,y:6}],placedItems:[{instanceId:'table',productId:'demo-console-table',x:3,y:2.6,rotation:0},{instanceId:'shelf',productId:'demo-wall-shelf',x:1,y:.05,rotation:0}]}]};
const report={base,fixture:'real bundled demo-console-table (120×40×75cm), demo-wall-shelf; no fabricated bench SKU',cases:[]};
if(process.env.ROTATION_DEVICE){try{report.cases=JSON.parse(readFileSync(`${out}/report.json`,'utf8')).cases.filter(c=>c.device!==process.env.ROTATION_DEVICE);}catch{}}
const browser=await chromium.launch({headless:true});
const persist=()=>writeFileSync(`${out}/report.json`,JSON.stringify(report,null,2));
try {
for (const [device,viewport] of [['desktop',{width:1280,height:900}],['phone',{width:390,height:844}]]) {
 if(process.env.ROTATION_DEVICE && device!==process.env.ROTATION_DEVICE)continue;
 const context=await browser.newContext({viewport,isMobile:device==='phone',hasTouch:device==='phone',reducedMotion:'reduce'});
 await context.addInitScript(p=>{localStorage.clear();localStorage.setItem('ppw_designer_coach_v1','1');localStorage.setItem('ppw_property_v2',JSON.stringify({version:2,state:{property:p,pxPerMetre:90,showGrid:true}}));},property);
 const page=await context.newPage();page.setDefaultTimeout(30000);
 const row={device,checks:[],shots:[],consoleErrors:[],pageErrors:[],failedResponses:[]};report.cases.push(row);
 page.on('pageerror',e=>row.pageErrors.push(String(e)));page.on('console',m=>{if(m.type()==='error')row.consoleErrors.push(m.text());});
 page.on('response',r=>{if(r.status()>=400)row.failedResponses.push({url:r.url(),status:r.status()});});
 await page.route('**/api/**',route=>['GET','HEAD','OPTIONS'].includes(route.request().method())?route.continue():route.abort());
 const read=()=>page.evaluate(()=>{const p=JSON.parse(localStorage.getItem('ppw_property_v2')).state.property;return {item:p.rooms.flatMap(r=>r.placedItems).find(i=>i.instanceId==='table'),history:JSON.parse(sessionStorage.getItem('ppw_history_top10_v1')||'[]').length,camera:window.__ppwRoomView3d?.camera()};});
 const shot=async name=>{await page.waitForTimeout(100);const path=`${out}/${device}-${name}.png`;await page.screenshot({path});row.shots.push({name,path,state:await read()});persist();};
 const check=async(name,fn)=>{try{await fn();row.checks.push({name,pass:true});console.log(`${device}: ${name} passed`);}catch(e){row.checks.push({name,pass:false,error:String(e)});await shot('FAILED-'+name.replace(/[^\w]+/g,'-'));throw e;}finally{persist();}};
 const centre=item=>{const r=item.rotation*Math.PI/180;return {x:item.x+(1.2*Math.abs(Math.cos(r))+.4*Math.abs(Math.sin(r)))/2,y:item.y+(1.2*Math.abs(Math.sin(r))+.4*Math.abs(Math.cos(r)))/2};};
 const assertCentre=item=>{const c=centre(item);assert(Math.abs(c.x-3.6)<1e-8&&Math.abs(c.y-2.8)<1e-8,`centre drift ${JSON.stringify(c)}`);};
 await page.goto(`${base}/designer?view=2d&pitch=1`,{waitUntil:'networkidle'});
 await page.getByTestId('plan-drawing-viewport').waitFor();
 await page.getByRole('button',{name:'3D House',exact:true}).click();
 await page.getByTestId('wallpaint-3d-gl').waitFor();await page.getByTestId('loading-3d').waitFor({state:'hidden'});
 await page.waitForTimeout(300);
 const select=async id=>{const p=await page.evaluate(id=>window.__ppwRoomView3d.itemScreenPoint(id),id);assert(p,'missing item point');await page.mouse.click(p.x,p.y);await page.waitForTimeout(120);};
 await select('table');await page.getByTestId('view3d-object-turn').waitFor();await shot('3d-rotation-before');
 const ringTurn=async(delta,{fine=false,cancel=false,frames=false}={})=>{
  const svg=page.getByTestId('view3d-object-turn').locator('svg').first();const b=await svg.boundingBox();const c={x:b.x+b.width/2,y:b.y+b.height/2};const r=47;
  if(fine)await page.keyboard.down('Alt');
  await page.mouse.move(c.x,c.y-r);await page.mouse.down();
  for(let i=1;i<=8;i++){const a=(-90+delta*i/8)*Math.PI/180;await page.mouse.move(c.x+Math.cos(a)*r,c.y+Math.sin(a)*r);}
  if(frames)await shot('3d-rotation-preview');
  const during=await read();
  if(cancel)await page.keyboard.press('Escape');
  await page.mouse.up();if(fine)await page.keyboard.up('Alt');await page.waitForTimeout(80);
  return during;
 };
 await check('eight-ring-stops-and-one-undo-each',async()=>{
  for(let i=1;i<=8;i++){const before=await read();const during=await ringTurn(45,{frames:i===1});assert.deepEqual(during.item,before.item,'preview saved pose');assert.equal(during.history,before.history,'preview changed history');const after=await read();assert.equal(after.item.rotation,(i*45)%360);assertCentre(after.item);assert.equal(after.history,before.history+1);if(i===1)await shot('3d-rotation-release');}
 });
 await shot('3d-eight-stops');
 await check('free-one-degree-and-cancel',async()=>{await ringTurn(17,{fine:true});assert.equal((await read()).item.rotation,17);assertCentre((await read()).item);const before=await read();await ringTurn(71,{fine:true,cancel:true});assert.deepEqual((await read()).item,before.item);assert.equal((await read()).history,before.history);});
 await shot('3d-free-17-degrees');
 await check('keyboard-and-undo-redo',async()=>{
  await page.keyboard.press('.');assert.equal((await read()).item.rotation,62);await page.keyboard.press(',');assert.equal((await read()).item.rotation,17);
  await page.keyboard.press('Shift+.');assert.equal((await read()).item.rotation,18);await page.keyboard.press('Alt+,');assert.equal((await read()).item.rotation,17);
  await page.keyboard.press('Control+z');assert.equal((await read()).item.rotation,18);await page.keyboard.press('Control+y');assert.equal((await read()).item.rotation,17);assertCentre((await read()).item);
 });
 if(device==='phone')await check('two-finger-twist-and-touchcancel',async()=>{
  await select('table');await page.getByTestId('view3d-object-turn').waitFor();
  const cdp=await context.newCDPSession(page);const p=await page.evaluate(()=>window.__ppwRoomView3d.itemScreenPoint('table'));const before=await read();
  const touch=(id,x,y)=>({id,x,y,radiusX:3,radiusY:3,force:1});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[touch(1,p.x,p.y)]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[touch(1,p.x,p.y),touch(2,p.x+45,p.y)]});
  await shot('3d-twist-start');
  for(let i=1;i<=8;i++){const a=i*Math.PI/16;await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[touch(1,p.x,p.y),touch(2,p.x+45*Math.cos(a),p.y+45*Math.sin(a))]});}
  await shot('3d-twist-preview');assert.deepEqual((await read()).item,before.item);assert.deepEqual((await read()).camera,before.camera);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});assert.equal((await read()).item.rotation,90);assertCentre((await read()).item);await shot('3d-twist-release');
  const now=await read();const q=await page.evaluate(()=>window.__ppwRoomView3d.itemScreenPoint('table'));
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[touch(3,q.x,q.y)]});await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[touch(3,q.x,q.y),touch(4,q.x+45,q.y)]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[touch(3,q.x,q.y),touch(4,q.x,q.y+45)]});await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});assert.deepEqual((await read()).item,now.item);
 });
 await check('wall-fixture-has-no-rotation-ring',async()=>{await select('shelf');assert.equal(await page.getByTestId('view3d-object-turn').count(),0);});
 await shot('3d-wall-safe');
 // Return through the real Plan control, preserving the exact design.
 await page.getByRole('button',{name:'2D Plan',exact:true}).click();await page.getByTestId('plan-drawing-viewport').waitFor();await page.waitForTimeout(500);
 const planSelect=async()=>{const item=(await read()).item,c=centre(item),p=await page.evaluate(c=>window.__ppwGeom.worldToScreen(c.x,c.y),c);await page.mouse.click(p.x,p.y);await page.waitForTimeout(120);};
 await planSelect();await page.getByTestId('object-placement-controls').waitFor();await shot('2d-rotation-before');
 const planTurn=async(delta,{fine=false,cancel=false}={})=>{const item=(await read()).item,c=centre(item);const info=await page.evaluate(({item,c})=>({centre:window.__ppwGeom.worldToScreen(c.x,c.y),top:window.__ppwGeom.worldToScreen(c.x,item.y),stage:window.__ppwGeom.stage()}),{item,c});const anchor={x:info.top.x,y:info.top.y-18*info.stage.scale},radius=info.centre.y-anchor.y;
  if(fine)await page.keyboard.down('Alt');await page.mouse.move(anchor.x,anchor.y);await page.mouse.down();
  for(let i=1;i<=12;i++){const a=(-90+delta*i/12)*Math.PI/180;await page.mouse.move(info.centre.x+Math.cos(a)*radius,info.centre.y+Math.sin(a)*radius);}
  await shot('2d-rotation-preview');const during=await read();if(cancel)await page.keyboard.press('Escape');await page.mouse.up();if(fine)await page.keyboard.up('Alt');await page.waitForTimeout(120);return during;
 };
 await check('2d-handle-preview-commit-and-cancel',async()=>{const before=await read();const during=await planTurn(45);assert.deepEqual(during.item,before.item);const after=await read();assert.equal(after.item.rotation,Math.round((before.item.rotation+45)/45)*45%360);assertCentre(after.item);assert.equal(after.history,Math.min(10,before.history+1));await shot('2d-rotation-release');const saved=await read();await planTurn(44,{fine:true,cancel:true});assert.deepEqual((await read()).item,saved.item);});
 if(device==='phone')await check('2d-real-touch-handle-and-cancel',async()=>{
  const cdp=await context.newCDPSession(page);
  const turn=async(cancel=false)=>{
   const before=await read(),c=centre(before.item);
   const info=await page.evaluate(({item,c})=>({centre:window.__ppwGeom.worldToScreen(c.x,c.y),top:window.__ppwGeom.worldToScreen(c.x,item.y),stage:window.__ppwGeom.stage()}),{item:before.item,c});
   const anchor={x:info.top.x,y:info.top.y-18*info.stage.scale},radius=info.centre.y-anchor.y;
   const touch=(x,y)=>({id:9,x,y,radiusX:2,radiusY:2,force:1});
   await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[touch(anchor.x,anchor.y)]});
   for(let i=1;i<=12;i++){const a=(-90+45*i/12)*Math.PI/180;await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[touch(info.centre.x+Math.cos(a)*radius,info.centre.y+Math.sin(a)*radius)]});}
   await shot(cancel?'2d-touch-cancel-preview':'2d-touch-preview');assert.deepEqual((await read()).item,before.item);
   await cdp.send('Input.dispatchTouchEvent',{type:cancel?'touchCancel':'touchEnd',touchPoints:[]});await page.waitForTimeout(100);
   if(cancel)assert.deepEqual((await read()).item,before.item);else{assert.equal((await read()).item.rotation,(before.item.rotation+45)%360);assertCentre((await read()).item);}
  };
  await turn();await shot('2d-touch-release');await turn(true);
 });
 row.overflow=await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth);persist();await context.close();
}
} catch(e) {report.failure=String(e);throw e;} finally {persist();await browser.close();}
