import {launch,newCtx,watch,save,TARGETS,OUT,wait3d} from './lib.mjs';
const report={at:new Date().toISOString(),method:'Diagnostic repeats retained separately from original measurements. Locator uses unchanged non-forced click; native mouse uses browser mouse input at the verified launcher centre (no DOM click or force). Both record real event timestamps and render opportunities.',rows:[]};
for(const device of ['desktop','phone'])for(const input of ['locator','mouse']){
 const browser=await launch(),{context}=await newCtx(browser,device),page=await context.newPage();page.setDefaultTimeout(60000);const row={device,input};report.rows.push(row);watch(page,row);
 try{
  await context.tracing.start({snapshots:true,screenshots:false,sources:false});
  await page.goto(TARGETS.walk+'/demo?view=3d&pitch=1',{waitUntil:'domcontentloaded'});await wait3d(page);await page.getByRole('button',{name:'Open Walk mode',exact:true}).waitFor();
  await page.evaluate(()=>{
   const s=window.__chooserDiagnostic={start:performance.now(),samples:[],events:[],longTasks:[],firstPictureMs:Number(document.querySelector('[data-first-picture-ms]').getAttribute('data-first-picture-ms'))};
   new PerformanceObserver(list=>{for(const e of list.getEntries())s.longTasks.push({start:e.startTime,duration:e.duration});}).observe({type:'longtask',buffered:true});
   for(const name of ['pointerdown','pointerup','click'])document.addEventListener(name,e=>{if(e.target.closest('[aria-label="Open Walk mode"]'))s.events.push({name,at:e.timeStamp,handlerAt:performance.now()});},true);
   const tick=()=>{
    const button=document.querySelector('[aria-label="Open Walk mode"]');if(button){const r=button.getBoundingClientRect(),c=getComputedStyle(button),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);s.samples.push({at:performance.now(),x:r.x,y:r.y,w:r.width,h:r.height,hit:hit?.tagName,hitClass:hit?.className,correctHit:hit===button||button.contains(hit),inert:!!button.closest('[inert]'),disabled:button.disabled,visibility:c.visibility,pointerEvents:c.pointerEvents});}
    const chooser=document.querySelector('[data-testid="walk-chooser"]');if(chooser&&[...chooser.querySelectorAll('img')].every(i=>i.complete&&i.naturalWidth===64)){requestAnimationFrame(()=>s.visibleAt=performance.now());return;}
    if(performance.now()-s.start<60000)requestAnimationFrame(tick);
   };requestAnimationFrame(tick);
  });
  row.callStartEpoch=Date.now();
  if(input==='locator')await page.getByRole('button',{name:'Open Walk mode',exact:true}).click({noWaitAfter:true});
  else{const b=await page.getByRole('button',{name:'Open Walk mode',exact:true}).boundingBox();await page.mouse.click(b.x+b.width/2,b.y+b.height/2);}
  row.callReturnEpoch=Date.now();await page.waitForFunction(()=>window.__chooserDiagnostic.visibleAt);row.completedEpoch=Date.now();row.data=await page.evaluate(()=>window.__chooserDiagnostic);
  row.wallClockMs=row.completedEpoch-row.callStartEpoch;row.eventToVisibleMs=row.data.visibleAt-row.data.events.find(e=>e.name==='click').at;
  await context.tracing.stop({path:OUT+`chooser-${device}-${input}-trace.zip`});
 }catch(e){row.fatal=String(e);}
 await context.close();await browser.close();save('chooser-diagnostic.json',report);console.log(JSON.stringify({device,input,wallClockMs:row.wallClockMs,eventToVisibleMs:row.eventToVisibleMs,samples:row.data?.samples.length,incorrectHit:row.data?.samples.filter(s=>!s.correctHit).length,longTasks:row.data?.longTasks.filter(t=>t.start>row.data.start),fatal:row.fatal}));
}
