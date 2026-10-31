import {createHash} from 'node:crypto';
import {launch,newCtx,watch,save,TARGETS,OUT,wait3d,health} from './lib.mjs';
const target=process.argv[2]||'walk';
const expected=process.argv.find(argument=>argument.startsWith('--expected='))?.slice(11);
if(!/^[a-f0-9]{40}$/.test(expected??''))throw Error('Pass --expected=<exact published SHA>.');
const report={startedAt:new Date().toISOString(),harnessVersion:2,target,expected,healthBefore:await health(target),method:'Production preview; native keyboard/mouse/touch only, no DEV pose fixture. Non-null exact persisted-property hash and editing/rendered camera JSON before and after. Five pointer-lock Escape cycles. Desktop-only corrected navigation experiment: one native pointer-lock session with observed movementX, no repeated drag/click/unlock cycles. Door approach uses observed movement feedback and actual look/movement controls, then E/open/wait/click-or-tap-close in both views. Network writes blocked and counted; no saved design fixture injected.',rows:[]};
const assert=(value,message)=>{if(!value)throw Error(message);};
const distance=(a,b)=>Math.hypot(a[0]-b[0],a[2]-b[2]);
const norm=a=>Math.atan2(Math.sin(a),Math.cos(a));
save(`walk-functional-${target}.json`,report);
if(report.healthBefore.status!==200||report.healthBefore.body.commit!==expected)throw Error('Unexpected deployed head; no browser launched.');
for(const device of ['desktop']){
 const browser=await launch(),{context,log}=await newCtx(browser,device),page=await context.newPage(),cdp=await context.newCDPSession(page);
 page.setDefaultTimeout(30000);
 const row={device,checks:[],door:[],escape:[],navigation:[]};report.rows.push(row);watch(page,row);
 const status=async()=>JSON.parse(await page.getByTestId('world-walk').getAttribute('data-status'));
 const capture=async()=>{
  const value=await page.evaluate(()=>({saved:localStorage.getItem('ppw_property_v2'),camera:document.querySelector('[data-testid="wallpaint-3d-canvas"]')?.getAttribute('data-camera'),rendered:document.querySelector('[data-testid="wallpaint-3d-canvas"]')?.getAttribute('data-render-camera')}));
  assert(typeof value.saved==='string'&&value.saved.length>20,'Persisted property must be non-null');
  const saved=JSON.parse(value.saved);assert(saved.state?.property?.rooms?.length>0,'Persisted property must contain rooms');
  assert(value.camera&&value.camera!=='null'&&Object.keys(JSON.parse(value.camera)).length>0,'Editing camera must be non-null');
  assert(value.rendered&&value.rendered!=='null','Rendered camera must be non-null');
  return{savedSha256:createHash('sha256').update(value.saved).digest('hex'),savedBytes:Buffer.byteLength(value.saved),cameraJson:value.camera,renderedCameraJson:value.rendered};
 };
 const compare=async()=>{const after=await capture();const unchanged=Object.keys(row.before).every(k=>row.before[k]===after[k]);assert(unchanged,'Walk changed saved property or editing/rendered camera');return{after,unchanged};};
 const start=async()=>{await page.getByRole('button',{name:'Open Walk mode',exact:true}).click();await page.getByRole('button',{name:'Start walk',exact:true}).click();await page.waitForFunction(()=>document.querySelector('[data-world-walk]')?.getAttribute('data-status'));await page.waitForTimeout(500);};
 const exit=async()=>{if(await page.getByTestId('world-walk').isVisible()){await page.getByRole('button',{name:'Exit walk',exact:true}).click();await page.getByTestId('world-walk').waitFor({state:'hidden'});}await page.waitForTimeout(300);};
 const check=async(name,fn)=>{const item={name};row.checks.push(item);try{item.evidence=await fn();item.passed=true;}catch(error){item.failure=String(error).slice(0,1200);await page.screenshot({path:OUT+`${target}-${device}-${name}-failure.jpg`,type:'jpeg',quality:60}).catch(()=>{});}save(`walk-functional-${target}.json`,report);};
 try{
  await context.addInitScript(()=>{window.__escapeTrace=[];for(const type of ['keydown','keyup'])window.addEventListener(type,event=>{if(event.code==='Escape')window.__escapeTrace.push({type,at:performance.now(),locked:!!document.pointerLockElement,repeat:event.repeat});},true);document.addEventListener('pointerlockchange',()=>window.__escapeTrace.push({type:'pointerlockchange',at:performance.now(),locked:!!document.pointerLockElement}));});
  await page.goto(TARGETS[target]+'/demo?view=3d&pitch=1',{waitUntil:'domcontentloaded'});await wait3d(page);await page.waitForTimeout(500);row.before=await capture();
  await start();row.initial=await status();
  await check('movement-restore',async()=>{
   if(device==='desktop'){await page.keyboard.down('KeyW');await page.waitForTimeout(650);await page.keyboard.up('KeyW');}
   else{const pad=await page.locator('.world-walk-stick').boundingBox();assert(pad,'Missing touch pad');await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:pad.x+pad.width/2,y:pad.y+pad.height/2-32,id:0}]});await page.waitForTimeout(650);await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});}
   await page.waitForTimeout(250);const moved=await status();assert(distance(row.initial.position,moved.position)>.25,'Native input must physically move walker');
   await page.waitForTimeout(350);const stopped=await status();assert(distance(moved.position,stopped.position)<.025,'Movement must stop after input release');
   for(const key of ['Delete','Backspace','Control+z'])await page.keyboard.press(key);
   await exit();return{initial:row.initial.position,moved:moved.position,stopped:stopped.position,...await compare()};
  });
  await exit();await start();
  await check('doors-both-views',async()=>{
   let heading;
   const probeHeading=async()=>{const before=await status();await page.keyboard.down('KeyW');await page.waitForTimeout(140);await page.keyboard.up('KeyW');await page.waitForTimeout(220);const after=await status();assert(distance(before.position,after.position)>.025,'Heading probe blocked');heading=Math.atan2(before.position[0]-after.position[0],before.position[2]-after.position[2]);row.navigation.push({kind:'heading-probe',before:before.position,after:after.position,heading});};
   let mouseX=640;
   const turn=async(desired)=>{
    for(let attempt=0;attempt<20;attempt++){
     const difference=norm(desired-heading);if(Math.abs(difference)<.012)break;
     const part=-difference/.0016;
     await page.evaluate(()=>{window.__lockedMovement=[];});
     mouseX+=part;await page.mouse.move(mouseX,400,{steps:4});await page.waitForTimeout(100);
     const events=await page.evaluate(()=>window.__lockedMovement);const actual=events.reduce((sum,e)=>sum+e.dx,0);
     row.navigation.push({kind:'locked-turn',desired,heading,commandPx:part,actualPx:actual,events});
     assert(Math.abs(actual)>.01,'Native pointer-lock movement was not delivered');heading=norm(heading-actual*.0016);
    }
    assert(Math.abs(norm(desired-heading))<.02,'Native turn did not attain target heading');await page.waitForTimeout(250);
   };
   await probeHeading();
   await page.evaluate(()=>{window.__lockedMovement=[];document.addEventListener('mousemove',e=>{if(document.pointerLockElement)window.__lockedMovement.push({at:performance.now(),dx:e.movementX,dy:e.movementY});},true);});
   await page.mouse.move(640,400);await page.mouse.click(640,400);await page.waitForFunction(()=>!!document.pointerLockElement);
   const destination=[2.4,3.1];
   for(let step=0;step<8;step++){const s=await status(),d=Math.hypot(destination[0]-s.position[0],destination[1]-s.position[2]);if(d<.2)break;await turn(Math.atan2(s.position[0]-destination[0],s.position[2]-destination[1]));const before=await status();await page.keyboard.down('KeyW');await page.waitForTimeout(Math.min(650,Math.max(80,(d-.1)/1.45*1000)));await page.keyboard.up('KeyW');await page.waitForTimeout(220);const after=await status();row.navigation.push({kind:'approach',step,before:before.position,after:after.position});assert(distance(before.position,after.position)>.025,'Door approach blocked by actual geometry');}
   const stand=await status();assert(Math.hypot(stand.position[0]-2.4,stand.position[2]-3.1)<.4,'Door approach did not reach intended safe standing area');await turn(Math.atan2(stand.position[0]-2.4,stand.position[2]-4.5));await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.pointerLockElement);await page.waitForTimeout(300);row.doorStand=await status();
   for(const mode of ['third','first']){
    if(mode==='first')await page.getByRole('button',{name:'First person',exact:true}).click();
    await page.getByRole('button',{name:/^Open door/}).waitFor();const evidence={mode,before:await status()};row.door.push(evidence);
    await page.keyboard.press('KeyE');await page.getByRole('button',{name:/^Close door/}).waitFor();await page.waitForTimeout(1300);
    evidence.afterSwing=await status();evidence.retainedClosePrompt=await page.getByRole('button',{name:/^Close door/}).isVisible();assert(evidence.retainedClosePrompt&&!evidence.afterSwing.blocked,'Close prompt did not remain available safely');
    await page.screenshot({path:OUT+`${target}-${device}-${mode}-door-open.jpg`,type:'jpeg',quality:65});
    const close=page.getByRole('button',{name:/^Close door/});if(device==='phone')await close.tap();else await close.click();await page.getByRole('button',{name:/^Open door/}).waitFor();await page.waitForTimeout(1100);evidence.closed=await status();assert(evidence.closed.door==='Open door'&&!evidence.closed.blocked,'Door failed to close safely');evidence.passed=true;
   }
   await exit();return{door:row.door,...await compare()};
  });
  await exit();
  if(device==='desktop')await check('five-escape-cycles',async()=>{
   for(const delay of [0,80,300,0,80]){await start();await page.locator('.world-walk-look').click({position:{x:640,y:400}});await page.waitForFunction(()=>!!document.pointerLockElement);const evidence={delay};row.escape.push(evidence);await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.pointerLockElement);evidence.firstEscapeStays=await page.getByTestId('world-walk').isVisible();assert(evidence.firstEscapeStays,'First Escape exited instead of unlocking');if(delay)await page.waitForTimeout(delay);await page.keyboard.press('Escape');await page.getByTestId('world-walk').waitFor({state:'hidden'});evidence.secondEscapeExits=true;await page.waitForTimeout(300);Object.assign(evidence,await compare());}
   return{cycles:row.escape.length,allPass:row.escape.every(e=>e.firstEscapeStays&&e.secondEscapeExits&&e.unchanged)};
  });
  else await check('phone-exit',async()=>{await start();await page.getByRole('button',{name:'Exit walk',exact:true}).tap();await page.getByTestId('world-walk').waitFor({state:'hidden'});await page.waitForTimeout(300);return await compare();});
  row.escapeTrace=await page.evaluate(()=>window.__escapeTrace);row.final=await capture();
 }catch(error){row.fatal=String(error).slice(0,1500);}
 finally{row.blockedWrites=log.blockedWrites;row.passed=!row.fatal&&row.checks.length>=3&&row.checks.every(c=>c.passed)&&!row.pageErrors.length&&!row.consoleErrors.length&&!row.httpErrors.length&&!row.blockedWrites.length;await context.close();await browser.close();row.browserClosed=true;save(`walk-functional-${target}.json`,report);console.log(JSON.stringify({device,passed:row.passed,checks:row.checks.map(c=>({name:c.name,pass:c.passed,failure:c.failure})),fatal:row.fatal}));}
}
report.healthAfter=await health(target);report.healthStable=report.healthBefore.body.commit===report.healthAfter.body.commit;report.endedAt=new Date().toISOString();report.passed=report.healthStable&&report.rows.every(r=>r.passed);save(`walk-functional-${target}.json`,report);if(!report.passed)process.exitCode=1;
