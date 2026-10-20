import { chromium, expect } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
const base=process.env.QA_BASE_URL??'http://127.0.0.1:5174';
const out=process.env.QA_OUT??'docs/qa-advanced-build-2026-10-16'; mkdirSync(out,{recursive:true});
const p={id:'qa-advanced',name:'Garden pavilion',activeRoomId:'r',wallHeightM:2.7,activeLevelId:'ground',site:{widthM:18,depthM:15,originM:{x:-2,y:-2}},
 rooms:[{id:'r',name:'Garden pavilion',polygon:[{x:0,y:0},{x:8,y:0},{x:8,y:6},{x:0,y:6}],placedItems:[],
 wallConstruction:[{edgeIndex:1,kind:'glass',thicknessMm:12,materialProductId:'birmingham-tempered-12'}],
 openings:[{id:'door',edgeIndex:2,offsetM:6,widthM:.9,kind:'door',flipHand:false,flipFacing:false},{id:'arch',edgeIndex:0,offsetM:2,widthM:1.4,heightM:1.6,sillM:.6,kind:'window',shape:'arch',flipHand:false,flipFacing:false},{id:'circle',edgeIndex:0,offsetM:5,widthM:1,heightM:1,sillM:1,kind:'hole',shape:'circle',flipHand:false,flipFacing:false}]}],
 garden:{surfaces:[{id:'path',kind:'tarmac',x:-1,y:7,widthM:14,depthM:2,elevationM:0,thicknessM:.06,subBaseDepthM:.15},{id:'pool',kind:'pool',x:10,y:0,widthM:4,depthM:6,elevationM:0,pool:{shellDepthM:1.5,waterDepthM:1.35,wallThicknessM:.2,baseThicknessM:.2,excavationMarginM:.3,stage:'filled'}}],fences:[]}};
const browser=await chromium.launch({headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const report={base,cases:[]};
try{for(const [name,viewport] of [['desktop',{width:1280,height:900}],['phone',{width:390,height:844}]]){
 const context=await browser.newContext({viewport,isMobile:name==='phone',hasTouch:name==='phone',deviceScaleFactor:1});
 await context.addInitScript(p=>{if(sessionStorage.getItem('qa-advanced'))return;localStorage.clear();localStorage.setItem('ppw_designer_coach_v1','1');localStorage.setItem('ppw_property_v2',JSON.stringify({version:2,state:{property:p,pxPerMetre:50,showGrid:true}}));sessionStorage.setItem('qa-advanced','1');},p);
 const page=await context.newPage();page.setDefaultTimeout(30000);const result={name,shots:[],failures:[],consoleErrors:[],pageErrors:[],writes:[]};report.cases.push(result);
 page.on('console',m=>{if(m.type()==='error')result.consoleErrors.push(m.text());});page.on('pageerror',e=>result.pageErrors.push(e.message));
 await page.route('**/api/**',async r=>{if(!['GET','HEAD','OPTIONS'].includes(r.request().method())){result.writes.push(r.request().url());await r.abort();}else await r.continue();});
 const shot=async label=>{await page.waitForTimeout(350);const path=`${out}/${name}-${label}.png`;await page.screenshot({path,timeout:60000});result.shots.push(path);if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1))result.failures.push(`overflow ${label}`);};
 const prefs=()=>page.locator('.locale-theme-controls').filter({visible:true}).last();
 try{
 await page.goto(`${base}/designer?view=2d&pitch=1`,{waitUntil:'networkidle'});await page.locator('.konvajs-content canvas').first().waitFor();
 for(const [theme,skin] of [['ivory','natural'],['ocean','blueprint'],['slate','gallery']]){
   const menu=prefs();await menu.locator('summary').click();await menu.locator(`.theme-skin-card--${theme}`).click();await menu.getByLabel('Build backdrop').selectOption(skin);await shot(`${theme}-preferences`);await menu.getByRole('button',{name:'Close preferences',exact:true}).click();await shot(`${theme}-plan`);
 }
 await page.evaluate(()=>window.dispatchEvent(new CustomEvent('ppw:open-wall-materials')));
 const materials=page.getByRole('dialog',{name:'Wall materials'});await expect(materials).toBeVisible();
 await materials.getByRole('button',{name:'Glass',exact:true}).click();
 await materials.getByLabel('Glass specification',{exact:true}).selectOption('birmingham-laminated-10-38');
 await expect(materials.getByLabel('Glass thickness (mm)',{exact:true})).toHaveValue('10.38');
 await materials.getByLabel('Glass thickness (mm)',{exact:true}).fill('12.38');await materials.getByLabel('Glass thickness (mm)',{exact:true}).press('Tab');
 await expect(materials.getByLabel('Glass specification',{exact:true})).toHaveValue('custom');
 await materials.getByLabel('Glass specification',{exact:true}).selectOption('birmingham-tempered-12');
 await materials.getByLabel('Glass on this floor',{exact:true}).scrollIntoViewIfNeeded();await shot('glass-specification-plan');
 await materials.getByRole('button',{name:'Close wall materials',exact:true}).click();await expect(materials).toHaveCount(0);
 await page.keyboard.press('Escape');
 await page.locator('.studio-view-switch button').nth(1).click();await page.getByTestId('wallpaint-3d-gl').waitFor();await page.getByTestId('loading-3d').waitFor({state:'hidden',timeout:60000});await page.waitForTimeout(600);
 for(const [theme,skin] of [['ivory','natural'],['ocean','blueprint'],['slate','gallery']]){
   const menu=prefs();await menu.locator('summary').click();await menu.locator(`.theme-skin-card--${theme}`).click();await menu.getByLabel('Build backdrop').selectOption(skin);await menu.getByRole('button',{name:'Close preferences',exact:true}).click();await shot(`${theme}-house`);
 }
 await expect(page.getByTestId('wallpaint-3d-gl')).toBeVisible();
 }catch(e){result.failures.push(String(e));await shot('failure');}
 await context.close();
}}finally{await browser.close();writeFileSync(`${out}/skins-report.json`,JSON.stringify(report,null,2));}
console.log(JSON.stringify(report,null,2));if(report.cases.some(c=>c.failures.length||c.consoleErrors.length||c.pageErrors.length||c.writes.length))process.exitCode=1;
