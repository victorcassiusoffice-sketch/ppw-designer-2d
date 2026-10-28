// Fix1: same Vercel host path is the gate. Custom-domain pairs are information.
// Each target in every interleaved run uses a NEW browser process and context.
import { launch,newCtx,watch,save,TARGETS,wait3d } from './lib.mjs';
const branch=process.argv[2]||'walk',runs=Number(process.argv[3]||5);
const report={startedAt:new Date().toISOString(),branch,runs,base:TARGETS.base,baseCommit:'3eefbf7646f2b5c76e5297f7836e6e0336e8f1a2',method:'Native D3D11; no CPU/network throttling; fresh browser/profile per row; base, preview, custom-domain interleaved; all hosts pinned to216.198.79.3. Primary original harness wall-clock to loading hidden; exact first rendered canvas mark also retained. Phone is 390×844 touch emulation, not hardware.',rows:[]};
for(let run=1;run<=runs;run++)for(const device of ['desktop','phone'])for(const target of ['base',branch,'prod']){
 const browser=await launch(),{context,log}=await newCtx(browser,device),page=await context.newPage();
 page.setDefaultTimeout(90000);
 const row={run,device,target,url:TARGETS[target],startedAt:new Date().toISOString()};report.rows.push(row);watch(page,row);
 const cdp=await context.newCDPSession(page),requests=new Map();await cdp.send('Network.enable');
 cdp.on('Network.requestWillBeSent',e=>requests.set(e.requestId,{url:e.request.url,method:e.request.method,type:e.type,startEpoch:e.wallTime*1000,initiatorType:e.initiator.type}));
 cdp.on('Network.responseReceived',e=>{const r=requests.get(e.requestId);if(r){r.status=e.response.status;r.mime=e.response.mimeType;r.diskCache=e.response.fromDiskCache;}});
 cdp.on('Network.loadingFinished',e=>{const r=requests.get(e.requestId);if(r)r.encodedBytes=e.encodedDataLength;});
 await context.addInitScript(()=>{
  window.__fixLoad={loadingSeen:null,loadingHidden:null,longTasks:[]};
  try{new PerformanceObserver(list=>{for(const e of list.getEntries())window.__fixLoad.longTasks.push({start:e.startTime,duration:e.duration});}).observe({type:'longtask',buffered:true});}catch{}
  const poll=setInterval(()=>{const el=document.querySelector('[data-testid="loading-3d"]'),s=window.__fixLoad;
   if(el&&el.getBoundingClientRect().width>0&&s.loadingSeen===null)s.loadingSeen=performance.now();
   if(s.loadingSeen!==null&&!el&&s.loadingHidden===null){s.loadingHidden=performance.now();clearInterval(poll);}
  },30);
 });
 try{
  const t0=Date.now();const response=await page.goto(TARGETS[target]+'/demo?view=3d&pitch=1',{waitUntil:'domcontentloaded'});row.status=response?.status();row.dclMs=Date.now()-t0;
  await page.getByTestId('wallpaint-3d-gl').waitFor();row.glMountedMs=Date.now()-t0;
  await page.getByTestId('loading-3d').waitFor({state:'hidden'});row.first3dMs=Date.now()-t0;await wait3d(page);
  row.canvasFirstPictureMs=Number(await page.getByTestId('wallpaint-3d-gl').getAttribute('data-first-picture-ms'));
  await page.waitForTimeout(2500);
  Object.assign(row,await page.evaluate(()=>({timeOrigin:performance.timeOrigin,timeline:window.__fixLoad,nav:performance.getEntriesByType('navigation')[0].toJSON(),resources:performance.getEntriesByType('resource').map(r=>({url:r.name,start:r.startTime,end:r.responseEnd,transferBytes:r.transferSize,decodedBytes:r.decodedBodySize,encodedBytes:r.encodedBodySize,initiator:r.initiatorType}))})));
  row.requests=[...requests.values()].map(r=>({...r,startMs:r.startEpoch-row.timeOrigin,beforePicture:r.startEpoch-row.timeOrigin<=row.canvasFirstPictureMs}));
 }catch(e){row.fatal=String(e).slice(0,700);}
 row.blockedWrites=log.blockedWrites;row.endedAt=new Date().toISOString();
 await context.close();await browser.close();save(`load-${branch}.json`,report);
 console.log(JSON.stringify({target,device,run,first3dMs:row.first3dMs,canvasMs:row.canvasFirstPictureMs,longTasks:row.timeline?.longTasks.filter(t=>t.start<=row.canvasFirstPictureMs).length,errors:row.pageErrors.length,fatal:row.fatal}));
}
report.endedAt=new Date().toISOString();save(`load-${branch}.json`,report);
