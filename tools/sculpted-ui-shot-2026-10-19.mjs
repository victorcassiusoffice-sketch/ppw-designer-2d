import { chromium, expect } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
const base=process.argv[2]??'http://127.0.0.1:5174';
const out='docs/qa-sculpted-ui-2026-10-19'; mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const report={base,cases:[]};
try { for(const [device,viewport] of [['desktop',{width:1280,height:900}],['phone',{width:390,height:844}]]) {
 const context=await browser.newContext({viewport,hasTouch:device==='phone',isMobile:device==='phone',deviceScaleFactor:1});
 await context.addInitScript(()=>{ localStorage.setItem('ppw_designer_coach_v1','1'); });
 const page=await context.newPage(); page.setDefaultTimeout(30000);
 const errors=[],writes=[]; page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
 await page.route('**/api/**',async route=>{if(!['GET','HEAD','OPTIONS'].includes(route.request().method())){writes.push(route.request().url());await route.abort()}else await route.continue()});
 for(const [name,path,wait] of [['plan','/demo?view=2d&pitch=1','.designer-app'],['house','/demo?view=3d&pitch=1','.house-workspace'],['project','/demo?panel=project&pitch=1','.project-workspace'],['shared','/demo?panel=shared&pitch=1','.shared-workspace']]) {
  await page.goto(base+path,{waitUntil:'networkidle'});await expect(page.locator(wait)).toBeVisible();
  await page.waitForTimeout(name==='house'?2400:500);
  const notice=page.getByRole('button',{name:'Dismiss notification',exact:true});if(await notice.count())await notice.click();
  await page.screenshot({path:`${out}/${device}-${name}.png`});
  const layout=await page.evaluate(()=>({theme:document.documentElement.dataset.uiTheme,width:innerWidth,scroll:document.documentElement.scrollWidth}));
  expect(layout.theme).toBe('ocean');expect(layout.scroll).toBeLessThanOrEqual(layout.width+1);
  if(name==='shared'||name==='project'){
   const prefs=page.locator(wait+' .locale-theme-controls');await prefs.locator('summary').click();
   await expect(prefs).toHaveAttribute('open','');await page.keyboard.press('Escape');
   await expect(prefs).not.toHaveAttribute('open','');await expect(page.locator(wait)).toBeVisible();
   await page.keyboard.press('Escape');await expect(page.locator(wait)).toBeHidden();
  }
  report.cases.push({device,name,layout});
 }
 report.cases.push({device,errors,writes});expect(errors).toEqual([]);expect(writes).toEqual([]);await context.close();
} } finally { await browser.close();writeFileSync(`${out}/report.json`,JSON.stringify(report,null,2)); }
console.log(JSON.stringify(report));
