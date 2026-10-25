import { chromium,expect } from '@playwright/test';
import { mkdirSync,readFileSync,writeFileSync } from 'node:fs';
const base=process.argv[2]??'http://127.0.0.1:5175';
if(!['127.0.0.1','localhost'].includes(new URL(base).hostname))throw Error('Local isolated QA only');
const out='docs/qa-sims-parity-fix-2026-10-24/wall-hover';mkdirSync(out,{recursive:true});
const fixture=JSON.parse(readFileSync('docs/qa-sims-parity-2026-10-22/before-graphics/report.json','utf8')).fixtures[0].property;
const report={base,at:new Date().toISOString(),cases:[]};
const browser=await chromium.launch({headless:true,args:['--use-angle=d3d11','--enable-gpu','--ignore-gpu-blocklist']});
try{for(const [device,viewport] of [['desktop',{width:1280,height:800}],['phone',{width:390,height:844}]]){
 const row={device,errors:[],writes:[],checks:[]};report.cases.push(row);
 const context=await browser.newContext({viewport,deviceScaleFactor:1,isMobile:device==='phone',hasTouch:device==='phone'});
 try{
  await context.addInitScript(property=>{localStorage.clear();localStorage.setItem('ppw_designer_coach_v1','1');localStorage.setItem('ppw_property_v2',JSON.stringify({version:2,state:{property,pxPerMetre:85,showGrid:false}}));},fixture);
  const page=await context.newPage();page.setDefaultTimeout(45000);page.on('pageerror',e=>row.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')row.errors.push(m.text());});
  await page.route('**/*',async route=>{if(!['GET','HEAD','OPTIONS'].includes(route.request().method())){row.writes.push(route.request().method());await route.abort();}else await route.continue();});
  await page.goto(`${base}/designer?pitch=1`,{waitUntil:'domcontentloaded'});await page.getByRole('button',{name:'3D House',exact:true}).click();
  const gl=page.getByTestId('wallpaint-3d-gl'),stage=page.getByTestId('wallpaint-3d-canvas');await gl.locator(':scope[data-shading]').waitFor();await page.getByTestId('loading-3d').waitFor({state:'hidden'});await page.waitForTimeout(2500);
  const property=await page.evaluate(()=>localStorage.getItem('ppw_property_v2')),camera=await stage.getAttribute('data-camera');
  await page.screenshot({path:`${out}/${device}-before.png`});
  if(device==='desktop'){
   const bounds=await stage.boundingBox();let spot=null;
   for(const fy of [.22,.3,.38,.46,.54]){for(const fx of [.2,.3,.4,.5,.6,.7,.8]){const p={x:bounds.x+bounds.width*fx,y:bounds.y+bounds.height*fy};await page.mouse.move(p.x,p.y);await page.waitForTimeout(35);const wall=await gl.getAttribute('data-hover-cutaway');if(wall){spot={...p,wall};break;}}if(spot)break;}
   expect(spot).not.toBeNull();row.hover=spot;await page.screenshot({path:`${out}/desktop-lowered.png`});
   for(let i=0;i<4;i++){await page.mouse.move(spot.x+i*.5,spot.y);await expect(gl).toHaveAttribute('data-hover-cutaway',spot.wall);}
   expect(await stage.getAttribute('data-camera')).toBe(camera);expect(await page.evaluate(()=>localStorage.getItem('ppw_property_v2'))).toBe(property);row.checks.push('Full wall lowers under cursor without flicker, saved mutation or camera change');
   await page.mouse.move(5,5);await expect(gl).toHaveAttribute('data-hover-cutaway','');await page.screenshot({path:`${out}/desktop-restored.png`});row.checks.push('Pointer leave restores wall');
   await page.getByRole('button',{name:'Walls',exact:true}).click();await page.mouse.move(spot.x,spot.y);await expect(gl).toHaveAttribute('data-hover-cutaway','');row.checks.push('Wall drawing suppresses view-only hover');
   await page.getByRole('button',{name:'Paint',exact:true}).click();await page.mouse.move(spot.x,spot.y);await expect(gl).toHaveAttribute('data-hover-cutaway','');await page.screenshot({path:`${out}/desktop-paint-suppressed.png`});row.checks.push('Paint mode suppresses view-only hover; source wall remains targetable');
  }else{
   await expect(gl).toHaveAttribute('data-auto-ao','phone-off');await expect(gl).toHaveAttribute('data-shading','natural-basic');row.checks.push('Phone Auto stays direct, with AO off');
   const b=await stage.boundingBox();await page.touchscreen.tap(b.x+b.width*.7,b.y+b.height*.35);await expect(gl).toHaveAttribute('data-hover-cutaway','');expect(await page.evaluate(()=>localStorage.getItem('ppw_property_v2'))).toBe(property);row.checks.push('Real touch tap does not trigger cursor hover cutaway');
  }
  row.overflow=await page.evaluate(()=>Math.max(0,document.documentElement.scrollWidth-innerWidth));expect(row.overflow).toBe(0);expect(row.errors).toEqual([]);expect(row.writes).toEqual([]);row.passed=true;
 }catch(e){row.failure=String(e.stack??e);}finally{await context.close();writeFileSync(`${out}/report.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(row));}
}}finally{await browser.close();}
if(report.cases.some(r=>!r.passed))process.exitCode=1;
