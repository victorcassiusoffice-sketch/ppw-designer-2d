// Shared local-only harness. Nothing in the app imports this file.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { build } from 'esbuild';
import { chromium, expect } from '@playwright/test';
import assert from 'node:assert/strict';
import sharp from 'sharp';

export { chromium, expect, assert };
export const olb = 'http://127.0.0.1:5293', tf = 'http://127.0.0.1:5294';
export const output = resolve('docs/link/evidence');
export const scratch = resolve('../olb-link-scratch/browser');
mkdirSync(output, { recursive:true }); mkdirSync(scratch,{recursive:true});
const require = createRequire(import.meta.url);
export async function signing() {
  const file = resolve(scratch,'pinned-signer.cjs');
  await build({entryPoints:['src/designer/link/vendor/tradefolder/lib/jobPack/protocol.ts'],bundle:true,platform:'node',format:'cjs',outfile:file,logLevel:'silent'});
  return require(file);
}

export function measuredProperty() {
  // Same asymmetric layout can be recognized in the real editor and its file:
  // small bathroom upper left, long kitchen to the right; a spur points down.
  const rectangle = (x,y,w,h) => [{x,y},{x:x+w,y},{x:x+w,y:y+h},{x,y:y+h}];
  const room = (id,name,polygon) => ({id,name,polygon,placedItems:[]});
  return { id:'qa-build-plot12', name:'Riverview build',activeRoomId:'bath',
    rooms:[room('bath','Bathroom',rectangle(0,0,2.4,3)),room('kitchen','Kitchen',rectangle(2.4,0,3.6,3)),
      room('utility','Utility',rectangle(0,3,2.4,1.75))],
    services:{version:1,runs:[{id:'cold-inlet',levelId:'ground',system:'cold-water',materialId:'hpl-aquasafe-upvc-20',
      diameterMm:20,startElevationM:-.25,endElevationM:.45,points:[{x:.4,y:4.2,elevationM:-.25},{x:.4,y:2.1,elevationM:-.25},{x:.4,y:2.1,elevationM:.45}]}],
      fixtures:[{id:'basin',levelId:'ground',kind:'sink',x:.6,y:2.2,widthM:.6,depthM:.48,heightM:.85,rotation:0}]} };
}

export async function localContext(browser, width, seed=true) {
  const context=await browser.newContext({viewport:{width,height:width===1280?800:844},isMobile:width<500,hasTouch:width<500,
    serviceWorkers:'block',acceptDownloads:true});
  const network={errors:[],pageErrors:[],attemptedWrites:[],apiRequests:[],externalRequests:[],httpErrors:[]};
  await context.route('**/*', route=>{
    const req=route.request(), url=new URL(req.url());
    if(!['GET','HEAD','OPTIONS'].includes(req.method())) {
      network.attemptedWrites.push(req.method()+' '+url.pathname); return route.abort();
    }
    if(url.pathname.startsWith('/api/')) {
      network.apiRequests.push(url.pathname);
      // Return no external data; the optional unrelated FX request can see an
      // unavailable empty snapshot. No backend call leaves this browser.
      return route.fulfill({status:200,contentType:'application/json',body:'{}'});
    }
    if(![olb,tf].includes(url.origin)&&['https:','http:'].includes(url.protocol)) {
      network.externalRequests.push(url.origin+url.pathname);
      // The pre-existing optional FX startup GET is deliberately offline:
      // no rates, no conversion and no real network or browser abort noise.
      if(url.hostname==='api.exchangerate.host' && url.pathname==='/latest')
        return route.fulfill({status:200,contentType:'application/json',headers:{'Access-Control-Allow-Origin':'*'},body:'{"success":false,"rates":{}}'});
      return route.abort();
    }
    return route.continue();
  });
  await context.addInitScript(({seed,property,origin})=>{
    if(location.origin===origin && seed && !localStorage.getItem('ppw_property_v2')){
      localStorage.setItem('ppw_property_v2',JSON.stringify({version:2,state:{property,showGrid:true,pxPerMetre:100}}));
      localStorage.setItem('ppw_designer_coach_v1','1');
    }
  },{seed,property:measuredProperty(),origin:olb});
  const monitor=page=>{
    page.on('pageerror',e=>network.pageErrors.push(e.message));
    page.on('console',m=>{if(m.type()==='error')network.errors.push(m.text())});
    page.on('response',r=>{if(r.status()>=400)network.httpErrors.push(r.status()+' '+r.url())});
  };
  context.on('page',monitor);
  return {context,network};
}
export async function zoomText(page,width){
  if(width===360) await page.addStyleTag({content:':root{font-size:115% !important} [data-build-surface]{'+Object.entries({
    caption:12,label:14,body:16,lead:20,title:28,display:36
  }).map(([token,size])=>'--build-type-'+token+':'+(size*1.15)+'px!important').join(';')+'}'});
}
export async function readDownload(page, trigger) {
  const event=page.waitForEvent('download');await trigger();const download=await event;
  const file=await download.path();return {filename:download.suggestedFilename(),json:JSON.parse(readFileSync(file,'utf8'))};
}
export const filePayload=(json,name='answer.json')=>({name,mimeType:'application/json',buffer:Buffer.from(JSON.stringify(json),'utf8')});
export async function shot(page,name,target,gray=false) {
  const image=target?await target.screenshot({type:'png'}):await page.screenshot({type:'png'});
  let resize=sharp(image).resize({width:1280,withoutEnlargement:true});
  if(gray) resize=resize.grayscale();
  await resize.jpeg({quality:66}).toFile(resolve(output,name+'.jpg'));
}
export function saveEvidence(name,record) {
  writeFileSync(resolve(output,name+'.json'),JSON.stringify(record,null,2)+'\n');
}
export async function tfQuote(page,work,tag='') {
  await page.goto(tf+'/pro/job-pack?from=builder');
  const chooser=page.getByLabel('Choose a job pack file');await chooser.waitFor();
  await chooser.setInputFiles(filePayload(work,'plot12.olbpackage.json'));
  await expect(page.getByRole('region',{name:'File preview'})).toContainText(work.planView.package.title);
  await expect(page.getByRole('region',{name:'File preview'})).toContainText('Plan revision '+work.planView.plan.revision);
  if(tag) await shot(page,'tf-checked-work-'+tag,page.getByRole('region',{name:'File preview'}));
  await page.getByRole('button',{name:/add.*work package.*jobs/i}).click();
  await page.getByLabel('Your name or business name').fill('Example plumbing team');
  await page.getByRole('button',{name:'Enter separate pack prices'}).click();
  const rates=page.getByRole('spinbutton',{name:/Line \d+ rate/});
  if(!(await rates.count())) await page.getByRole('button',{name:'Add a line'}).click();
  const count=await rates.count();assert.ok(count>0);
  for(let i=0;i<count;i++) {
    const description=page.getByLabel('Line '+(i+1)+' description',{exact:true});
    if(await description.count() && !await description.inputValue()) await description.fill('Installation review');
    await rates.nth(i).fill(String(10+i));
  }
  await page.getByRole('button',{name:'Make the quote pack'}).click();
  const {json}=await readDownload(page,()=>page.getByRole('button',{name:'Save the quote file'}).click());
  assert.equal(json.kind,'quote');assert.equal(json.requestId,work.request.id);assert.equal(json.currency,work.request.currency);
  assert.ok(json.total>0);
  return json;
}
