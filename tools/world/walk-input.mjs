import {launch,newCtx,watch,save,TARGETS,OUT,wait3d,health} from './lib.mjs';
const target=process.argv[2]||'walk';
const expected=process.argv.find(argument=>argument.startsWith('--expected='))?.slice(11);
if(!/^[a-f0-9]{40}$/.test(expected??''))throw Error('Pass --expected=<exact published SHA>.');
const report={startedAt:new Date().toISOString(),harnessVersion:3,postReadySettlingMs:0,viewSwitchSettlingMs:0,target,url:TARGETS[target],expected,healthBefore:await health(target),method:'Fresh Chromium per viewport, D3D11, no throttling. Action timestamps are DOM click event timestamps; visible chooser uses next animation-frame paint opportunity with all four PNGs decoded. Input end is first changed-position render submission, not photon latency. Keyboard samples retain native keyboard event time. Phone additionally uses native CDP touchStart on the one-thumb pad, with its pointer event time captured independently of the runtime handler timestamp. Round2 removes Round1’s explicit1000ms ready wait and400ms view-switch wait. These stricter first-use samples do not replace previous evidence. No runtime movement tuning was made for these measurements.',rows:[]};
save(`walk-performance-${target}.json`,report);
if(report.healthBefore.status!==200||report.healthBefore.body.commit!==expected)throw Error('Unexpected deployed head; no browser launched.');
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
  row.readyObservedAt=await page.evaluate(()=>performance.now());row.input=[];row.touchInput=[];
  const touchCdp=device==='phone'?await context.newCDPSession(page):null;
  if(touchCdp)await page.evaluate(()=>document.addEventListener('pointerdown',event=>{if(window.__measureTouch&&event.pointerType==='touch'&&event.target.closest('.world-walk-stick'))window.__touchPointerAt=event.timeStamp;},true));
  for(const mode of ['third','first']){
   if(mode==='first'){await page.getByRole('button',{name:'First person',exact:true}).click();}
   for(let n=0;n<5;n++){
    const key=n%2?'KeyS':'KeyW';
    await page.locator('[data-world-walk] canvas').evaluate(canvas=>{window.__inputResult=null;canvas.addEventListener('world-walk-input-result',e=>{window.__inputResult=e.detail;},{once:true});canvas.dispatchEvent(new CustomEvent('world-walk-measure-input'));});
    await page.keyboard.down(key);
    await page.waitForFunction(()=>window.__inputResult,{},{timeout:3000});
    const result=await page.evaluate(()=>window.__inputResult);row.input.push({mode,n,key,...result,delayMs:result.firstMovedRenderedAt-result.inputAt});
    await page.keyboard.up(key);await page.waitForTimeout(150);
   }
   if(touchCdp)for(let n=0;n<5;n++){
    const box=await page.locator('.world-walk-stick').boundingBox();if(!box)throw Error('Touch pad has no visible bounds');
    await page.locator('[data-world-walk] canvas').evaluate(canvas=>{window.__inputResult=null;window.__touchPointerAt=null;window.__measureTouch=true;canvas.addEventListener('world-walk-input-result',e=>{window.__inputResult=e.detail;},{once:true});canvas.dispatchEvent(new CustomEvent('world-walk-measure-input'));});
    await touchCdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:box.x+box.width/2,y:box.y+box.height/2+(n%2?30:-30),id:1}]});
    try{
     await page.waitForFunction(()=>window.__inputResult&&window.__touchPointerAt!==null,{},{timeout:3000});
     const result=await page.evaluate(()=>({pointerInputAt:window.__touchPointerAt,...window.__inputResult}));
     row.touchInput.push({mode,n,...result,delayMs:result.firstMovedRenderedAt-result.pointerInputAt,handlerDelayMs:result.firstMovedRenderedAt-result.inputAt});
    }finally{await touchCdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await page.evaluate(()=>{window.__measureTouch=false;});}
    await page.waitForTimeout(150);
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
report.healthAfter=await health(target);report.healthStable=report.healthBefore.body.commit===report.healthAfter.body.commit;report.endedAt=new Date().toISOString();save(`walk-performance-${target}.json`,report);
if(!report.healthStable)throw Error('Deployment changed during input campaign; all rows retained.');
