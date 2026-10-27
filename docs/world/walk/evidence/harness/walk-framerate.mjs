import {launch,newCtx,watch,save,TARGETS} from './lib.mjs';
const report={at:new Date().toISOString(),target:'walk',codeHead:'4e8f5c5f3e246416f16464c8bbfd003f2561f687',method:'Additional frame-pacing run without screenshots. Retains original instrumented run separately. Fresh Chromium per viewport, Intel Iris Xe D3D11, no CPU/network throttle. After entry wait 3 seconds, alternate W/S once per second for 40 seconds, with Shift during the last 20 seconds. Final runtime window contains up to 1800 recent active frame intervals; average fps and reciprocal mean of worst 1% intervals. Phone is desktop touch emulation, not hardware.',rows:[]};
for(const device of ['desktop','phone']){
 const browser=await launch(),{context,log}=await newCtx(browser,device),page=await context.newPage(),row={device};report.rows.push(row);watch(page,row);page.setDefaultTimeout(90000);
 try{
  await page.goto(TARGETS.walk+'/demo?view=3d&pitch=1',{waitUntil:'domcontentloaded'});
  await page.getByTestId('wallpaint-3d-gl').waitFor();await page.getByTestId('loading-3d').waitFor({state:'hidden'});
  await page.getByRole('button',{name:'Open Walk mode'}).click({noWaitAfter:true});await page.getByTestId('walk-chooser').waitFor();
  await page.getByRole('button',{name:'Start walk',exact:true}).click({noWaitAfter:true});await page.waitForFunction(()=>document.querySelector('[data-world-walk]')?.getAttribute('data-status'));
  await page.waitForTimeout(3000);row.samples=[];
  for(let n=0;n<40;n++){const key=n%2?'KeyS':'KeyW';if(n===20)await page.keyboard.down('Shift');await page.keyboard.down(key);await page.waitForTimeout(1000);await page.keyboard.up(key);if(n%10===9)row.samples.push(JSON.parse(await page.getByTestId('world-walk').getAttribute('data-status')));}
  await page.keyboard.up('Shift');row.final=row.samples.at(-1);
  await page.getByRole('button',{name:/Exit walk/}).click({noWaitAfter:true});
 }catch(e){row.fatal=String(e);}
 row.blockedWrites=log.blockedWrites;await context.close();await browser.close();save('walk-framerate-clean.json',report);console.log(JSON.stringify({device,final:row.final,fatal:row.fatal,pageErrors:row.pageErrors}));
}

