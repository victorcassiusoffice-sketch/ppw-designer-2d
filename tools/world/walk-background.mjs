import {createHash} from 'node:crypto';
import {launch,newCtx,watch,save,TARGETS,OUT,wait3d,health} from './lib.mjs';
const target=process.argv[2]??'walk', expected=process.argv[3];
if(!/^[a-f0-9]{40}$/.test(expected??''))throw Error('Pass target and exact expected published SHA.');
const report={at:new Date().toISOString(),target,expected,harnessVersion:1,healthBefore:await health(target),method:'Separate functional observation, never a performance replacement. Deferred launcher snapshot event returns exact original ThreeStage.debug().frames and pause ownership. One snapshot at each named phase, no per-frame observer or production polling. Verify no original frames during chooser/loading/visit and resumed frames after Exit; non-null saved design and both editing/rendered camera strings must restore exactly. All network writes blocked.',rows:[]};
if(report.healthBefore.status!==200||report.healthBefore.body.commit!==expected)throw Error('Unexpected deployed head');
const assert=(condition,message)=>{if(!condition)throw Error(message);};
save('background-ownership.json',report);
for(const device of ['desktop','phone']){
 const browser=await launch(),{context,log}=await newCtx(browser,device),page=await context.newPage();page.setDefaultTimeout(45000);
 const row={device,snapshots:[]};report.rows.push(row);watch(page,row);
 const sample=async(phase)=>{
  const value=await page.locator('button[aria-label="Open Walk mode"]').evaluate(button=>{
   let result;button.addEventListener('world-walk-background-result',event=>{result=event.detail;},{once:true});
   button.dispatchEvent(new Event('world-walk-measure-background'));return result;
  });
  assert(value&&Number.isFinite(value.frames)&&typeof value.paused==='boolean','Missing numeric background snapshot');
  row.snapshots.push({phase,...value});return value;
 };
 const capture=async()=>{
  const value=await page.evaluate(()=>({saved:localStorage.getItem('ppw_property_v2'),camera:document.querySelector('[data-testid="wallpaint-3d-canvas"]')?.getAttribute('data-camera'),rendered:document.querySelector('[data-testid="wallpaint-3d-canvas"]')?.getAttribute('data-render-camera')}));
  assert(value.saved&&JSON.parse(value.saved).state?.property?.rooms?.length,'Non-null saved design required');assert(value.camera&&value.camera!=='null'&&value.rendered&&value.rendered!=='null','Non-null cameras required');
  return{savedSha256:createHash('sha256').update(value.saved).digest('hex'),savedBytes:Buffer.byteLength(value.saved),cameraJson:value.camera,renderedCameraJson:value.rendered};
 };
 try{
  await page.goto(TARGETS[target]+'/demo?view=3d&pitch=1',{waitUntil:'domcontentloaded'});await wait3d(page);
  await page.getByRole('button',{name:'Open Walk mode',exact:true}).waitFor();row.before=await capture();
  const before=await sample('before-open');assert(!before.paused&&before.frames>0,'Original designer must have rendered and be unpaused');
  await page.getByRole('button',{name:'Open Walk mode',exact:true}).click();await page.getByTestId('walk-chooser').waitFor();
  const covered=await sample('chooser-open');assert(covered.paused,'Opening chooser must pause original designer');
  await page.waitForTimeout(750);const chooser=await sample('chooser-after-750ms');assert(chooser.paused&&chooser.frames===covered.frames,'Original designer rendered beneath chooser');
  await page.getByRole('button',{name:'Start walk',exact:true}).click();
  const loading=await sample('after-start');assert(loading.paused&&loading.frames===covered.frames,'Original designer rendered while preparing Walk');
  await page.waitForFunction(()=>document.querySelector('[data-world-walk]')?.getAttribute('data-status'));
  const ready=await sample('visit-ready');assert(ready.paused&&ready.frames===covered.frames,'Original designer rendered during Walk entry');
  await page.keyboard.down('KeyW');await page.waitForTimeout(300);await page.keyboard.up('KeyW');await page.waitForTimeout(750);
  const moving=await sample('visit-after-movement');assert(moving.paused&&moving.frames===covered.frames,'Original designer rendered beneath active Walk');
  await page.getByRole('button',{name:'Exit walk',exact:true}).click();await page.getByTestId('world-walk').waitFor({state:'hidden'});await page.waitForTimeout(750);
  const after=await sample('after-exit-750ms');assert(!after.paused&&after.frames>covered.frames,'Original designer did not resume on Exit');
  row.after=await capture();row.restored=Object.keys(row.before).every(key=>row.before[key]===row.after[key]);assert(row.restored,'Saved design or editing/rendered camera changed');row.passed=true;
 }catch(error){row.failure=String(error);await page.screenshot({path:OUT+`background-${device}-failure.jpg`,type:'jpeg',quality:65}).catch(()=>{});}
 finally{row.blockedWrites=log.blockedWrites;row.passed=!!row.passed&&!row.pageErrors.length&&!row.consoleErrors.length&&!row.httpErrors.length&&!row.blockedWrites.length;await browser.close();row.browserClosed=true;save('background-ownership.json',report);console.log(JSON.stringify(row));}
}
report.healthAfter=await health(target);report.healthStable=report.healthBefore.body.commit===report.healthAfter.body.commit;report.passed=report.healthStable&&report.rows.every(r=>r.passed);report.endedAt=new Date().toISOString();save('background-ownership.json',report);if(!report.passed)process.exitCode=1;
