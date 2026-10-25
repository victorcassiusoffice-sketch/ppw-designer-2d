/** Read-only live/preview comparison after the real Fit control establishes equal projection. */
import { chromium,expect } from '@playwright/test';
import { mkdirSync,writeFileSync } from 'node:fs';
const base=process.argv[2]??'http://127.0.0.1:5173';
if(!['127.0.0.1','localhost'].includes(new URL(base).hostname))throw Error('Preview must be local');
const out='docs/qa-sims-parity-fix-2026-10-24/matched-camera';mkdirSync(out,{recursive:true});
const report={at:new Date().toISOString(),method:'Actual Fit control after initial load. Fixed 1168 × 592 canvas for projection comparison; same 1280 × 800 browser viewport. No source scene or camera values injected. No performance claims from this capture.',cases:[]};
const browser=await chromium.launch({headless:true,args:['--use-angle=d3d11','--enable-gpu','--ignore-gpu-blocklist']});
try{for(const [site,choice,url] of [['live','auto','https://onelivebuild.com'],['preview','auto',base],['preview','high',base]]){
 const row={site,choice,errors:[],failed:[],writes:[]};report.cases.push(row);const context=await browser.newContext({viewport:{width:1280,height:800},deviceScaleFactor:1});
 try{
  await context.addInitScript(choice=>{localStorage.clear();localStorage.setItem('ppw_designer_coach_v1','1');localStorage.setItem('ppw_room_lighting_v1','natural');localStorage.setItem('olb-render-quality-v1',JSON.stringify({state:{choice},version:0}));},choice);
  const page=await context.newPage();page.setDefaultTimeout(45000);page.on('pageerror',e=>row.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')row.errors.push(m.text());});page.on('response',r=>{if(r.status()>=400)row.failed.push({url:r.url(),status:r.status()});});
  await page.route('**/*',async route=>{if(!['GET','HEAD','OPTIONS'].includes(route.request().method())){row.writes.push(route.request().method());await route.abort();}else await route.continue();});
  await page.goto(`${url}/demo?view=3d&pitch=1`,{waitUntil:'domcontentloaded'});
  const stage=page.getByTestId('wallpaint-3d-canvas'),gl=page.getByTestId('wallpaint-3d-gl');await gl.locator(':scope[data-shading]').waitFor();await page.getByTestId('loading-3d').waitFor({state:'hidden'});await page.waitForTimeout(4000);
  const property=await page.evaluate(()=>localStorage.getItem('ppw_property_v2'));
  // Standardise only the captured viewport box: both apps then use their own
  // ordinary ResizeObserver and Fit button to compute the real camera.
  await stage.evaluate(element=>{element.style.width='1168px';element.style.height='592px';element.style.minHeight='592px';element.style.maxHeight='592px';element.style.flex='none';});await page.waitForTimeout(300);
  await page.getByTestId('wallpaint-3d-fit').click();await page.mouse.move(5,5);await page.waitForTimeout(4500);
  row.camera=JSON.parse(await stage.getAttribute('data-camera'));row.renderCamera=JSON.parse(await stage.getAttribute('data-render-camera'));row.canvas=await stage.boundingBox();row.shading=await gl.getAttribute('data-shading');row.autoAo=await gl.getAttribute('data-auto-ao');row.autoFps=await gl.getAttribute('data-auto-ao-fps');
  row.geometryUnchanged=await page.evaluate(before=>before===localStorage.getItem('ppw_property_v2'),property);expect(row.geometryUnchanged).toBe(true);expect(row.writes).toEqual([]);
  await page.screenshot({path:`${out}/${site}-${choice}.png`});
  if(report.cases.length>1){const ref=report.cases[0];row.sameCamera=JSON.stringify(row.camera)===JSON.stringify(ref.camera);row.sameRenderCamera=JSON.stringify(row.renderCamera)===JSON.stringify(ref.renderCamera);row.sameCanvasDimensions=row.canvas.width===ref.canvas.width&&row.canvas.height===ref.canvas.height;expect(row.sameCamera&&row.sameRenderCamera&&row.sameCanvasDimensions).toBe(true);}
 }catch(e){row.failure=String(e.stack??e);}finally{await context.close();writeFileSync(`${out}/report.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(row));}
}}finally{await browser.close();}
if(report.cases.some(row=>row.failure))process.exitCode=1;
