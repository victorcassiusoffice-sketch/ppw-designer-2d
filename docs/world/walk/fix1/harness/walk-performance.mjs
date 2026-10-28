import {launch,newCtx,watch,save,TARGETS,OUT,wait3d} from './lib.mjs';
const target=process.argv[2]||'walk';
const report={startedAt:new Date().toISOString(),target,url:TARGETS[target],method:'Fresh Chromium per viewport, D3D11, no throttling. Action timestamps are DOM click event timestamps; visible chooser uses next animation-frame paint opportunity with all four PNGs decoded. Input end is first changed-position render submission, not photon latency. No runtime movement tuning was made for these measurements.',rows:[]};
for(const device of ['desktop','phone']){
 const browser=await launch(),{context,log}=await newCtx(browser,device),page=await context.newPage();page.setDefaultTimeout(60000);
 const row={device};report.rows.push(row);watch(page,row);
 try{
  await page.goto(TARGETS[target]+'/demo?view=3d&pitch=1',{waitUntil:'domcontentloaded'});await wait3d(page);
  await page.getByRole('button',{name:'Open Walk mode',exact:true}).waitFor();
  await page.evaluate(()=>{
   window.__chooserMeasure={};
   document.addEventListener('click',e=>{if(e.target.closest('button[aria-label="Open Walk mode"]')){
    const s=window.__chooserMeasure;s.actionAt=e.timeStamp;
    const tick=()=>{const el=document.querySelector('[data-testid="walk-chooser"]'),imgs=el?[...el.querySelectorAll('img')]:[];
     if(el&&el.getBoundingClientRect().width>0&&imgs.length===4&&imgs.every(i=>i.complete&&i.naturalWidth>0)){
      requestAnimationFrame(()=>{s.visibleAt=performance.now();s.images=imgs.map(i=>({src:i.getAttribute('src').slice(0,60),width:i.naturalWidth,height:i.naturalHeight,bytes:i.src.startsWith('data:')?Math.floor((i.src.split(',')[1].length)*3/4):null}));});
     }else requestAnimationFrame(tick);
    };requestAnimationFrame(tick);
   }},true);
  });
  const t0=Date.now();await page.getByRole('button',{name:'Open Walk mode',exact:true}).click({noWaitAfter:true});await page.getByTestId('walk-chooser').waitFor();
  row.chooserWallClockMs=Date.now()-t0;await page.waitForFunction(()=>window.__chooserMeasure.visibleAt);row.chooserCallToDecodedFrameMs=Date.now()-t0;
  row.chooser=await page.evaluate(()=>window.__chooserMeasure);row.chooserMs=row.chooser.visibleAt-row.chooser.actionAt;
  row.preStartResources=await page.evaluate(()=>performance.getEntriesByType('resource').map(r=>({url:r.name,start:r.startTime,end:r.responseEnd})));
  await page.screenshot({path:OUT+`${target}-${device}-chooser.jpg`,type:'jpeg',quality:78});
  await page.getByRole('button',{name:'Start walk',exact:true}).click({noWaitAfter:true});
  row.progressSeen=await page.locator('[data-testid="world-walk"]').innerText();
  await page.waitForFunction(()=>document.querySelector('[data-world-walk]')?.getAttribute('data-status'));
  row.entry=JSON.parse(await page.getByTestId('world-walk').getAttribute('data-status'));
  await page.waitForTimeout(1000);row.input=[];
  for(const mode of ['third','first']){
   if(mode==='first'){await page.getByRole('button',{name:'First person',exact:true}).click();await page.waitForTimeout(400);}
   for(let n=0;n<5;n++){
    const key=n%2?'KeyS':'KeyW';
    await page.locator('[data-world-walk] canvas').evaluate(canvas=>{window.__inputResult=null;canvas.addEventListener('world-walk-input-result',e=>{window.__inputResult=e.detail;},{once:true});canvas.dispatchEvent(new CustomEvent('world-walk-measure-input'));});
    await page.keyboard.down(key);
    await page.waitForFunction(()=>window.__inputResult,{},{timeout:3000});
    const result=await page.evaluate(()=>window.__inputResult);row.input.push({mode,n,key,...result,delayMs:result.firstMovedRenderedAt-result.inputAt});
    await page.keyboard.up(key);await page.waitForTimeout(150);
   }
  }
  row.network=await page.evaluate(()=>performance.getEntriesByType('resource').map(r=>({url:r.name,start:r.startTime,end:r.responseEnd,bytes:r.transferSize})));
  if(device==='desktop'){
   await page.locator('.world-walk-look').click({position:{x:650,y:400}});await page.waitForFunction(()=>!!document.pointerLockElement);
   row.lockedHint=await page.getByText('Esc frees the mouse',{exact:false}).count();await page.keyboard.press('Escape');await page.waitForTimeout(350);
   row.firstEscape={unlocked:await page.evaluate(()=>!document.pointerLockElement),inWalk:await page.getByTestId('world-walk').isVisible()};
   await page.keyboard.press('Escape');await page.getByTestId('world-walk').waitFor({state:'hidden'});row.secondEscapeExits=true;
  }else await page.getByRole('button',{name:/Exit walk/}).click();
 }catch(e){row.fatal=String(e).slice(0,800);await page.screenshot({path:OUT+`${target}-${device}-failure.jpg`,type:'jpeg',quality:65}).catch(()=>{});}
 row.blockedWrites=log.blockedWrites;await context.close();await browser.close();save(`walk-performance-${target}.json`,report);
 console.log(JSON.stringify({device,chooserMs:row.chooserMs,chooserWallClockMs:row.chooserWallClockMs,input:row.input?.map(x=>({mode:x.mode,ms:x.delayMs})),escape:row.firstEscape,fatal:row.fatal}));
}
