/** Read-only original/production/branch comparison, same actual projection. */
import { chromium, expect } from '@playwright/test';
import { mkdirSync, writeFileSync, copyFileSync } from 'node:fs';
const base=process.argv[2]??'http://127.0.0.1:5173';
const old='https://ppw-designer-2d-n0nhhj9si-victor-ppw.vercel.app';
const out='docs/qa-sims-fix-round-2-2026-10-25/matched-camera';mkdirSync(out,{recursive:true});
copyFileSync('C:/Users/Victor/Documents/PPW-Second-Brain/06-Roadmap/_handoff/test-evidence-2026-10-25/pr50-fix-round/t1-old-desktop-3d.png',`${out}/reviewer-t1-old-desktop-3d.png`);
const report={at:new Date().toISOString(),method:'Read-only current captures of old fcefc73, production fc0b111, branch. Actual Fit after fixed 1168×592 stage; logical and render cameras asserted equal. Reviewer original included separately, not asserted equal to this Fit projection. No performance claims from capture.',cases:[]};
const browser=await chromium.launch({headless:true,args:['--use-angle=d3d11','--enable-gpu','--ignore-gpu-blocklist',`--host-resolver-rules=MAP ${new URL(old).hostname} 216.198.79.3`]});
try{for(const [site,choice,url] of [['old','auto',old],['production','auto','https://onelivebuild.com'],['production','high','https://onelivebuild.com'],['branch','auto',base],['branch','high',base]]){
 const row={site,choice,errors:[],failed:[],writes:[]};report.cases.push(row);const context=await browser.newContext({viewport:{width:1280,height:800},deviceScaleFactor:1});
 try{
  await context.addInitScript(choice=>{localStorage.clear();localStorage.setItem('ppw_designer_coach_v1','1');localStorage.setItem('ppw_room_lighting_v1','natural');localStorage.setItem('olb-render-quality-v1',JSON.stringify({state:{choice},version:0}));},choice);
  const page=await context.newPage();page.setDefaultTimeout(90000);page.on('pageerror',e=>row.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')row.errors.push(m.text());});page.on('response',r=>{if(r.status()>=400)row.failed.push({url:r.url(),status:r.status()});});
  await page.route('**/*',async route=>{if(!['GET','HEAD','OPTIONS'].includes(route.request().method())){row.writes.push(route.request().method());await route.abort();}else await route.continue();});
  await page.goto(`${url}/demo?view=3d&pitch=1`,{waitUntil:'domcontentloaded'});
  const stage=page.getByTestId('wallpaint-3d-canvas'),gl=page.getByTestId('wallpaint-3d-gl');await gl.locator(':scope[data-shading]').waitFor();await page.getByTestId('loading-3d').waitFor({state:'hidden'});
  if(site==='branch')await expect(gl).toHaveAttribute('data-detail','full');
  await page.waitForTimeout(8000);const property=await page.evaluate(()=>localStorage.getItem('ppw_property_v2'));
  await stage.evaluate(e=>{e.style.width='1168px';e.style.height='592px';e.style.minHeight='592px';e.style.maxHeight='592px';e.style.flex='none';});await page.waitForTimeout(300);
  await page.getByTestId('wallpaint-3d-fit').click();await page.mouse.move(5,5);await page.waitForTimeout(5000);
  row.camera=JSON.parse(await stage.getAttribute('data-camera'));row.renderCamera=JSON.parse(await stage.getAttribute('data-render-camera'));row.canvas=await stage.boundingBox();row.attrs=await gl.evaluate(e=>Object.fromEntries([...e.attributes].filter(a=>a.name.startsWith('data-')).map(a=>[a.name,a.value])));
  row.geometryUnchanged=await page.evaluate(before=>before===localStorage.getItem('ppw_property_v2'),property);expect(row.geometryUnchanged).toBe(true);expect(row.writes).toEqual([]);
  await page.screenshot({path:`${out}/${site}-${choice}.png`});await gl.screenshot({path:`${out}/${site}-${choice}-canvas.png`});
  if(report.cases.length>1){const ref=report.cases[0];row.sameCamera=JSON.stringify(row.camera)===JSON.stringify(ref.camera);row.sameRenderCamera=JSON.stringify(row.renderCamera)===JSON.stringify(ref.renderCamera);row.sameCanvasDimensions=row.canvas.width===ref.canvas.width&&row.canvas.height===ref.canvas.height;expect(row.sameCamera&&row.sameRenderCamera&&row.sameCanvasDimensions).toBe(true);}
 }catch(e){row.failure=String(e.stack??e);}finally{await context.close();writeFileSync(`${out}/report.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(row));}
}}finally{await browser.close();}
if(report.cases.some(row=>row.failure||row.writes.length||row.errors.length&&row.site!=='old'))process.exitCode=1;
