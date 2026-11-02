// Untimed, bounded, native UI diagnostic. No application/style mutations.
import fs from 'node:fs/promises';
import path from 'node:path';
import { TARGETS, OUTPUT, PIN_IP, acquireRun } from './run-config.mjs';
import { chromium } from './lib.mjs';
const expectedSha = process.argv.find(x=>x.startsWith('--expected='))?.slice(11);
if (!/^[a-f0-9]{40}$/.test(expectedSha || '')) throw Error('Full --expected SHA required');
await fs.mkdir(OUTPUT,{recursive:false}); acquireRun('site-phone-visual-diagnostic');
const origin=TARGETS.site;
const result={expectedSha,origin,note:'Untimed phone viewport diagnostic. Two fresh sessions; native touch UI, no style/layout overrides. Explicit font/frame/wait milestones are recorded for screenshot diagnosis only. All non-GET/HEAD/OPTIONS requests blocked. Earlier failed captures remain authoritative evidence.',rows:[]};
const browser=await chromium.launch({headless:true,args:['--host-resolver-rules=MAP '+new URL(origin).hostname+' '+PIN_IP]});
const must=(x,m)=>{if(!x)throw Error(m);};
async function session(name){
 const row={case:name,attemptedWrites:[],blockedWrites:[],pageErrors:[],consoleErrors:[],httpErrors:[],captures:[]};result.rows.push(row);
 const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,serviceWorkers:'block'});
 context.on('request',r=>{if(!['GET','HEAD','OPTIONS'].includes(r.method()))row.attemptedWrites.push({method:r.method(),url:r.url()});});
 await context.route('**/*',async route=>{const r=route.request();if(!['GET','HEAD','OPTIONS'].includes(r.method())){row.blockedWrites.push({method:r.method(),url:r.url()});return route.abort('blockedbyclient');}return route.continue();});
 await context.addInitScript(()=>localStorage.setItem('ppw_designer_coach_v1','1'));
 const page=await context.newPage();
 page.on('pageerror',e=>row.pageErrors.push(String(e)));
 page.on('console',m=>{if(m.type()==='error')row.consoleErrors.push(m.text());});
 page.on('response',r=>{if(r.status()>=400)row.httpErrors.push({url:r.url(),status:r.status()});});
 return{row,context,page};
}
async function health(page){const r=await page.goto(origin+'/api/healthcheck');const h=await r.json();must(h.env==='preview'&&h.commit===expectedSha,'Exact head mismatch');return h;}
async function tap(l){await l.scrollIntoViewIfNeeded();await l.tap();}
async function frames(page){await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));}
async function capture(page,row,label,selector){
 const detail=await page.evaluate(selector=>{
  const el=document.querySelector(selector),rect=e=>{const r=e.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height};};
  const chain=[];for(let n=el;n&&chain.length<8;n=n.parentElement){const s=getComputedStyle(n);chain.push({tag:n.tagName,class:n.className,rect:rect(n),display:s.display,visibility:s.visibility,opacity:s.opacity,color:s.color,background:s.backgroundColor,overflow:s.overflow,transform:s.transform,clipPath:s.clipPath,position:s.position,zIndex:s.zIndex});}
  return{at:performance.now(),fonts:document.fonts.status,text:el?.textContent,chain,links:el?[...el.querySelectorAll('a')].map(a=>({text:a.textContent,rect:rect(a),color:getComputedStyle(a).color,hit:document.elementFromPoint(a.getBoundingClientRect().x+2,a.getBoundingClientRect().y+2)?.outerHTML.slice(0,250)})):[],transform:document.querySelector('[data-testid="plan-drawing-viewport"]')?.getAttribute('data-view-transform'),toolsExpanded:document.querySelector('[data-testid="canvas-chrome-toggle"]')?.getAttribute('aria-expanded')};
 },selector);
 const file=label+'.jpg';await page.screenshot({path:path.join(OUTPUT,file),type:'jpeg',quality:85});
 row.captures.push({file,...detail});
}
try{
 {
 const {row,context,page}=await session('phone-live-credit-paint');
 try{
  row.healthBefore=await health(page);
  await page.goto(origin+'/demo?view=2d&pitch=1&site=1&live=1',{waitUntil:'domcontentloaded',timeout:60000});
  await tap(page.getByRole('button',{name:'Site from the map',exact:true}));
  await page.locator('.maplibregl-canvas').waitFor({timeout:30000});
  await page.waitForTimeout(2500);
  await page.getByRole('textbox',{name:'Find a place',exact:true}).fill('Tamarin Mauritius');
  await tap(page.getByRole('button',{name:'Search',exact:true}));
  await page.locator('.site-search-results button').first().waitFor({timeout:20000});
  await tap(page.locator('.site-search-results button').first());await page.waitForTimeout(700);
  await page.locator('.site-map-shell').scrollIntoViewIfNeeded();
  const b=await page.locator('.site-map').boundingBox();
  for(const[x,y]of[[.35,.35],[.65,.35],[.65,.65],[.35,.65]])await page.touchscreen.tap(b.x+b.width*x,b.y+b.height*y);
  await tap(page.getByRole('button',{name:'Close & check boundary',exact:true}));
  await page.locator('.site-map-shell').scrollIntoViewIfNeeded();
  await capture(page,row,'credit-immediate','.site-attribution');
  await page.evaluate(()=>document.fonts.ready);await frames(page);
  await capture(page,row,'credit-fonts-two-frames','.site-attribution');
  await page.waitForTimeout(500);await capture(page,row,'credit-500ms','.site-attribution');
  await page.waitForTimeout(1000);await capture(page,row,'credit-1500ms','.site-attribution');
  // Native touch drag scrolls the containing report, then standard visible-element
  // scrolling returns the map. No computed styles or application state are changed.
  const cdp=await context.newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:365,y:650}]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:365,y:450}]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await page.locator('.site-map-shell').scrollIntoViewIfNeeded();await frames(page);
  await capture(page,row,'credit-after-native-scroll','.site-attribution');
  row.mapErrors=await page.locator('.site-map-error').allTextContents();
  row.healthAfter=await health(page);row.completed=true;
 }catch(e){row.error=String(e);}finally{await context.close();}
 }
 {
 const {row,context,page}=await session('phone-plan-disclosure-paint');
 try{
  row.healthBefore=await health(page);await page.goto(origin+'/demo?view=2d&pitch=1&site=1',{waitUntil:'domcontentloaded',timeout:60000});
  await tap(page.getByRole('button',{name:'Site from the map',exact:true}));await page.locator('.site-workspace').waitFor();
  await page.getByRole('textbox',{name:'Site name',exact:true}).fill('SITE-R3-CONCAVE');
  await tap(page.getByRole('button',{name:'From the surveyor’s plan',exact:true}));
  await page.getByRole('textbox',{name:'First corner: longitude, latitude',exact:true}).fill('57.3776792, -20.3292161');
  await page.getByRole('textbox',{name:'Each line: length in metres, bearing',exact:true}).fill('10,90\n4,180\n6,270\n6,180\n4,270\n10,0');
  await page.getByRole('spinbutton',{name:'Anchor x (m)',exact:true}).fill('50');
  await page.getByRole('spinbutton',{name:'Anchor y (m)',exact:true}).fill('50');
  await tap(page.getByRole('button',{name:'Close traverse & check',exact:true}));
  await tap(page.getByRole('button',{name:'Apply site to plan',exact:true}));
  await tap(page.getByRole('button',{name:'Close Site',exact:true}));
  await tap(page.getByTestId('canvas-chrome-toggle'));
  await page.getByTestId('plot-capacity').filter({hasText:'Plot 64 m²'}).waitFor();
  const fit=page.getByRole('button',{name:'Fit to view',exact:true});row.fitVisible=await fit.isVisible();if(row.fitVisible)await tap(fit);
  await page.evaluate(()=>document.fonts.ready);await frames(page);await page.waitForTimeout(500);
  await capture(page,row,'plan-tools-open-settled','[data-testid="canvas-chrome-toggle"]');
  await tap(page.getByTestId('canvas-chrome-toggle'));await frames(page);await page.waitForTimeout(500);
  await capture(page,row,'plan-tools-closed-settled','[data-testid="canvas-chrome-toggle"]');
  await tap(page.getByTestId('canvas-chrome-toggle'));await frames(page);await page.waitForTimeout(500);
  await capture(page,row,'plan-tools-reopened-settled','[data-testid="canvas-chrome-toggle"]');
  row.healthAfter=await health(page);row.completed=true;
 }catch(e){row.error=String(e);}finally{await context.close();}
 }
}finally{
 await browser.close();result.processesClosed=true;
 for(const r of result.rows)r.networkWrites={attempted:r.attemptedWrites.length,blocked:r.blockedWrites.length,transmitted:r.attemptedWrites.length-r.blockedWrites.length};
 await fs.writeFile(path.join(OUTPUT,'visual-diagnostic.json'),JSON.stringify(result,null,2)+'\n');
 console.log(JSON.stringify({output:OUTPUT,rows:result.rows.map(r=>({case:r.case,completed:r.completed,error:r.error,captures:r.captures.length,writes:r.networkWrites})),processesClosed:true}));
}

