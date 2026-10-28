import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
// Resolve from the repository when copied into docs; the scratch runner uses the existing local tool package.
let playwright;
try { playwright = require('playwright'); }
catch { playwright = createRequire('C:/Users/Victor/Documents/PPW-Code/ppw-tutorial-studio/package.json')('playwright'); }
export const { chromium } = playwright;
export const OUT = fileURLToPath(new URL('../results/', import.meta.url));
mkdirSync(OUT, { recursive: true });
export const TARGETS = {
 base: 'https://ppw-designer-2d-nm7fkrg1m-victor-ppw.vercel.app',
 walk: 'https://ppw-designer-2d-git-gpt-olb-walk-mode-2026-10-27-victor-ppw.vercel.app',
 site: 'https://ppw-designer-2d-git-gpt-olb-site-map-2026-10-27-victor-ppw.vercel.app',
 prod: 'https://onelivebuild.com',
 localwalk: 'http://127.0.0.1:5183', localsite: 'http://127.0.0.1:5184',
};
const PIN = Object.values(TARGETS).filter(u => u.startsWith('https:')).map(u => `MAP ${new URL(u).hostname} 216.198.79.3`).join(',');
export const DEVICES = { desktop: {viewport:{width:1280,height:800}}, phone:{viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:1} };
export const launch = () => chromium.launch({headless:true,args:['--use-angle=d3d11','--enable-gpu','--ignore-gpu-blocklist',`--host-resolver-rules=${PIN}`]});
export async function newCtx(browser,device) {
 const context=await browser.newContext(DEVICES[device]), log={blockedWrites:[]};
 await context.route('**/*',route=>{const r=route.request();if(!['GET','HEAD','OPTIONS'].includes(r.method())){log.blockedWrites.push({method:r.method(),url:r.url()});return route.abort('blockedbyclient');}return route.continue();});
 await context.addInitScript(()=>{localStorage.setItem('ppw_designer_coach_v1','1');});
 return {context,log};
}
export function watch(page,row) {
 row.pageErrors=[];row.consoleErrors=[];row.httpErrors=[];
 page.on('pageerror',e=>row.pageErrors.push(String(e)));
 page.on('console',m=>{if(m.type()==='error')row.consoleErrors.push(m.text().slice(0,500));});
 page.on('response',r=>{if(r.status()>=400)row.httpErrors.push({status:r.status(),url:r.url()});});
}
export function save(name,data){writeFileSync(OUT+name,JSON.stringify(data,null,2)+'\n');}
export const wait3d=async page=>{await page.waitForFunction(()=>Number(document.querySelector('[data-testid="wallpaint-3d-gl"]')?.getAttribute('data-first-picture-ms'))>0,{},{timeout:90000});};
