import { launch, newCtx, watch, save, TARGETS, OUT } from './lib.mjs';
import { mkdirSync } from 'node:fs';
const target = process.argv[2] || 'walk', devices=(process.argv[3]||'desktop,phone').split(',');
const report={at:new Date().toISOString(),target,url:TARGETS[target],note:'Fresh Chromium per viewport, native D3D11, no CPU/network throttle. Phone is desktop touch emulation390×844, not physical hardware. Movement sample excludes entry; runtime fps is up to1800 recent active-frame intervals after first10 frames, 1% low =1000/mean slowest1% intervals.',rows:[]};
mkdirSync(OUT,{recursive:true});
for(const device of devices){
 const browser=await launch(),{context,log}=await newCtx(browser,device),page=await context.newPage();
 page.setDefaultTimeout(60000);const row={device};report.rows.push(row);watch(page,row);
 try{
  await page.goto(TARGETS[target]+'/demo?view=3d&pitch=1',{waitUntil:'domcontentloaded'});
  await page.getByTestId('wallpaint-3d-gl').waitFor();await page.getByTestId('loading-3d').waitFor({state:'hidden'});
  row.beforeWalkResources=await page.evaluate(()=>performance.getEntriesByType('resource').map(r=>({url:r.name,start:r.startTime,end:r.responseEnd,bytes:r.transferSize})));
  row.before=await page.evaluate(()=>({saved:localStorage.getItem('ppw_property_v2'),camera:document.querySelector('[data-testid="wallpaint-3d-canvas"]')?.getAttribute('data-camera')}));
  const t0=Date.now();await page.getByRole('button',{name:'Open Walk mode'}).click({noWaitAfter:true});await page.getByTestId('walk-chooser').waitFor();row.chooserMs=Date.now()-t0;
  await page.screenshot({path:OUT+`/${target}-${device}-chooser.jpg`,type:'jpeg',quality:78});
  await page.getByRole('button',{name:'Start walk',exact:true}).click({noWaitAfter:true});await page.waitForFunction(()=>document.querySelector('[data-world-walk]')?.getAttribute('data-status'));
  row.entry=JSON.parse(await page.getByTestId('world-walk').getAttribute('data-status'));
  row.renderer=await page.locator('[data-world-walk] canvas').evaluate(e=>{const g=e.getContext('webgl2')||e.getContext('webgl');const x=g?.getExtension('WEBGL_debug_renderer_info');return {renderer:x?g.getParameter(x.UNMASKED_RENDERER_WEBGL):null,width:e.width,height:e.height}});
  await page.waitForTimeout(2500);
  row.samples=[];
  for(let i=0;i<12;i++){
   const key=i%2?'KeyS':'KeyW';if(i>=6)await page.keyboard.down('Shift');
   const before=await page.getByTestId('world-walk').getAttribute('data-status');
   await page.keyboard.down(key);await page.waitForTimeout(1000);
   if([0,6].includes(i))await page.screenshot({path:OUT+`/${target}-${device}-${i?'run':'walk'}.jpg`,type:'jpeg',quality:78});
   await page.keyboard.up(key);await page.keyboard.up('Shift');
   row.samples.push({before:JSON.parse(before),after:JSON.parse(await page.getByTestId('world-walk').getAttribute('data-status'))});
   await page.waitForTimeout(150);
  }
  row.settled=JSON.parse(await page.getByTestId('world-walk').getAttribute('data-status'));
  await page.getByRole('button',{name:'First person',exact:true}).click({noWaitAfter:true});await page.waitForTimeout(400);
  await page.screenshot({path:OUT+`/${target}-${device}-first.jpg`,type:'jpeg',quality:78});
  row.network=await page.evaluate(()=>performance.getEntriesByType('resource').map(r=>({url:r.name,start:r.startTime,end:r.responseEnd,bytes:r.transferSize})));
  row.text=await page.getByTestId('world-walk').innerText();
  await page.getByRole('button',{name:/Exit walk/}).click({noWaitAfter:true});await page.getByTestId('world-walk').waitFor({state:'hidden'});
  row.after=await page.evaluate(()=>({saved:localStorage.getItem('ppw_property_v2'),camera:document.querySelector('[data-testid="wallpaint-3d-canvas"]')?.getAttribute('data-camera')}));
  row.unchanged=JSON.stringify(row.before)===JSON.stringify(row.after);delete row.before;delete row.after;
  row.meetingLinks=await page.locator('a[href*="calendly"]').evaluateAll(es=>es.map(e=>e.href));
 }catch(e){row.fatal=String(e).slice(0,600);await page.screenshot({path:OUT+`/${target}-${device}-failure.jpg`,type:'jpeg',quality:65}).catch(()=>{});}
 row.blockedWrites=log.blockedWrites;
 await context.close();await browser.close();save(`${target}-performance.json`,report);
 console.log(JSON.stringify({device,chooserMs:row.chooserMs,entryMs:row.entry?.entryMs,settled:row.settled,unchanged:row.unchanged,errors:row.pageErrors,fatal:row.fatal}));
}
