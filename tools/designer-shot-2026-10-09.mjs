import {chromium} from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
const base=process.argv[2]??'http://127.0.0.1:5173';
const out=process.argv[3]??'docs/qa-2026-10-09';
await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const report={base,at:new Date().toISOString(),screens:[],errors:[],failures:[]};
for(const width of [1280,390]){
 const name=width===1280?'desktop':'phone';
 const ctx=await browser.newContext({viewport:{width,height:width===1280?900:844},hasTouch:width===390,isMobile:width===390,deviceScaleFactor:1});
 const page=await ctx.newPage();
 page.on('console',m=>{if(m.type()==='error')report.errors.push({name,kind:'console',url:page.url(),message:m.text()});});
 page.on('pageerror',e=>report.errors.push({name,kind:'pageerror',url:page.url(),message:e.message}));
 const shot=async label=>{await page.screenshot({timeout:60000,path:path.join(out,`${name}-${label}.png`)}); report.screens.push({name,label,overflow:await page.evaluate(()=>({viewport:innerWidth,width:document.documentElement.scrollWidth,height:innerHeight})),url:page.url()});};
 const attempt=async(label,fn)=>{try{await fn();}catch(e){report.failures.push({name,label,message:e.message});await fs.writeFile(path.join(out,`${name}-${label}-dom.txt`),await page.locator('body').innerText());await shot(`${label}-failure`);}};
 await page.goto(`${base}/demo?view=2d&pitch=1`);await page.locator('.konvajs-content canvas').first().waitFor();await page.waitForTimeout(300);
 await shot('plan-controls');
 await attempt('materials',async()=>{await page.getByRole('button',{name:'Open Materials',exact:true}).click();await page.getByTestId('materials-panel').waitFor();for(const tab of ['Walls','Concrete','Roof','Report']){await page.getByRole('navigation',{name:'Materials sections'}).getByRole('button',{name:tab,exact:true}).click();await shot(`materials-${tab.toLowerCase()}`);}await page.getByRole('button',{name:'Open Materials',exact:true}).click();});
 await attempt('paint-coats',async()=>{await page.getByRole('button',{name:'Finish',exact:true}).click();await page.getByTestId('wallpaint-tool-toggle').click();if(width===390) { await page.getByRole('button',{name:'Change',exact:true}).click(); await page.getByLabel('Paint coats',{exact:true}).selectOption('3'); } else await page.getByTestId('wallpaint-coats').selectOption('3');await shot('paint-coats');if(width===390) { await page.getByRole('button',{name:'Close menu',exact:true}).click(); await page.getByRole('button',{name:'Done',exact:true}).click(); } else await page.getByTestId('wallpaint-close').click();});
 await attempt('three-loading',async()=>{await page.route('**/assets/ThreeStage-*.js',async route=>{await new Promise(r=>setTimeout(r,1200));await route.continue();});await page.goto(`${base}/demo?view=3d&pitch=1`);await page.getByTestId('loading-3d').waitFor({state:'visible',timeout:10000});await shot('3d-loading');await page.getByTestId('loading-3d').waitFor({state:'hidden',timeout:30000});await page.getByTestId('wallpaint-3d-gl').waitFor();await page.waitForTimeout(700);await shot('3d-house');await page.unroute('**/assets/ThreeStage-*.js');});
 await attempt('three-view',async()=>{await page.getByTestId('house-view-settings').click();await page.getByLabel('Orbit camera left',{exact:true}).click();await shot('3d-view-settings');await page.getByRole('button',{name:'Close view settings'}).click();});
 await attempt('three-selection',async()=>{const b=await page.getByTestId('wallpaint-3d-canvas').boundingBox();await page.mouse.click(b.x+b.width*.49,b.y+b.height*.47);await shot('3d-selection');});
 await ctx.close();
}
await browser.close();await fs.writeFile(path.join(out,'designer-report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
