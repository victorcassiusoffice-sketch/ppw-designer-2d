import {chromium} from '@playwright/test';
import {mkdirSync,writeFileSync} from 'node:fs';
const phase=process.argv[2]??'before',base=process.argv[3]??'https://onelivebuild.com',out=`docs/qa-sims-fix-round-2-2026-10-25/${phase}`;
mkdirSync(out,{recursive:true});const report={at:new Date().toISOString(),phase,base,method:'Fresh Chromium process/profile per run; no network/CPU throttling. Reviewer loading-hidden method plus first real render timestamp. Native D3D11. Orbit counts completed renders, not idle RAF.',runs:[]};
for(const device of ['desktop','phone'])for(let run=1;run<=Number(process.argv[4]??3);run++){
 const row={device,run,errors:[],failed:[],writes:[]};report.runs.push(row);
 const browser=await chromium.launch({headless:true,args:['--use-angle=d3d11','--enable-gpu','--ignore-gpu-blocklist']});
 try{
 const context=await browser.newContext({viewport:device==='desktop'?{width:1280,height:800}:{width:390,height:844},isMobile:device==='phone',hasTouch:device==='phone'});
 await context.addInitScript(()=>{localStorage.setItem('ppw_designer_coach_v1','1');window.__olbQA={first:null,loadingHidden:null,frames:[],long:[],gl:[]};
 new PerformanceObserver(list=>{for(const e of list.getEntries())window.__olbQA.long.push({start:e.startTime,duration:e.duration});}).observe({type:'longtask',buffered:true});
 for(const name of ['compileShader','linkProgram']){const original=WebGL2RenderingContext.prototype[name];WebGL2RenderingContext.prototype[name]=function(...args){const start=performance.now();const result=original.apply(this,args);window.__olbQA.gl.push({name,start,duration:performance.now()-start});return result;};}
 new MutationObserver(records=>{for(const r of records){if(r.attributeName==='data-shading'&&r.target.matches('[data-testid="wallpaint-3d-gl"]')){const now=performance.now();window.__olbQA.first??=now;window.__olbQA.frames.push(now);}for(const n of r.removedNodes??[])if(n.nodeType===1&&(n.matches('[data-testid="loading-3d"]')||n.querySelector('[data-testid="loading-3d"]')))window.__olbQA.loadingHidden??=performance.now();}}).observe(document,{subtree:true,childList:true,attributes:true,attributeFilter:['data-shading']});});
 const page=await context.newPage();page.setDefaultTimeout(90000);page.on('pageerror',e=>row.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')row.errors.push(m.text());});page.on('response',r=>{if(r.status()>=400)row.failed.push({url:r.url(),status:r.status()});});
 await page.route('**/*',async route=>{if(!['GET','HEAD','OPTIONS'].includes(route.request().method())){row.writes.push(route.request().method());await route.abort();}else await route.continue();});
 const start=Date.now();await page.goto(`${base}/demo?view=3d&pitch=1`,{waitUntil:'domcontentloaded'});row.dclMs=Date.now()-start;
 const gl=page.getByTestId('wallpaint-3d-gl'),stage=page.getByTestId('wallpaint-3d-canvas');await gl.waitFor();await page.getByTestId('loading-3d').waitFor({state:'hidden'});row.firstPictureMs=Date.now()-start;
 row.timings=await page.evaluate(()=>({...window.__olbQA,resources:performance.getEntriesByType('resource').map(e=>({name:e.name,start:e.startTime,duration:e.duration,size:e.transferSize})),marks:performance.getEntriesByType('mark').map(e=>({name:e.name,start:e.startTime}))}));delete row.timings.frames;
 await page.screenshot({path:`${out}/${device}-${run}-first.png`});
 if(await gl.getAttribute('data-detail'))await page.waitForFunction(()=>document.querySelector('[data-testid="wallpaint-3d-gl"]')?.getAttribute('data-detail')==='full');
 row.fullPictureMs=Number(await gl.getAttribute('data-full-picture-ms'))||null;row.targetMs=device==='desktop'?3000:5000;row.meetsLoadTarget=row.firstPictureMs<row.targetMs;
 await page.waitForTimeout(5000);row.attrs=await gl.evaluate(e=>Object.fromEntries([...e.attributes].filter(a=>a.name.startsWith('data-')).map(a=>[a.name,a.value])));
 row.camera=await stage.getAttribute('data-camera');row.renderCamera=await stage.getAttribute('data-render-camera');row.canvas=await stage.boundingBox();
 row.renderer=await gl.evaluate(c=>{const g=c.getContext('webgl2'),e=g.getExtension('WEBGL_debug_renderer_info');return e?g.getParameter(e.UNMASKED_RENDERER_WEBGL):g.getParameter(g.RENDERER);});
 await page.screenshot({path:`${out}/${device}-${run}-settled.png`});
 if(device==='desktop'&&run===1&&!phase.includes('diagnostic')){row.orbit=[];for(const choice of ['auto','high']){
  if(choice==='high'){await page.getByTestId('house-view-settings').click();await page.getByLabel('3D rendering quality').selectOption('high');await page.getByRole('button',{name:'Close view settings',exact:true}).click();}
  const b=await stage.boundingBox(),x=b.x+b.width*.5,y=b.y+b.height*.12;await page.mouse.move(x,y);await page.mouse.down({button:'right'});
  let t=Date.now();while(Date.now()-t<4000){const p=(Date.now()-t)/1000;await page.mouse.move(x+Math.sin(p)*70,y+Math.cos(p)*12);}
  const from=await page.evaluate(()=>{window.__olbQA.frames=[];return performance.now();});t=Date.now();while(Date.now()-t<10000){const p=(Date.now()-t)/1000;await page.mouse.move(x+Math.sin(p)*70,y+Math.cos(p)*12);}
  const to=await page.evaluate(()=>performance.now());await page.mouse.up({button:'right'});const frames=(await page.evaluate(()=>window.__olbQA.frames)).filter(n=>n>=from&&n<=to),intervals=frames.slice(1).map((n,i)=>n-frames[i]).sort((a,b)=>a-b);
  row.orbit.push({choice,fps:frames.length*1000/(to-from),frames:frames.length,p95Ms:intervals[Math.floor(intervals.length*.95)],attrs:await gl.evaluate(e=>Object.fromEntries([...e.attributes].filter(a=>a.name.startsWith('data-')).map(a=>[a.name,a.value])))});
 }}
 row.overflow=await page.evaluate(()=>Math.max(0,document.documentElement.scrollWidth-innerWidth));row.passed=row.errors.length===0&&row.writes.length===0&&row.failed.length===0;
 }catch(e){row.failure=String(e.stack??e);}finally{await browser.close();writeFileSync(`${out}/report.json`,JSON.stringify(report,null,2));console.log(JSON.stringify({device,run,first:row.firstPictureMs,firstRender:row.timings?.first,orbit:row.orbit,errors:row.errors,failure:row.failure}));}
}
if(report.runs.some(r=>!r.passed))process.exitCode=1;
