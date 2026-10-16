import { chromium, expect } from '@playwright/test';
import { mkdirSync, readdirSync, writeFileSync } from 'node:fs';
const base=process.argv[2]??'http://127.0.0.1:5173';
if(!['127.0.0.1','localhost'].includes(new URL(base).hostname))throw new Error('Local QA only');
const out='docs/qa-shared-project-2026-10-16';mkdirSync(out,{recursive:true});
const report={base,bundle:readdirSync('dist/assets').find(f=>/^App-[\w-]+\.js$/.test(f)),cases:[]};
const browser=await chromium.launch({headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{for(const [name,viewport] of [['desktop',{width:1280,height:900}],['phone',{width:390,height:844}]]){
 const context=await browser.newContext({viewport,hasTouch:name==='phone',isMobile:name==='phone',deviceScaleFactor:1});
 await context.addInitScript(()=>{localStorage.setItem('ppw_designer_coach_v1','1');});
 const page=await context.newPage();page.setDefaultTimeout(30000);const c={name,shots:[],errors:[],writes:[],checks:[],failures:[]};report.cases.push(c);
 page.on('console',m=>{if(m.type()==='error')c.errors.push(m.text());});page.on('pageerror',e=>c.errors.push(e.message));
 await page.route('**/api/**',async route=>{if(!['GET','HEAD','OPTIONS'].includes(route.request().method())){c.writes.push(route.request().url());await route.abort();}else await route.continue();});
 const shot=async label=>{await page.waitForTimeout(200);const path=`${out}/${name}-${label}.png`;await page.screenshot({path});c.shots.push(path);const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth);expect(overflow).toBeLessThanOrEqual(1);c.checks.push({label,overflow});};
 try{
 await page.goto(`${base}/demo?view=2d&panel=shared&pitch=1`,{waitUntil:'networkidle'});
 const workspace=page.getByTestId('shared-project-workspace');await expect(workspace).toBeVisible();
 const nav=workspace.locator('.shared-nav nav');const tab=async title=>{await nav.getByRole('button',{name:title,exact:true}).click();};
 await shot('owner-station');
 for(const role of ['architect','engineer','supplier','contractor','client']){await page.getByLabel('Rehearse a stakeholder role').selectOption(role);await shot(`${role}-station`);}
 await page.getByLabel('Rehearse a stakeholder role').selectOption('owner');
 await tab('Components');await shot('components');
 await page.locator('.shared-component-list>button').first().click();const editor=page.getByRole('form',{name:'Edit component specification'});await expect(editor).toBeVisible();
 await editor.getByLabel('Material / product').fill('Pilot wall reference');await editor.getByLabel('Responsible organisation').fill('Pilot contractor');await editor.getByLabel('Required delivery date').fill('2026-12-01');await editor.getByLabel('Source URLs').fill('https://www.ubp.mu/');await shot('component-edit');await editor.getByRole('button',{name:'Save new version'}).click();await expect(editor).toHaveCount(0);
 await tab('Environment');await shot('environment-moisture');
 await page.getByLabel('Air temperature °C',{exact:true}).fill('29');await page.getByLabel('Air relative humidity %',{exact:true}).fill('80');await page.getByLabel('Surface temperature °C',{exact:true}).fill('23');await page.getByRole('button',{name:'Save inputs and calculate'}).click();await expect(page.getByText('Condensation:',{exact:false})).toContainText('possible');await shot('moisture-calculated');
 await page.getByRole('button',{name:'Local / import evidence',exact:true}).click();await shot('local-sources');
 await page.getByRole('button',{name:'Surface technologies',exact:true}).click();await page.getByLabel('Installed area m²').fill('10');await page.getByRole('button',{name:'Save scenario and compare'}).click();await page.getByRole('button',{name:'Surface technologies',exact:true}).click();await shot('surface-review');
 await tab('Pilot workflow');await page.getByLabel('Review evidence / comment').fill('Local rehearsal: project brief reviewed.');await page.locator('.shared-pilot article').first().getByRole('button',{name:'Acknowledge',exact:true}).click();await expect(page.locator('.shared-pilot article').first()).toContainText('Current · accepted');await shot('pilot-gates');
 await tab('Change history');await expect(page.locator('.shared-history article').first()).toBeVisible();await shot('history');
 await tab('Shared connection');await shot('connection');
 await page.getByRole('button',{name:'← Build',exact:true}).click();await expect(workspace).toBeHidden();c.checks.push('Close returns to build');
 expect(c.errors).toEqual([]);expect(c.writes).toEqual([]);
 }catch(e){c.failures.push(String(e));await page.screenshot({path:`${out}/${name}-failure.png`});}
 await context.close();writeFileSync(`${out}/report.json`,JSON.stringify(report,null,2));
 }}finally{await browser.close();writeFileSync(`${out}/report.json`,JSON.stringify(report,null,2));}
console.log(JSON.stringify(report,null,2));if(report.cases.some(c=>c.errors.length||c.writes.length||c.failures.length))process.exitCode=1;
