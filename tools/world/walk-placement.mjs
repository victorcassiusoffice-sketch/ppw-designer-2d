// Prove real pointer drops against a local production build made with VITE_TEST_HOOKS=1.
import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
const base = process.env.PPW_E2E_BASE_URL;
if (!base || !['localhost', '127.0.0.1'].includes(new URL(base).hostname)) throw Error('Set PPW_E2E_BASE_URL to the local Designer build.');
const out = path.resolve(process.argv[2] || 'test-results/walk-placement');
await fs.mkdir(out, { recursive: true });
const poly = [{ x: 0,y: 0 },{ x: 6,y: 0 },{ x: 6,y: 6 },{ x: 0,y: 6 }];
const rooms = [{ id:'lower',name:'Ground',polygon:poly,placedItems:[],openings:[] },
  { id:'upper',levelId:'first',name:'Upper',polygon:poly,placedItems:[],openings:[] }];
const property = { id:'walk-qa',name:'Walk check',wallHeightM:3,activeRoomId:'lower',
  levels:[{ id:'ground',name:'Ground floor',index:0 },{ id:'first',name:'First floor',index:1 }],rooms,
  site:{originM:{x:-4,y:-4},widthM:14,depthM:14} };
const cases = [
  ['ground','ground',2.5,2.5,0], ['upper','first',3,2,3.18],
  ['roof','roof',3,3,6.48], ['garden','ground',-1.3,2,0], ['bare-land','ground',1,1,0],
];
const browser = await chromium.launch({args:['--use-angle=d3d11','--ignore-gpu-blocklist']});
const report=[];
try {
 for(const brand of ['ppw','olb']) for(const [width,height] of [[1280,800],[390,844],[313,567]]) {
  const context=await browser.newContext({viewport:{width,height},hasTouch:width<600});
  await context.route('**/*',async route=>{
    const req=route.request();
    if(!['GET','HEAD'].includes(req.method()))return route.abort();
    if(brand==='olb' && req.resourceType()==='document' && new URL(req.url()).pathname==='/demo'){
      const shell=await route.fetch({url:base+'/olb.html'});
      return route.fulfill({response:shell});
    }
    return route.continue();
  });
  const page=await context.newPage();
  const errors=[];
  const touch=width<600 ? await context.newCDPSession(page) : null;
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
  page.setDefaultTimeout(15000);
  await page.goto(base+'/demo?view=3d&pitch=1',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.__designer?.readProperty && document.querySelector('[data-testid="place-walker"]'),undefined,{timeout:60000});
  assert.equal(await page.evaluate(()=>document.documentElement.dataset.brand || 'ppw'),brand);
  await page.evaluate(p=>window.__designer.loadPropertyFixture(p),property);
  for(const [name,level,x,y,elevation] of cases){
   const row={brand,width,name,level};report.push(row);
   try {
    if(name==='bare-land')await page.evaluate(p=>window.__designer.loadPropertyFixture({...p,rooms:[],activeRoomId:''}),property);
    const token=page.getByTestId('place-walker');
    await token.waitFor();await token.click();
    await page.locator('.world-placement-options select').selectOption(level);
    const before=await page.evaluate(()=>JSON.stringify(window.__designer.readProperty()));
    if(name==='bare-land')assert.equal(JSON.parse(before).rooms.filter(room=>room.polygon?.length>=3).length,0);
    const target=await token.evaluate((el,pt)=>{let result;el.dispatchEvent(new CustomEvent('world-walk-project',{detail:{...pt,reply:p=>{result=p}}}));return result}, {x,y,height:elevation});
    const b=await token.boundingBox();
    assert.ok(b && target,'Projection available');
    const start={x:b.x+b.width/2,y:b.y+b.height/2};
    if(touch){
      await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[start]});
      for(let n=1;n<=9;n++)await touch.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:start.x+(target.x-start.x)*n/9,y:start.y+(target.y-start.y)*n/9}]});
    }else{
      await page.mouse.move(start.x,start.y);await page.mouse.down();await page.mouse.move(target.x,target.y,{steps:9});
    }
    await page.locator('.world-placement-ring[data-valid="true"]').waitFor();
    if(touch)await touch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});else await page.mouse.up();
    await page.waitForFunction(()=>JSON.parse(document.querySelector('[data-world-walk]')?.dataset.status || '{}').grounded===true,undefined,{timeout:60000});
    const status=await page.getByTestId('world-walk').evaluate(el=>JSON.parse(el.dataset.status));
    row.position=status.position;row.grounded=status.grounded;row.actualLevel=status.levelId;
    assert.equal(status.levelId,level);
    assert.ok(Math.hypot(status.position[0]-x,status.position[2]-y)<.45,'drop reached the indicated point');
    assert.ok(Math.abs(status.position[1]-elevation)<.20,'correct standing height');
    if(name==='upper'){await page.getByTestId('walk-overview').click();await page.waitForFunction(()=>JSON.parse(document.querySelector('[data-world-walk]').dataset.status).overview)}
    if(name==='garden'){await page.getByRole('combobox',{name:'Walk level'}).selectOption('first');await page.waitForFunction(()=>JSON.parse(document.querySelector('[data-world-walk]').dataset.status).levelId==='first')}
    if(name==='bare-land'){
      await page.getByTestId('walk-overview').click();
      await page.waitForFunction(()=>JSON.parse(document.querySelector('[data-world-walk]').dataset.status).overview);
      const point=await page.locator('[data-world-walk] canvas').first().evaluate(el=>{let result;el.dispatchEvent(new CustomEvent('world-walk-project',{detail:{x:2.4,y:1,height:0,reply:p=>{result=p}}}));return result});
      assert.ok(point,'The walk camera projects the target');
      if(touch)await page.touchscreen.tap(point.x,point.y);else await page.mouse.click(point.x,point.y);
      await page.waitForFunction(()=>{const s=JSON.parse(document.querySelector('[data-world-walk]').dataset.status);return Math.hypot(s.position[0]-2.4,s.position[2]-1)<.22},undefined,{timeout:12000});
      row.tapToWalk=true;
    }
    await page.screenshot({path:path.join(out,brand+'-'+width+'-'+name+'.jpg'),type:'jpeg',quality:68});
    await page.locator('.world-walk-exit').click();
    assert.equal(await page.evaluate(()=>JSON.stringify(window.__designer.readProperty())),before);
    if(name==='bare-land'){
      await page.getByRole('button',{name:'Open Walk mode'}).click();
      await page.getByRole('button',{name:'Start walk'}).click();
      await page.waitForFunction(()=>JSON.parse(document.querySelector('[data-world-walk]')?.dataset.status || '{}').grounded===true,undefined,{timeout:60000});
      await page.locator('.world-walk-exit').click();
      assert.equal(await page.evaluate(()=>JSON.stringify(window.__designer.readProperty())),before);
      row.bareLandLauncher=true;
    }
    row.designUnchanged=true;
   }catch(e){row.error=e.message.split('\n')[0];if(touch)await touch.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]}).catch(()=>{});else await page.mouse.up().catch(()=>{});await page.screenshot({path:path.join(out,brand+'-'+width+'-'+name+'-failure.jpg'),type:'jpeg'}).catch(()=>{});
    const exit=page.locator('.world-walk-exit');if(await exit.isVisible())await exit.click();else await page.keyboard.press('Escape');
   }
   row.errors=[...errors];await fs.writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(row));
  }
  await context.close();
 }
}finally{await browser.close()}
if(report.some(row=>row.error || row.errors.length || !row.designUnchanged))process.exitCode=1;
