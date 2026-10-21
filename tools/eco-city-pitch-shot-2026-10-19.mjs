import { chromium, expect } from '@playwright/test';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
const base = process.argv[2] ?? 'http://127.0.0.1:5174';
const host = new URL(base).hostname;
if (!['localhost', '127.0.0.1'].includes(host) && !/^ppw-designer-2d-[\w-]+\.vercel\.app$/.test(host)) throw new Error('Local or feature preview only');
const live = host.endsWith('.vercel.app');
const out = process.argv.find(arg => arg.startsWith('--out='))?.slice(6) ?? `docs/qa-eco-city-pitch${live ? '-live' : ''}-2026-10-19`; mkdirSync(out, {recursive:true});
const args = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'];
if (process.argv.includes('--map-edge')) args.push(`--host-resolver-rules=MAP ${host} 216.198.79.3`);
const browser = await chromium.launch({headless:true,args}); const report = {base,cases:[]};
try {
 for (const [device,viewport] of [['desktop',{width:1280,height:900}],['phone',{width:390,height:844}]]) {
  const context = await browser.newContext({viewport,hasTouch:device==='phone',isMobile:device==='phone',deviceScaleFactor:1});
  const page=await context.newPage();page.setDefaultTimeout(20000);
  const result={device,errors:[],failed:[],writes:[],shots:[],checks:[]};report.cases.push(result);
  page.on('pageerror',e=>result.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')result.errors.push(m.text());});
  page.on('response',r=>{if(r.status()>=400)result.failed.push({url:r.url(),status:r.status()});});
  await page.route('**/*',async route=>{if(!['GET','HEAD','OPTIONS'].includes(route.request().method())){result.writes.push(route.request().url());await route.abort();}else await route.continue();});
  const shot=async label=>{await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(250);await expect.poll(()=>page.locator('img').evaluateAll(imgs=>imgs.every(i=>i.complete&&i.naturalWidth>0))).toBe(true);expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);const path=`${out}/${device}-${label}.png`;await page.screenshot({path});result.shots.push(path);};
  await page.goto(`${base}/pitch/eco-city?cb=${Date.now()}`,{waitUntil:'domcontentloaded'});await page.getByTestId('eco-chapter-stage').waitFor();
  await expect(page.locator('iframe,canvas')).toHaveCount(0);
  const tabs=page.getByRole('tab');await expect(tabs).toHaveCount(7);
  for(let i=0;i<7;i++){await tabs.nth(i).click();await page.evaluate(()=>window.scrollTo(0,0));await shot(`chapter-${i+1}`);}
  await tabs.nth(1).click();
  const tools=page.getByRole('group',{name:'Construction workstreams'}).getByRole('button');
  for(let i=0;i<await tools.count();i++){await tools.nth(i).click();await expect(page.locator('.eco-tool-copy h3')).toBeVisible();}
  await tabs.nth(2).click();await page.getByRole('button',{name:'Rehearse a design change',exact:true}).click();
  await expect(page.locator('.eco-topology-hub strong')).toHaveText('Wall A · revision 2');
  const roles=page.locator('.eco-role-orbit button');for(let i=0;i<await roles.count();i++){await roles.nth(i).click();await expect(page.locator('.eco-role-station')).toContainText('Revision 2');}
  await page.locator('.eco-role-station').scrollIntoViewIfNeeded();await shot('role-station');
  await tabs.nth(4).click();await page.getByRole('button',{name:'Show an example proposal',exact:true}).click();await expect(page.locator('.eco-ai-response')).toContainText('scripted presentation text');await page.getByRole('button',{name:'Review the example',exact:true}).click();await expect(page.locator('.eco-ai-response')).toContainText('No design, supplier order or approval was changed');
  await page.getByRole('button',{name:'Personalise',exact:true}).click();
  await page.getByLabel('Company',{exact:true}).fill('Example Development');await page.getByLabel('Project',{exact:true}).fill('Coastal District');
  await page.getByLabel('Scenario',{exact:true}).selectOption('Mixed-use district');await page.getByLabel('Audience',{exact:true}).selectOption('Public / infrastructure team');
  await page.getByRole('button',{name:'graphite',exact:true}).click();await shot('customise-graphite');await page.getByRole('button',{name:'ocean',exact:true}).click();await shot('customise-ocean');await page.getByRole('button',{name:'Done',exact:true}).click();
  await tabs.nth(6).click();await page.getByRole('button',{name:'Share this version',exact:true}).click();const share=await page.locator('.eco-share input').inputValue();
  expect(new URL(share).searchParams.get('company')).toBe('Example Development');expect(new URL(share).searchParams.get('theme')).toBe('ocean');expect(new URL(share).searchParams.has('cb')).toBe(false);
  const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:'Download presentation brief',exact:true}).click();const download=await downloadPromise;const path=await download.path();const brief=JSON.parse(readFileSync(path,'utf8'));expect(brief.company).toBe('Example Development');expect(brief.scope).toContain('no project, orders or permissions');
  await page.goto(share,{waitUntil:'domcontentloaded'});await expect(page.getByTestId('eco-chapter-stage')).toContainText('Coastal District');
  await tabs.nth(0).focus();await page.keyboard.press('End');await expect(tabs.nth(6)).toHaveAttribute('aria-selected','true');
  result.checks.push('Seven chapters, workstreams and roles usable; no full editor; scripted AI explicit; customization/share/JSON export and keyboard tabs pass');
  await page.goto(`${base}/pitch/construction`,{waitUntil:'domcontentloaded'});await page.getByTestId('eco-chapter-stage').waitFor();await expect(page.locator('iframe,canvas')).toHaveCount(0);
  await page.goto(`${base}/pitch/developers`,{waitUntil:'domcontentloaded'});await expect(page.locator('a[href^="/pitch/eco-city"]').first()).toBeVisible();await shot('developer-entry');
  expect(result.errors).toEqual([]);expect(result.failed).toEqual([]);expect(result.writes).toEqual([]);
  await context.close();console.log(JSON.stringify({device,shots:result.shots.length,errors:result.errors.length}));
 }
} finally {await browser.close();writeFileSync(`${out}/report.json`,JSON.stringify(report,null,2));}
