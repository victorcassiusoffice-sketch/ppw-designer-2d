import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium, expect } from '@playwright/test';
import sharp from 'sharp';

const origin = 'http://127.0.0.1:5173';
const out = resolve('docs/canvas-usability-2026-11-10');
mkdirSync(out,{recursive:true});
const browser = await chromium.launch({args:['--use-angle=d3d11','--enable-gpu','--ignore-gpu-blocklist']});
const notes = [];
const colors = {ivory:'#94aab5',ocean:'#253b4c',slate:'#343c50'};
const emptySigns = '.house-empty,[data-testid="start-room-prompt"],[data-lessons-quest="offer"]';
const rgb = hex => hex.slice(1).match(/../g).map(c=>parseInt(c,16));
const colorString = hex => 'rgb('+rgb(hex).join(', ')+')';
const polygon = [{x:0,y:0},{x:6,y:0},{x:6,y:4},{x:0,y:4}];
async function run(width) {
  const context=await browser.newContext({viewport:{width,height:width===390?844:800},isMobile:width===390,hasTouch:width===390,deviceScaleFactor:1,serviceWorkers:'block'});
  const page=await context.newPage();
  const errors=[], writes=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',e=>{if(e.type()==='error')errors.push(e.text())});
  await context.route('**/*',r=>{
    const u=new URL(r.request().url());
    if(!['GET','HEAD','OPTIONS'].includes(r.request().method())){writes.push(u.pathname);return r.abort()}
    if(u.pathname.startsWith('/api/') && u.origin===origin)return r.fulfill({json:{}});
    if(u.host==='api.exchangerate.host')return r.fulfill({headers:{'access-control-allow-origin':'*'},json:{success:false,rates:{}}});
    return r.continue();
  });
  await page.addInitScript(({origin,polygon})=>{
    if(location.origin!==origin)return;
    if(!localStorage.getItem('olb.ui-preferences.v1')) localStorage.setItem('olb.ui-preferences.v1',JSON.stringify({locale:'en',theme:'ivory'}));
    if(!localStorage.getItem('ppw_property_v2')) localStorage.setItem('ppw_property_v2',JSON.stringify({version:2,state:{
      property:{id:'surface-qa',name:'Drawing board',activeRoomId:'room',rooms:[{id:'room',name:'Ground room',polygon,placedItems:[]}]},pxPerMetre:100,showGrid:true
    }}));
  },{origin,polygon});
  async function theme(value) {
    await page.evaluate(value=>{
      const key='olb.ui-preferences.v1',newValue=JSON.stringify({locale:'en',theme:value});
      localStorage.setItem(key,newValue);
      window.dispatchEvent(new StorageEvent('storage',{key,newValue,storageArea:localStorage}));
    },value);
    await expect(page.locator('html')).toHaveAttribute('data-ui-theme',value);
    await expect.poll(()=>page.evaluate(()=>getComputedStyle(document.documentElement).getPropertyValue('--designer-canvas').trim())).toBe(colors[value]);
  }
  async function clearCentre(target) {
    await expect(page.locator(emptySigns)).toHaveCount(0);
    await expect(page.getByText('Your room is empty',{exact:true})).toHaveCount(0);
    const hit=await target.evaluate(el=>{
      const r=el.getBoundingClientRect(), at=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);
      return {tag:at?.tagName,blocked:!!at?.closest('dialog[open],button,aside,[data-lessons-quest="offer"]'),overflow:document.documentElement.scrollWidth-innerWidth};
    });
    assert.equal(hit.blocked,false,JSON.stringify(hit));assert.ok(hit.overflow<=1,JSON.stringify(hit));
    return hit.tag;
  }
  async function shot(name) {
    await page.screenshot({path:resolve(out,name+'-'+width+'.png'),animations:'disabled'});
  }
  try {
    await page.goto(origin+'/designer?demo=off');
    const plan=page.getByTestId('plan-drawing-viewport');
    await expect(plan.locator('canvas').first()).toBeVisible();
    await page.waitForLoadState('networkidle');
    await page.evaluate(()=>document.fonts.ready);
    const transform=await plan.getAttribute('data-view-transform');
    for(const tone of ['ivory','ocean','slate']){
      await theme(tone);await expect(plan).toHaveCSS('background-color',colorString(colors[tone]));
      assert.equal(await plan.getAttribute('data-view-transform'),transform);
      notes.push({width,view:'unfurnished plan',tone,centre:await clearCentre(plan)});
      if(tone===(width===390?'slate':'ivory'))await shot('plan');
    }
    await page.goto(origin+'/demo?view=3d&pitch=1');
    const house=page.getByTestId('wallpaint-3d-canvas'), gl=page.locator('[data-testid="wallpaint-3d-gl"][data-first-picture-ms]');
    await expect(gl).toBeVisible();await expect(page.getByTestId('loading-3d')).toHaveCount(0);
    const camera=await house.getAttribute('data-camera');

    for(const tone of ['ivory','ocean','slate']){
      await theme(tone);
      await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
      assert.equal(await house.getAttribute('data-camera'),camera);
      // Inspect rendered pixels outside the physical plot, including any postprocessing.
      let sampled=[];
      await expect.poll(async()=>{
        const {data,info}=await sharp(await gl.screenshot()).removeAlpha().raw().toBuffer({resolveWithObject:true});
        sampled=[.12,.5,.88].map(frac=>{
          const pos=(Math.floor(info.height*.07)*info.width+Math.floor(info.width*frac))*3;
          return [...data.subarray(pos,pos+3)];
        });
        return Math.max(...sampled.flatMap(pixel=>pixel.map((c,i)=>Math.abs(c-rgb(colors[tone])[i]))));
      }).toBeLessThanOrEqual(3);
      notes.push({width,view:'public WebGL',tone,sampledRgb:sampled,centre:await clearCentre(house)});
      if(tone===(width===390?'ocean':'ivory'))await shot('house');
    }
    await page.goto(origin+'/designer?panel=city&demo=off');
    const city=page.locator('.city-workspace');
    const cityPlan=city.getByTestId('city-plan');
    await expect(cityPlan).toBeVisible();await expect(city.locator('.city-map-caption')).toHaveCount(0);
    const preferences=city.locator('.locale-theme-controls');
    await preferences.locator('summary').click();
    const oceanChoice=preferences.getByRole('button',{name:'Deep ocean'});
    await expect(oceanChoice.locator('.theme-skin-card__sample')).toHaveCSS('background-color',colorString(colors.ocean));
    await expect(preferences.getByLabel('Build backdrop').locator('option:checked')).toHaveText('Match colour theme');
    await oceanChoice.click();
    await preferences.getByRole('button',{name:'Close preferences'}).click();
    await expect(page.locator('html')).toHaveAttribute('data-ui-theme','ocean');
    await expect(city.locator('.city-viewport')).toHaveCSS('background-color',colorString(colors.ocean));
    await shot('city-plan');
    await city.getByRole('button',{name:'3D',exact:true}).click();
    const canvas=city.getByTestId('city-three-view').locator('canvas');
    await expect(canvas).toBeVisible();
    for(const tone of ['ocean','ivory']){
      await theme(tone);
      await expect.poll(async()=>{
        const {data}=await sharp(await canvas.screenshot()).extract({left:2,top:2,width:1,height:1}).removeAlpha().raw().toBuffer({resolveWithObject:true});
        return Math.max(...rgb(colors[tone]).map((n,i)=>Math.abs(n-data[i])));
      }).toBeLessThan(4);
      notes.push({width,view:'city WebGL',tone,centre:await clearCentre(canvas)});
    }
    await shot('city-house');
    // Start an untouched project without a closed room. Offered coaching stays at the edge.
    await page.evaluate(()=>{localStorage.removeItem('ppw_property_v2')});
    await page.addInitScript(({origin})=>{
      if(location.origin!==origin)return;
      localStorage.setItem('ppw_property_v2',JSON.stringify({version:2,state:{property:{id:'blank',name:'Blank site',activeRoomId:'r',rooms:[{id:'r',name:'Ground',polygon:[],placedItems:[]}]},pxPerMetre:100,showGrid:true}}));
    },{origin});
    await page.goto(origin+'/designer?demo=off');
    await expect(plan).toBeVisible();await expect(plan.locator('canvas').first()).toBeVisible();
    notes.push({width,view:'blank plan',centre:await clearCentre(plan)});
    await shot('blank-plan');
    assert.deepEqual(errors,[]);assert.deepEqual(writes,[]);
    notes.push({width,consoleAndPageErrors:errors.length,writes:writes.length});
  } finally {await context.close()}
}
try {
  for(const width of (process.argv[2]||'1280,390').split(',').map(Number)) await run(width);
} finally {
  writeFileSync(resolve(out,'browser-results.json'),JSON.stringify(notes,null,2)+'\n');
  await browser.close();
}
