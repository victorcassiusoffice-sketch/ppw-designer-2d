import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
const [base = 'https://onelivebuild.com', label = 'production', device = 'desktop'] = process.argv.slice(2);
const out = '../olb-round3-scratch'; mkdirSync(out, { recursive: true });
const browser = await chromium.launch({headless:true,args:['--use-angle=d3d11']});
try {
  const context = await browser.newContext({viewport:device==='desktop'?{width:1280,height:800}:{width:390,height:844},isMobile:device==='phone',hasTouch:device==='phone'});
  await context.addInitScript(() => {
    localStorage.setItem('ppw_designer_coach_v1','1');
    window.__profile = {long:[],loading:null,first:null};
    new PerformanceObserver(l=>{for(const e of l.getEntries())window.__profile.long.push({start:e.startTime,duration:e.duration});}).observe({type:'longtask',buffered:true});
    setInterval(()=>{const e=document.querySelector('[data-testid="loading-3d"]');if(e&&e.getBoundingClientRect().width)window.__profile.loading??=performance.now();},20);
    new MutationObserver(records=>{for(const r of records)if(r.attributeName==='data-shading')window.__profile.first??=performance.now();}).observe(document,{subtree:true,attributes:true,attributeFilter:['data-shading']});
  });
  const page=await context.newPage();page.setDefaultTimeout(90000);
  const errors=[],writes=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await context.route('**/*',r=>{if(!['GET','HEAD','OPTIONS'].includes(r.request().method())){writes.push(r.request().method());return r.abort();}return r.continue();});
  const cdp=await context.newCDPSession(page);await cdp.send('Profiler.enable');await cdp.send('Profiler.setSamplingInterval',{interval:1000});await cdp.send('Profiler.start');
  const start=Date.now();await page.goto(`${base}/demo?view=3d&pitch=1`,{waitUntil:'domcontentloaded'});await page.getByTestId('wallpaint-3d-gl').waitFor();await page.getByTestId('loading-3d').waitFor({state:'hidden'});const first=Date.now()-start;
  const {profile}=await cdp.send('Profiler.stop');writeFileSync(`${out}/${label}-${device}.cpuprofile`,JSON.stringify(profile));
  const data=await page.evaluate(()=>({...window.__profile,resources:performance.getEntriesByType('resource').map(r=>({name:r.name,type:r.initiatorType,start:r.startTime,end:r.responseEnd,bytes:r.transferSize})),italic:[...document.querySelectorAll('*')].filter(e=>getComputedStyle(e).fontStyle==='italic'&&e.getBoundingClientRect().width).slice(0,15).map(e=>({tag:e.tagName,cls:e.className,text:e.textContent?.slice(0,80)})),attrs:Object.fromEntries([...document.querySelector('[data-testid="wallpaint-3d-gl"]').attributes].filter(a=>a.name.startsWith('data-')).map(a=>[a.name,a.value]))}));
  const nodes=new Map(profile.nodes.map(n=>[n.id,n])),parents=new Map();for(const n of profile.nodes)for(const ch of n.children??[])parents.set(ch,n.id);
  const self=new Map(),inclusive=new Map();for(let i=0;i<profile.samples.length;i++){const id=profile.samples[i],ms=profile.timeDeltas[i]/1000;self.set(id,(self.get(id)??0)+ms);let at=id;while(at){inclusive.set(at,(inclusive.get(at)??0)+ms);at=parents.get(at);}}
  const top=map=>[...map].sort((a,b)=>b[1]-a[1]).slice(0,35).map(([id,ms])=>({ms:Math.round(ms),...nodes.get(id).callFrame}));
  const result={base,label,device,harnessFirstMs:first,errors,writes,...data,self:top(self),inclusive:top(inclusive)};
  writeFileSync(`${out}/${label}-${device}.json`,JSON.stringify(result,null,2));await page.screenshot({path:`${out}/${label}-${device}.png`});
  console.log(JSON.stringify({...result,resources:result.resources.filter(r=>r.bytes>50000),self:result.self.slice(0,20),inclusive:result.inclusive.slice(0,20)},null,2));
} finally {await browser.close();}
