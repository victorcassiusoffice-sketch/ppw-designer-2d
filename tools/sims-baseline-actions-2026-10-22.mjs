import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
const out='docs/qa-sims-parity-2026-10-22/before-actions'; mkdirSync(out,{recursive:true});
const property={id:'sims-audit',name:'Sims interaction audit',activeRoomId:'room',activeLevelId:'ground',wallHeightM:2.7,site:{widthM:12,depthM:10,originM:{x:-2,y:-2}},rooms:[{id:'room',name:'Measured room',polygon:[{x:0,y:0},{x:8,y:0},{x:8,y:6},{x:0,y:6}],placedItems:[{instanceId:'table',productId:'demo-console-table',x:2,y:2,rotation:0},{instanceId:'child',productId:'demo-aroma-diffuser',x:2.2,y:2.1,rotation:0,parentInstanceId:'table'},{instanceId:'shelf',productId:'demo-wall-shelf',x:1,y:.05,rotation:0},{instanceId:'chair',productId:'demo-garden-bench',x:4,y:3,rotation:0}],openings:[{id:'door',kind:'door',edgeIndex:2,offsetM:3,widthM:.9,flipHand:false,flipFacing:false}]}]};
const browser=await chromium.launch({headless:true}); const report={base:'http://127.0.0.1:5176',cases:[]};
try{
for(const [device,viewport] of [['desktop',{width:1280,height:900}],['phone',{width:390,height:844}]]){
 const ctx=await browser.newContext({viewport,hasTouch:device==='phone',isMobile:device==='phone'});
 await ctx.addInitScript(p=>{ if(sessionStorage.getItem('sims-audit'))return;localStorage.clear();localStorage.setItem('ppw_designer_coach_v1','1');localStorage.setItem('ppw_property_v2',JSON.stringify({version:2,state:{property:p,pxPerMetre:90,showGrid:true}}));sessionStorage.setItem('sims-audit','1');},property);
 const page=await ctx.newPage();page.setDefaultTimeout(20000);const row={device,errors:[],steps:[]};report.cases.push(row);
 page.on('pageerror',e=>row.errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')row.errors.push(m.text());});
 await page.route('**/api/**',r=>['GET','HEAD','OPTIONS'].includes(r.request().method())?r.continue():r.abort());
 const shot=async name=>{await page.waitForTimeout(300);const path=`${out}/${device}-${name}.png`;await page.screenshot({path}); row.steps.push({name,path,state:await page.evaluate(()=>({property:JSON.parse(localStorage.getItem('ppw_property_v2')),text:document.body.innerText,bridge:window.__ppwRoomView3d?.debug(),camera:window.__ppwRoomView3d?.camera()}))});writeFileSync(`${out}/report.json`,JSON.stringify(report,null,2));};
 await page.goto(`${report.base}/designer?view=2d&pitch=1`,{waitUntil:'networkidle'});await shot('plan-attachments');
 await page.getByRole('button',{name:'3D House',exact:true}).click();await page.getByTestId('wallpaint-3d-gl').waitFor();await page.getByTestId('loading-3d').waitFor({state:'hidden'});await shot('house');
 const point=await page.evaluate(()=>window.__ppwRoomView3d?.itemScreenPoint('table'));if(!point)throw Error('No table point');
 await page.mouse.click(point.x,point.y);await shot('selected-table');
 await page.keyboard.press('.');await shot('key-turn-table-with-child');
 const p=await page.evaluate(()=>window.__ppwRoomView3d?.itemScreenPoint('table'));
 await page.mouse.move(p.x,p.y);await page.mouse.down();await page.mouse.move(p.x+40,p.y+25,{steps:12});await shot('moving-table');await page.mouse.up();await shot('moved-table-child');
 await page.keyboard.press('Control+z');await shot('undo-move');
 const s=await page.evaluate(()=>window.__ppwRoomView3d?.itemScreenPoint('shelf'));if(s){await page.mouse.click(s.x,s.y);await shot('wall-item-selection');}
 await ctx.close();console.log(JSON.stringify({device,steps:row.steps.length,errors:row.errors}));
}
}finally{await browser.close();writeFileSync(`${out}/report.json`,JSON.stringify(report,null,2));}
