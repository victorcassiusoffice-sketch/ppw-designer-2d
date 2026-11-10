// Dedicated loopback origins for the part 6 campaign. Never target another tester's servers.
import assert from 'node:assert/strict';
import {mkdirSync, writeFileSync, readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {chromium,expect} from '@playwright/test';
import sharp from 'sharp';
import {acquireRun} from '../world/run-config.mjs';
export {assert,chromium,expect,acquireRun};
export const olb='http://127.0.0.1:5311', base='http://127.0.0.1:5312', tf='http://127.0.0.1:5313';
export const evidence=resolve('docs/trades/part6-2026-11-10'), scratch=resolve('../olb-game6-scratch/browser');
mkdirSync(evidence,{recursive:true}); mkdirSync(scratch,{recursive:true});
export const save=(name,value)=>writeFileSync(resolve(evidence,name+'.json'),JSON.stringify(value,null,2)+'\n');
export const saveRaw=(name,value)=>writeFileSync(resolve(scratch,name+'.json'),JSON.stringify(value,null,2)+'\n');
export const launch=()=>chromium.launch({headless:true,args:['--use-angle=d3d11','--enable-gpu','--ignore-gpu-blocklist']});
const rect=(x,y,w,h)=>[{x,y},{x:x+w,y},{x:x+w,y:y+h},{x,y:y+h}];
export function fixture(){
  const room=(id,name,polygon)=>({id,name,polygon,placedItems:[]});
  return {id:'qa-trades-house',name:'East courtyard',activeRoomId:'bath',rooms:[
    room('bath','Bathroom',rect(0,0,2.4,3)),room('kitchen','Kitchen',rect(2.4,0,3.6,3)),room('utility','Utility',rect(0,3,2.4,1.75))
  ],services:{version:1,runs:[{id:'bath-inlet',levelId:'ground',system:'cold-water',materialId:'hpl-aquasafe-upvc-20',diameterMm:20,startElevationM:.15,endElevationM:.65,
    points:[{x:.4,y:2.7,elevationM:.15},{x:.4,y:1.8,elevationM:.15},{x:.4,y:1.8,elevationM:.65}]}],
    fixtures:[{id:'basin',levelId:'ground',kind:'sink',x:.6,y:2.2,widthM:.6,depthM:.48,heightM:.85,rotation:0},
    {id:'board',levelId:'ground',kind:'electrical-board',x:4.5,y:1.4,widthM:.45,depthM:.15,heightM:.7,rotation:0}]}};
}
export async function localContext(browser,width,{seed=false,coach=true}={}){
  const context=await browser.newContext({viewport:{width,height:width===1280?800:width===313?567:844},deviceScaleFactor:1,isMobile:width<500,hasTouch:width<500,serviceWorkers:'block',acceptDownloads:true});
  const log={consoleErrors:[],pageErrors:[],httpErrors:[],failedRequests:[],attemptedWrites:[],localApi:[],externalReads:[]};
  await context.route('**/*',route=>{
    const r=route.request(),u=new URL(r.url());
    if(!['GET','HEAD','OPTIONS'].includes(r.method())){log.attemptedWrites.push(r.method()+' '+u.pathname);return route.abort();}
    if([olb,tf,base].includes(u.origin)){
      if(u.pathname.startsWith('/api/')){log.localApi.push(u.pathname);return route.fulfill({status:200,contentType:'application/json',body:'{}'});}
      return route.continue();
    }
    if(u.protocol==='https:'||u.protocol==='http:'){
      log.externalReads.push(u.host+u.pathname);
      if(u.host==='api.exchangerate.host'&&u.pathname==='/latest')return route.fulfill({status:200,headers:{'access-control-allow-origin':'*'},contentType:'application/json',body:'{"success":false,"rates":{}}'});
      return route.abort();
    }return route.continue();
  });
  await context.addInitScript(({seed,coach,property,olb,base,width})=>{
    if(location.origin===olb||location.origin===base){
      if(coach)localStorage.setItem('ppw_designer_coach_v1','1');
      if(seed&&!localStorage.getItem('ppw_property_v2'))localStorage.setItem('ppw_property_v2',JSON.stringify({version:2,state:{property,showGrid:true,pxPerMetre:100}}));
      if(width===313){document.addEventListener('DOMContentLoaded',()=>{
        const e=document.createElement('style'); e.id='qa-text-scale';e.textContent=':root{font-size:115%!important} [data-build-surface],.build-dashboard{'+Object.entries({caption:12,label:14,body:16,lead:20,title:28,display:36}).map(([n,px])=>'--build-type-'+n+':'+(px*1.15)+'px!important').join(';')+'}';document.head.append(e);
      },{once:true});}
    }
  },{seed,coach,property:fixture(),olb,base,width});
  context.on('page',p=>{
    p.on('pageerror',e=>log.pageErrors.push(e.message));p.on('console',m=>{if(m.type()==='error')log.consoleErrors.push(m.text())});
    p.on('response',r=>{if(r.status()>=400)log.httpErrors.push({path:new URL(r.url()).pathname,status:r.status()})});
    p.on('requestfailed',r=>log.failedRequests.push({path:new URL(r.url()).pathname,message:r.failure()?.errorText}));
  });
  return {context,log};
}
export function assertClean(log){for(const k of ['consoleErrors','pageErrors','httpErrors','failedRequests','attemptedWrites'])assert.deepEqual(log[k],[],k);}
export const b=(p,name)=>p.getByRole('button',{name,exact:typeof name==='string'});
export const dlg=(p,name)=>p.getByRole('dialog',{name,exact:true});
export async function downloadJson(p,f){const pending=p.waitForEvent('download');await f();const d=await pending;return {name:d.suggestedFilename(),body:JSON.parse(readFileSync(await d.path(),'utf8'))}}
export const upload=(body,name)=>({name,mimeType:'application/json',buffer:Buffer.from(JSON.stringify(body))});
export async function capture(p,name){await p.screenshot({path:resolve(evidence,name+'.jpg'),type:'jpeg',quality:65});}
export async function smallPhoto(p){return {name:'bathroom-plan.jpg',mimeType:'image/jpeg',buffer:await sharp(await p.getByTestId('plan-drawing-viewport').screenshot()).resize({width:300,withoutEnlargement:true}).jpeg({quality:65}).toBuffer()};}
export async function physical(p,width,x,y){if(width<500)await p.touchscreen.tap(x,y);else await p.mouse.click(x,y);}
export async function inspectLayout(surface){
  const row=await surface.evaluate(el=>{
    const short=[],spill=[],controls=[];
    for(const c of el.querySelectorAll('button,input:not([type=hidden]),select,textarea,summary,a[href]')){
      const r=c.getBoundingClientRect();if(!r.width||!r.height||getComputedStyle(c).visibility==='hidden')continue;
      const hit=(r.width<48||r.height<48)?c.closest('label')?.getBoundingClientRect()??r:r;
      const label=(c.getAttribute('aria-label')||c.textContent||c.closest('label')?.textContent||c.tagName).trim().slice(0,70);
      controls.push([hit.width,hit.height]);if(hit.width<47.99||hit.height<47.99)short.push({label,w:hit.width,h:hit.height});
      if(c.tagName==='BUTTON'&&c.scrollWidth>c.clientWidth+1)spill.push(label);
    }
    return {viewport:[innerWidth,innerHeight],documentWidth:document.documentElement.scrollWidth,panelWidth:el.clientWidth,panelScroll:el.scrollWidth,controls:controls.length,minWidth:Math.min(...controls.map(c=>c[0])),minHeight:Math.min(...controls.map(c=>c[1])),short,spill};
  });
  assert.ok(row.documentWidth<=row.viewport[0]+1&&row.panelScroll<=row.panelWidth+1,'Horizontal overflow: '+JSON.stringify(row));
  assert.deepEqual(row.short,[],'undersized targets');assert.deepEqual(row.spill,[],'text outside button');return row;
}
export async function realQuote(p,work){
  await p.goto(tf+'/pro/job-pack?from=builder');await p.getByLabel('Choose a job pack file').setInputFiles(upload(work,'bathroom-wall.olbpackage.json'));
  await expect(p.getByRole('region',{name:'File preview'})).toContainText(work.planView.package.title);
  await b(p,/add.*work package.*jobs/i).click();await p.getByLabel('Your name or business name').fill('Harbour plumbing QA');
  await b(p,'Enter separate pack prices').click();
  const rates=p.getByRole('spinbutton',{name:/Line \d+ rate/});if(!(await rates.count()))await b(p,'Add a line').click();
  for(let i=0;i<await rates.count();i++){const desc=p.getByLabel('Line '+(i+1)+' description',{exact:true});if(await desc.count()&&!await desc.inputValue())await desc.fill('Check shower connection');await rates.nth(i).fill(String(12+i));}
  await b(p,'Make the quote pack').click();
  const quote=(await downloadJson(p,()=>b(p,'Save the quote file').click())).body;
  assert.equal(quote.kind,'quote');assert.equal(quote.requestId,work.request.id);assert.ok(quote.total>0);return quote;
}
