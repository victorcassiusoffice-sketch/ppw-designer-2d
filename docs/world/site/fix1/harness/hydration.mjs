import fs from 'node:fs/promises';
import { chromium } from '@playwright/test';
const origin=process.argv[2] || 'https://ppw-designer-2d-git-gpt-olb-site-map-2026-10-27-victor-ppw.vercel.app';
const expectedSha=process.argv[3] || '017e16d30e20262c37073bc47506e8431673973a';
await fs.mkdir('work/site-qa/fix1',{recursive:true});
const fixture=JSON.parse(await fs.readFile('docs/world/site/evidence/roundtrip.json','utf8')).savedSite;
const result={at:new Date().toISOString(),origin,expectedSha,note:'Fresh browser contexts. Existing fictional survey fixture seeded only into local browser demo storage; no remote write. Unknown canary field proves canonical validation completed. Resource Timing startTime and canvas firstPictureMs share the navigation performance clock.',rows:[]};
const browser=await chromium.launch({headless:true,args:[`--host-resolver-rules=MAP ${new URL(origin).hostname} 216.198.79.3`]});
try{
 const warm=await browser.newContext({viewport:{width:1440,height:1000}}),page=await warm.newPage();
 await page.addInitScript(()=>localStorage.setItem('ppw_designer_coach_v1','1'));
 const health=await page.goto(origin+'/api/healthcheck');result.healthcheck=await health.json();
 if(result.healthcheck.env!=='preview'||result.healthcheck.commit!==expectedSha)throw Error('Healthcheck mismatch');
 await page.goto(origin+'/demo?view=2d&pitch=1',{waitUntil:'networkidle',timeout:60000});
 const storage=await page.evaluate(()=>Object.fromEntries(['ppw_property_v2','ppw_properties_v2'].map(key=>[key,localStorage.getItem(key)]).filter(([,value])=>value)));
 if(!storage.ppw_property_v2||!storage.ppw_properties_v2)throw Error('Demo fixture storage not created');
 await warm.close();
 for(const saved of [false,true]){
  const seed=structuredClone(storage);
  for(const key of Object.keys(seed)){
   const object=JSON.parse(seed[key]);
   const properties=key==='ppw_property_v2'?[object.state.property]:Object.values(object.state.designs).map(d=>d.property);
   for(const property of properties){
    if(saved)property.site={...structuredClone(fixture),world:{...structuredClone(fixture.world),fix1UnknownCanary:'must disappear only after validation'}};
    else delete property.site;
   }
   seed[key]=JSON.stringify(object);
  }
  const context=await browser.newContext({viewport:{width:1440,height:1000}});
  await context.addInitScript(seed=>{for(const [key,value]of Object.entries(seed))localStorage.setItem(key,value);localStorage.setItem('ppw_designer_coach_v1','1');},seed);
  const page=await context.newPage(),row={savedWorld:saved,pageErrors:[]};result.rows.push(row);page.on('pageerror',e=>row.pageErrors.push(e.message));
  await page.goto(origin+'/demo?view=3d&pitch=1',{waitUntil:'domcontentloaded',timeout:60000});
  await page.locator('canvas[data-first-picture-ms]').waitFor({timeout:45000});
  if(saved)try{await page.waitForFunction(()=>{const world=JSON.parse(localStorage.getItem('ppw_property_v2')).state.property.site?.world;return world&&world.fix1UnknownCanary===undefined;},undefined,{timeout:8000});}catch{row.validationWaitExpired=true;}
  await page.waitForTimeout(1200);
  Object.assign(row,await page.evaluate(()=>{
   const firstPictureMs=Number(document.querySelector('canvas[data-first-picture-ms]').dataset.firstPictureMs);
   const resources=performance.getEntriesByType('resource').map(r=>({url:r.name,startMs:r.startTime,durationMs:r.duration,transferBytes:r.transferSize}));
   const implementation=resources.filter(r=>/\/(?:hydration|SiteEntry|SiteMap|maplibre-gl-worker)-/.test(r.url));
   const world=JSON.parse(localStorage.getItem('ppw_property_v2')).state.property.site?.world;
   return{firstPictureMs,implementation,beforeFirstPicture:implementation.filter(r=>r.startMs<=firstPictureMs),worldRetained:!!world,unknownCanaryAbsent:world?.fix1UnknownCanary===undefined,worldName:world?.name,worldCanary:world?.fix1UnknownCanary,siteName:JSON.parse(localStorage.getItem('ppw_property_v2')).state.property.name,siteEntryCount:document.querySelectorAll('[aria-label="Site from the map"]').length};
  }));
  row.passed=row.pageErrors.length===0&&row.beforeFirstPicture.length===0&&(saved?row.implementation.some(r=>/\/hydration-/.test(r.url))&&row.worldRetained&&row.unknownCanaryAbsent:row.implementation.length===0&&!row.worldRetained);
  await context.close();
 }
}catch(error){result.error=String(error);}finally{await browser.close();result.passed=!result.error&&result.rows.length===2&&result.rows.every(r=>r.passed);await fs.writeFile('work/site-qa/fix1/hydration-preview.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));if(!result.passed)process.exitCode=1;}



