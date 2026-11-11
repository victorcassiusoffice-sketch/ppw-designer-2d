// Exercise the standalone application, two isolated clients, its real HTTP API and database.
// Only use a loopback pilot. The generated invitation never goes to a log or screenshot.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {chromium} from '@playwright/test';
const origin=process.argv[2],out=process.argv[3];
if(!origin||!['127.0.0.1','localhost'].includes(new URL(origin).hostname)||!out)throw Error('Supply a local shared build address and a report path.');
const browser=await chromium.launch({args:['--use-angle=d3d11','--ignore-gpu-blocklist']});
const errors=[],checks={};
try {
 async function open(width){
  const context=await browser.newContext({viewport:{width,height:width<600?844:800},hasTouch:width<600});
  const page=await context.newPage();page.setDefaultTimeout(20000);
  await page.addInitScript(()=>localStorage.setItem('ppw_designer_coach_v1','1'));
  page.on('pageerror',e=>errors.push(e.message));await page.goto(origin+'/demo?view=3d&pitch=1');
  await page.locator('.world-walk-dock').getByRole('button',{name:'Shared build',exact:true}).click({timeout:50000});
  return page;
 }
 const host=await open(1280),guest=await open(390);
 const panel=p=>p.getByTestId('shared-build-panel');
 await panel(host).getByRole('button',{name:'Host this build',exact:true}).click();
 await panel(host).getByLabel('Build access code').waitFor();
 await host.waitForFunction(()=>document.querySelector('[data-testid="shared-build-panel"] input[readonly]')?.value?.length>40);
 const code=await panel(host).getByLabel('Build access code').inputValue();
 await panel(guest).getByLabel('Job').selectOption('Electrical');await panel(guest).getByLabel('Character').selectOption('nadia');
 await panel(guest).getByLabel('Build access code').fill(code);
 await panel(guest).getByRole('button',{name:'Join build',exact:true}).click();
 // A page switch can remount the dock; verify membership from the host too.
 await panel(host).getByText(/Electrical.*Nadia/i).waitFor({timeout:30000});checks.invitedTwoClients=true;
 for(const p of [host,guest]){const close=p.getByRole('button',{name:'Close shared build panel'});if(await close.isVisible())await close.click()}
 async function draw(p,name,x){
  await p.locator('.world-walk-dock').getByTestId('open-component-tools').click();
  const ui=p.getByTestId('boundary-editor');await ui.getByRole('button',{name:'XYZ coordinates'}).click();
  await ui.getByLabel('Name',{exact:true}).fill(name);
  for(const vertex of [[x,0,0],[x+1,0,0],[x+1,1,0]]){
   for(const [index,axis] of Array.from('XYZ').entries())await ui.getByLabel(axis+' metres',{exact:true}).fill(String(vertex[index]));
   await ui.getByRole('button',{name:'Add vertex',exact:true}).click();
  }
  await ui.getByRole('button',{name:'Close loop'}).click();await ui.getByText('Face added',{exact:true}).waitFor();
  await ui.getByRole('button',{name:'Close component editor'}).click();
 }
 await Promise.all([draw(host,'West measured face',1),draw(guest,'East measured face',4)]);
 const both=p=>p.waitForFunction(()=>{const cs=JSON.parse(localStorage.getItem('ppw_property_v2')).state.property.boundaryComponents||[];return ['West measured face','East measured face'].every(n=>cs.some(c=>c.name===n))},undefined,{timeout:25000});
 await Promise.all([both(host),both(guest)]);checks.concurrentIndependentGeometry=true;
 for(const page of [host,guest]){
  await page.getByRole('button',{name:'Open Walk mode',exact:true}).click();
  await page.getByRole('button',{name:'Start walk',exact:true}).click();
  await page.waitForFunction(()=>{const s=document.querySelector('[data-world-walk]')?.dataset.status;return s&&JSON.parse(s).grounded},undefined,{timeout:50000});
  assert.equal(await page.locator('canvas[data-testid="wallpaint-3d-gl"]').count(),1);
 }
 await Promise.all([host,guest].map(p=>p.waitForFunction(()=>Number(document.querySelector('canvas[data-shared-players]')?.dataset.sharedPlayers)>0,undefined,{timeout:35000})));
 checks.bothAvatarsOnOneScenePerClient=true;
 await host.getByRole('button',{name:'Dig / fill',exact:true}).click();
 const soil=host.getByTestId('earthworks-panel');
 await soil.getByRole('button',{name:'Cell coordinates'}).click();
 const cell=await host.evaluate(()=>{
   const property=JSON.parse(localStorage.getItem('ppw_property_v2')).state.property;
   const points=property.rooms.flatMap(r=>r.polygon);
   return property.site ? {x:Math.ceil(property.site.originM.x),y:Math.ceil(property.site.originM.y)}
     : {x:Math.floor(Math.min(0,...points.map(p=>p.x)))-2,y:Math.floor(Math.min(0,...points.map(p=>p.y)))-2};
 });
 await soil.getByLabel('X (m)',{exact:true}).fill(String(cell.x));
 await soil.getByLabel('Y (m)',{exact:true}).fill(String(cell.y));
 await soil.getByRole('button',{name:'Dig cell',exact:true}).click();
 for(const p of [host,guest])await p.waitForFunction(({x,y})=>JSON.parse(localStorage.getItem('ppw_property_v2')).state.property.terrainCuts?.some(c=>c.x===x&&c.y===y&&c.depthM===.25),cell,{timeout:20000});
 await soil.getByRole('button',{name:'Fill',exact:true}).click();
 await soil.getByRole('button',{name:'Fill cell',exact:true}).click();
 for(const p of [host,guest])await p.waitForFunction(({x,y})=>!JSON.parse(localStorage.getItem('ppw_property_v2')).state.property.terrainCuts?.some(c=>c.x===x&&c.y===y),cell,{timeout:20000});
 await soil.getByRole('button',{name:'Close earthworks',exact:true}).click();
 checks.digAndFillShared=true;
 await host.keyboard.down('w');await host.waitForTimeout(600);await host.keyboard.up('w');
 await host.getByRole('button',{name:'Build from here',exact:true}).click();await host.getByTestId('walk-build-return').waitFor();
 assert.equal(await host.locator('canvas[data-testid="wallpaint-3d-gl"]').count(),1);
 await host.getByRole('button',{name:'Resume walking',exact:true}).click();await host.getByRole('button',{name:'Build from here',exact:true}).waitFor();checks.sameRendererDuringBuild=true;
 await guest.reload({waitUntil:'domcontentloaded'});await both(guest);
 await guest.locator('.world-walk-dock').getByRole('button',{name:'Shared build',exact:true}).click();await panel(guest).getByRole('button',{name:'Leave shared build',exact:true}).waitFor({timeout:30000});checks.reloadReconnect=true;
 await panel(guest).getByRole('button',{name:'Leave shared build',exact:true}).click();await panel(guest).getByRole('button',{name:'Join build',exact:true}).waitFor();checks.leave=true;
 assert.deepEqual(errors,[]);
} catch(e){checks.error=String(e.message).slice(0,450);process.exitCode=1}
finally{await browser.close();await fs.writeFile(out,JSON.stringify({checks,errors},null,2));console.log(JSON.stringify({checks,errors}))}
