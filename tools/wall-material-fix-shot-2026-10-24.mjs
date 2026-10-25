import { chromium, expect } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
const out='docs/qa-sims-parity-fix-2026-10-24/wall-material',base='http://127.0.0.1:5176';
mkdirSync(out,{recursive:true}); const report={base,cases:[]};
const browser=await chromium.launch({headless:true,args:['--use-angle=d3d11']});
const fixture={id:'wall-material-fix',name:'Measured room',activeRoomId:'room',activeLevelId:'ground',wallHeightM:2.7,
 rooms:[{id:'room',name:'Measured room',polygon:[{x:0,y:0},{x:7,y:0},{x:7,y:5},{x:0,y:5}],placedItems:[],
 wallConstruction:[0,1,2,3].map(edgeIndex=>({edgeIndex,kind:'plastered-brick'})),
 wallPaint:[0,1,2,3].map(edgeIndex=>({edgeIndex,paintId:'permoglaze-matt-emulsion'}))}]};
try{for(const [device,viewport] of [['desktop',{width:1280,height:800}],['phone',{width:390,height:844}]]){
 for(const view of ['2d','3d']){
 const row={device,view,errors:[],writes:[],checks:[],shots:[]};report.cases.push(row);
 const context=await browser.newContext({viewport,isMobile:device==='phone',hasTouch:device==='phone'});
 await context.addInitScript(()=>{localStorage.clear();sessionStorage.clear();localStorage.setItem('ppw_designer_coach_v1','1');});
 const page=await context.newPage();page.setDefaultTimeout(20000);
 page.on('pageerror',e=>row.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')row.errors.push(m.text());});
 await page.route('**/api/**',route=>{if(['GET','HEAD','OPTIONS'].includes(route.request().method()))return route.continue();row.writes.push(route.request().url());return route.abort();});
 const shot=async name=>{await page.waitForTimeout(150);const path=`${out}/${device}-${view}-${name}.png`;await page.screenshot({path});row.shots.push(path);};
 try{
 await page.goto(`${base}/demo?view=2d&pitch=1`,{waitUntil:'networkidle'});
 await page.getByTestId('plan-drawing-viewport').waitFor();
 await page.evaluate(async p=>{const {usePropertyStore:s}=await import('/src/store/propertyStore.ts');s.setState({property:p,selectedInstanceId:null});},fixture);
 if(view==='3d'){await page.getByRole('button',{name:'3D House',exact:true}).click();await page.getByTestId('wallpaint-3d-gl').waitFor();await page.getByTestId('loading-3d').waitFor({state:'hidden',timeout:60000});}
 await page.waitForTimeout(300);await shot('painted-before');
 // Activate through the UI. Phone Plan opens the existing tool sheet.
 if(view==='3d') await page.getByTestId('house-mode-paint').click();
 else {await page.getByRole('button',{name:'Finish',exact:true}).click();await page.getByTestId('wallpaint-tool-toggle').click();}
 const wallType=page.getByRole('button',{name:'Wall type',exact:true});
 if(await wallType.isVisible().catch(()=>false))await wallType.click();
 else await page.getByRole('button',{name:'Wall material',exact:true}).filter({visible:true}).click();
 await page.getByRole('button',{name:'Exposed brick',exact:true}).filter({visible:true}).click();
 if(view==='2d'&&device==='phone'){
  // Close only the mobile tool sheet; do not exit the armed brush.
  const close=page.getByRole('button',{name:/Close menu|Close tools|Close panel/}).filter({visible:true});
  if(await close.count())await close.first().click();
 }
 await page.waitForTimeout(300);
 const hit={kind:'edge',roomId:'room',edgeIndex:0};
 const point=await page.evaluate(({view,hit})=>view==='3d'?window.__ppwRoomView3d.wallScreenPoint(hit):window.__ppwGeom.worldToScreen(3.5,0),{view,hit});
 expect(point).toBeTruthy();row.clickPoint=point;
 await page.mouse.move(point.x,point.y);await page.mouse.click(point.x,point.y);
 await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('ppw_property_v2')).state.property.rooms[0].wallConstruction?.find(e=>e.edgeIndex===0)?.kind)).toBe('brick');
 const state=await page.evaluate(()=>JSON.parse(localStorage.getItem('ppw_property_v2')).state.property);
 expect(state.rooms[0].wallPaint.some(e=>e.edgeIndex===0)).toBe(false);
 await page.mouse.move(2,viewport.height-2);await shot('brick-after-click');
 row.checks.push('Real pointer wall click saves brick and removes covering paint');
 const dimensions=page.getByRole('button',{name:'Height & thickness',exact:true}).filter({visible:true});
 if(await dimensions.count()){
 await dimensions.first().click();
 const input=page.getByRole('spinbutton',{name:'Masonry wall thickness in millimetres'}).filter({visible:true});
 await input.fill('250');await input.blur();
 await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('ppw_property_v2')).state.property.materials.wall.thicknessM)).toBe(.25);
 await shot('height-thickness');row.checks.push('Thickness control writes 250mm to shared Materials and wall geometry');
 }
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
 expect(row.errors).toEqual([]);expect(row.writes).toEqual([]);
 }catch(error){row.failure=String(error);await shot('FAILURE');}
 await context.close();writeFileSync(`${out}/report.json`,JSON.stringify(report,null,2));
 }} }finally{await browser.close();writeFileSync(`${out}/report.json`,JSON.stringify(report,null,2));}
console.log(JSON.stringify(report,null,2));if(report.cases.some(r=>r.failure||r.errors.length||r.writes.length))process.exitCode=1;
