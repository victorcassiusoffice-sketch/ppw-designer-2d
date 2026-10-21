import { chromium, expect as baseExpect } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';
const expect = baseExpect.configure({ timeout: 60000 });
const out='docs/qa-sculpted-ui-2026-10-19';
const base=process.argv[2]??'http://127.0.0.1:5174';
const browser=await chromium.launch({headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1280,height:900}});
await page.addInitScript(()=>localStorage.setItem('ppw_designer_coach_v1','1'));
page.setDefaultTimeout(60000);
const report={base,completed:false,checks:[],errors:[]};
try {
 for(const theme of ['ocean','ivory','slate']) {
  await page.goto(base+'/demo?panel=shared&pitch=1',{waitUntil:'domcontentloaded'});
  await expect(page.locator('.shared-workspace')).toBeVisible();
  const panel=page.locator('.shared-workspace .locale-theme-controls');
  await panel.locator('summary').click();await panel.locator(`.theme-skin-card--${theme}`).click();
  await panel.getByRole('button',{name:'Close preferences',exact:true}).click();
  await expect(page.locator('html')).toHaveAttribute('data-ui-theme',theme);
  await expect(page.locator('.shared-workspace')).toBeVisible();
  await page.addScriptTag({content:readFileSync('node_modules/axe-core/axe.min.js','utf8')});
  const result=await page.evaluate(async()=>await axe.run(document.querySelector('.shared-workspace'),{runOnly:{type:'rule',values:['color-contrast']}}));
  const describe=v=>({id:v.id,nodes:v.nodes.map(n=>({target:n.target,summary:n.failureSummary}))});
  report.checks.push({theme,violations:result.violations.map(describe),incomplete:result.incomplete.map(describe)});
  await page.screenshot({path:`${out}/desktop-shared-${theme}.png`});
  expect(result.violations).toEqual([]);
 }
 report.completed=true;
} catch(error) { report.errors.push(String(error));process.exitCode=1; }
finally {await browser.close();writeFileSync(`${out}/theme-contrast.json`,JSON.stringify(report,null,2));}
console.log(JSON.stringify(report));
