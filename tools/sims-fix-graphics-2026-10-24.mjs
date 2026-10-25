/** Read-only real-frame orbit evidence. Run before/after with compiled local preview. */
import { chromium } from '@playwright/test';
import { mkdirSync,writeFileSync,readFileSync } from 'node:fs';
const phase=process.argv[2]??'before',base=process.argv[3]??'http://127.0.0.1:5175';
if(!['before','after'].includes(phase)||!['127.0.0.1','localhost'].includes(new URL(base).hostname))throw Error('Use a local compiled preview');
const warmReselect=process.argv.includes('--warm-reselect');
const dir=`docs/qa-sims-parity-fix-2026-10-24/graphics-${warmReselect?'warm-trial':phase}`;mkdirSync(dir,{recursive:true});
const report={phase,at:new Date().toISOString(),method:'Native D3D11, real pointer orbit, actual completed ThreeStage render calls via data-shading mutations; cache-disabled contexts; no live writes.',cases:[]};
const browser=await chromium.launch({headless:true,args:['--use-angle=d3d11','--enable-gpu','--ignore-gpu-blocklist']});
try{
 const runs=warmReselect?[['preview','auto',base]]:phase==='before'?[['live','auto','https://onelivebuild.com'],['preview','auto',base],['preview','high',base]]:[['preview','auto',base],['preview','high',base]];
 for(const [site,choice,origin] of runs){
  const row={site,choice,origin,errors:[],failed:[],writes:[]};report.cases.push(row);
  const context=await browser.newContext({viewport:{width:1280,height:800},deviceScaleFactor:1});
  try{
   await context.addInitScript(({choice})=>{localStorage.clear();localStorage.setItem('ppw_designer_coach_v1','1');localStorage.setItem('ppw_room_lighting_v1','natural');localStorage.setItem('olb-render-quality-v1',JSON.stringify({state:{choice},version:0}));window.__gfx={first:null,frames:[]};new MutationObserver(records=>{for(const change of records)if(change.attributeName==='data-shading'&&change.target.matches('[data-testid="wallpaint-3d-gl"]')){const t=performance.now();window.__gfx.first??=t;window.__gfx.frames.push(t);}}).observe(document,{subtree:true,attributes:true,attributeFilter:['data-shading']});},{choice});
   const page=await context.newPage();page.setDefaultTimeout(60000);
   const cdp=await context.newCDPSession(page);await cdp.send('Network.enable');await cdp.send('Network.setCacheDisabled',{cacheDisabled:true});
   page.on('console',m=>{if(m.type()==='error')row.errors.push(m.text());});page.on('pageerror',e=>row.errors.push(e.message));page.on('response',r=>{if(r.status()>=400)row.failed.push({url:r.url(),status:r.status()});});
   await page.route('**/*',async route=>{if(!['GET','HEAD','OPTIONS'].includes(route.request().method())){row.writes.push(route.request().method());await route.abort();}else await route.continue();});
   await page.goto(`${origin}/demo?view=3d&pitch=1`,{waitUntil:'domcontentloaded'});
   const gl=page.getByTestId('wallpaint-3d-gl'),stage=page.getByTestId('wallpaint-3d-canvas');await gl.locator(':scope[data-shading]').waitFor();await page.getByTestId('loading-3d').waitFor({state:'hidden'});await page.waitForTimeout(1800);
   row.first3dMs=await page.evaluate(()=>window.__gfx.first);row.camera=JSON.parse(await stage.getAttribute('data-camera'));row.renderCamera=JSON.parse(await stage.getAttribute('data-render-camera'));row.renderer=await gl.evaluate(canvas=>{const gl=canvas.getContext('webgl2'),ext=gl.getExtension('WEBGL_debug_renderer_info');return ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER);});
   row.bundleScripts=await page.locator('script[type="module"][src]').evaluateAll(scripts=>scripts.map(script=>script.getAttribute('src')));
   if(phase==='after'&&choice==='auto')await page.waitForFunction(()=>['enabled','disabled','unavailable'].includes(document.querySelector('[data-testid="wallpaint-3d-gl"]')?.dataset.autoAo),null,{timeout:15000});
   if(warmReselect){
    row.coldDecision=await gl.evaluate(c=>({state:c.dataset.autoAo,fps:c.dataset.autoAoFps}));await page.waitForTimeout(6000);
    await page.getByTestId('house-view-settings').click();await page.getByLabel('3D rendering quality').selectOption('medium');await page.waitForTimeout(500);await page.getByLabel('3D rendering quality').selectOption('auto');await page.getByRole('button',{name:'Close view settings',exact:true}).click();
    await page.waitForFunction(()=>['enabled','disabled','unavailable'].includes(document.querySelector('[data-testid="wallpaint-3d-gl"]')?.dataset.autoAo),null,{timeout:15000});
   }
   row.beforeShading=await gl.getAttribute('data-shading');row.initialAutoAo=await gl.getAttribute('data-auto-ao');await page.screenshot({path:`${dir}/${site}-${choice}-initial.png`});
   row.propertyBefore=await page.evaluate(()=>localStorage.getItem('ppw_property_v2'));
   const bounds=await stage.boundingBox(),cx=bounds.x+bounds.width*.5,cy=bounds.y+bounds.height*.5;
   // A warm orbit lets adaptive Auto make its measured decision before FPS sampling.
   await page.mouse.move(cx,cy);await page.mouse.down({button:'right'});
   let now=Date.now(),start=now;while(now-start<4500){const t=(now-start)/1000;await page.mouse.move(cx+Math.sin(t*1.5)*65,cy+Math.cos(t)*18);now=Date.now();}
   row.adaptation=await gl.evaluate(c=>({shading:c.dataset.shading,autoAo:c.dataset.autoAo,autoFps:c.dataset.autoAoFps}));
   const from=await page.evaluate(()=>{window.__gfx.frames=[];return performance.now();});start=Date.now();let steps=0;
   while(Date.now()-start<10000){const t=(Date.now()-start)/1000;await page.mouse.move(cx+Math.sin(t*1.5)*65,cy+Math.cos(t)*18);steps++;}
   const to=await page.evaluate(()=>performance.now());await page.mouse.up({button:'right'});
   const frames=(await page.evaluate(()=>window.__gfx.frames)).filter(t=>t>=from&&t<=to),intervals=frames.slice(1).map((t,i)=>t-frames[i]).sort((a,b)=>a-b);
   row.motion={fps:frames.length*1000/(to-from),frames:frames.length,durationMs:to-from,p95Ms:intervals[Math.floor(intervals.length*.95)],steps};
   row.shading=await gl.getAttribute('data-shading');row.autoAo=await gl.getAttribute('data-auto-ao');row.autoAoFps=await gl.getAttribute('data-auto-ao-fps');row.quality=await gl.getAttribute('data-quality');row.shadowSize=await gl.getAttribute('data-shadow-size');
   row.autoAoThresholdRespected=row.autoAo!=='enabled'||Number(row.autoAoFps)>=45;
   row.geometryUnchanged=await page.evaluate(before=>before===localStorage.getItem('ppw_property_v2'),row.propertyBefore);delete row.propertyBefore;
   row.overflow=await page.evaluate(()=>Math.max(0,document.documentElement.scrollWidth-innerWidth));await page.screenshot({path:`${dir}/${site}-${choice}-orbited.png`});
   if(phase==='after'){const before=JSON.parse(readFileSync('docs/qa-sims-parity-fix-2026-10-24/graphics-before/report.json','utf8')),reference=before.cases.find(r=>r.site===site&&r.choice===choice);row.sameCamera=JSON.stringify(row.camera)===JSON.stringify(reference?.camera);row.sameRenderCamera=JSON.stringify(row.renderCamera)===JSON.stringify(reference?.renderCamera);}
  }catch(e){row.failure=String(e.stack??e);}finally{await context.close();writeFileSync(`${dir}/report.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(row));}
 }
}finally{await browser.close();}
if(report.cases.some(r=>r.failure))process.exitCode=1;
