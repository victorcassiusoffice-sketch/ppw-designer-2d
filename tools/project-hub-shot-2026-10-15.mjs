/** Headless, disposable local project QA. Does not submit forms to any server. */
import { chromium, expect } from '@playwright/test';
import { mkdirSync, readdirSync, writeFileSync } from 'node:fs';
const base=process.argv[2] ?? 'http://127.0.0.1:5173';
if (!['localhost','127.0.0.1'].includes(new URL(base).hostname)) throw new Error('Local preview only.');
const out='docs/qa-project-hub-2026-10-15'; mkdirSync(out,{recursive:true});
const report={base,date:'2026-10-15',bundle:readdirSync('dist/assets').find(f=>/^App-[\w-]+\.js$/.test(f)),cases:[]};
const browser=await chromium.launch({headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try {
 for (const [name,viewport] of [['desktop',{width:1280,height:900}],['phone',{width:390,height:844}]]) {
  const context=await browser.newContext({viewport,isMobile:name==='phone',hasTouch:name==='phone',deviceScaleFactor:1});
  await context.addInitScript(()=>{
   if (sessionStorage.getItem('qa-project-seeded')) return;
   localStorage.clear(); localStorage.setItem('ppw_designer_coach_v1','1');
   const polygon=[{x:0,y:0},{x:8,y:0},{x:8,y:6},{x:0,y:6}];
   localStorage.setItem('ppw_property_v2',JSON.stringify({version:2,state:{pxPerMetre:70,showGrid:true,property:{id:'qa-project-hub',name:'Garden studio study',activeRoomId:'ground-room',wallHeightM:2.7,levels:[{id:'ground',name:'Ground floor',index:0},{id:'roof',name:'Roof',index:1,kind:'roof'}],rooms:[{id:'ground-room',name:'Garden studio',polygon,placedItems:[{instanceId:'qa-sofa',productId:'courts-marco-sofa-corner',x:1,y:1,rotation:0}]},{id:'roof-room',name:'Studio roof',levelId:'roof',kind:'roof',polygon,placedItems:[]}],eco:{version:1,trees:[{id:'existing-tree',name:'Existing tree survey',x:-2,y:3,heightM:6,canopyRadiusM:2.5,stemDiameterMm:300,status:'existing',protectionMethod:'bs5837-single-stem'}],greenRoofs:[]}}}}));
   sessionStorage.setItem('qa-project-seeded','1');
  });
  const page=await context.newPage(); page.setDefaultTimeout(20000);
  const result={viewport:name,shots:[],checks:[],failures:[],consoleErrors:[],pageErrors:[],writeRequests:[]}; report.cases.push(result);
  page.on('console',m=>{if(m.type()==='error')result.consoleErrors.push(m.text());}); page.on('pageerror',e=>result.pageErrors.push(e.message));
  await page.route('**/api/**',async route=>{if (!['GET','HEAD','OPTIONS'].includes(route.request().method())) {result.writeRequests.push(route.request().url());await route.abort();} else await route.continue();});
  const hub=()=>page.getByTestId('project-workspace');
  const section=label=>({click:async()=>{if(name==='phone') await hub().locator('.project-mobile-section select').selectOption({label}); else await hub().locator('.project-nav nav').getByRole('button',{name:label,exact:false}).click();}});
  const model=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('ppw_property_v2')).state.property);
  async function shot(label) {
   await page.waitForTimeout(200);
   const file=`${out}/${name}-${label}.png`; await page.screenshot({path:file,timeout:60000}); result.shots.push(file);
   const overflow=await page.evaluate(()=>({body:document.documentElement.scrollWidth-innerWidth,content:[...document.querySelectorAll('.project-content,.project-card,.project-header')].filter(el=>el.scrollWidth>el.clientWidth+2).map(el=>({class:el.className,overflow:el.scrollWidth-el.clientWidth}))}));
   if(overflow.body>1||overflow.content.length)result.failures.push({label,overflow});
  }
  async function preferences(locale,theme) {
   const controls=hub().locator('.locale-theme-controls');
   if (!(await controls.evaluate(el=>el.open))) await controls.locator('summary').click();
   await controls.locator('select').nth(0).selectOption(locale); await controls.locator('select').nth(1).selectOption(theme);
   await controls.locator('summary').click();
   await expect(page.locator('html')).toHaveAttribute('lang',locale); await expect(page.locator('html')).toHaveAttribute('data-ui-theme',theme);
  }
  try {
   await page.goto(`${base}/designer?panel=project`,{waitUntil:'networkidle'}); await expect(hub()).toBeVisible(); await shot('overview');
   for(const company of ['developers','merchants','construction','plumbing','landscape','city']) {
    await hub().locator('.project-nav>label').first().locator('select').selectOption(company);
    expect(await hub().locator('.project-department-cards button').count()).toBeGreaterThanOrEqual(4);
    result.checks.push(`Company station ${company} opens against same project`);
   }
   expect((await model()).id).toBe('qa-project-hub');
   await hub().locator('.project-nav>label').first().locator('select').selectOption('construction');
   await section('Departments').click();
   const taskForm=hub().locator('form').filter({has:page.getByRole('heading',{name:'Add task',exact:true})});
   await taskForm.getByLabel('Task title',{exact:true}).fill('Review tree and service clearances'); await taskForm.getByLabel('Brief / evidence reference',{exact:true}).fill('QA coordination note — no external recipient');
   await taskForm.getByLabel('Target date',{exact:true}).fill('2026-11-12'); await taskForm.getByRole('button',{name:'Save',exact:true}).click();
   await expect(hub().locator('.project-task').getByText('Review tree and service clearances',{exact:true})).toBeVisible();
   await hub().locator('.project-task select').selectOption('review'); await shot('department-tasks');
   await hub().locator('.project-tabs').getByRole('button',{name:'Procurement',exact:true}).click(); expect(await hub().locator('table tbody tr').count()).toBeGreaterThan(0); await shot('procurement-quantities');
   await hub().locator('.project-tabs').getByRole('button',{name:'Site & delivery',exact:true}).click(); await expect(hub().getByRole('heading',{name:'Coordination dates',exact:true})).toBeVisible(); await shot('delivery-dates');
   await hub().locator('.project-nav>label').first().locator('select').selectOption('merchants'); await expect(hub().locator('table')).toContainText('1'); await shot('sales-objects');
   result.checks.push('Procurement quantities, delivery dates and placed-product sales station read the same build');
   await section('Trees & living roofs').click();
   const tree=hub().locator('form').filter({has:page.locator('[name=canopyRadiusM]')});
   await tree.getByLabel('Name',{exact:true}).fill('Proposed shade tree');
   await tree.getByLabel('X (m)',{exact:true}).fill('11'); await tree.getByLabel('Y (m)',{exact:true}).fill('3');
   // Inputs are addressed by schema names so translated measurement labels remain independently testable.
   await tree.locator('[name=heightM]').fill('4.2'); await tree.locator('[name=canopyRadiusM]').fill('1.6'); await tree.getByRole('button',{name:'Save',exact:true}).click();
   expect((await model()).eco.trees).toHaveLength(2); expect((await model()).eco.trees[1].heightM).toBe(4.2);
   const roof=hub().locator('form').filter({has:page.locator('[name=saturatedKgM2]')});
   await roof.locator('[name=name]').fill('Saturated roof study'); await roof.locator('[name=roomId]').selectOption('roof-room');
   await roof.locator('[name=saturatedKgM2]').fill('120'); await roof.locator('[name=extraRetainedWaterMm]').fill('20'); await roof.locator('[name=additionalLoadCapacityKPa]').fill('1'); await roof.locator('[name=capacityRef]').fill('Illustrative input, engineer verification required'); await roof.getByRole('button',{name:'Save',exact:true}).click();
   expect((await model()).eco.greenRoofs).toHaveLength(1); await hub().locator('.project-content').evaluate(el=>el.scrollTop=0); await shot('ecology');
   await section('Engineering review').click();
   expect(await hub().locator('.project-finding').count()).toBeGreaterThan(0);
   await shot('engineering-findings');
   await hub().getByText('Design evidence',{exact:true}).click();
   const evidence=hub().locator('form'); await evidence.locator('[name=geotechnicalReportRef]').fill('QA report reference'); await evidence.getByRole('button',{name:'Save',exact:true}).click();
   expect((await model()).engineering.geotechnicalReportRef).toBe('QA report reference'); await shot('evidence');
   await section('JSON handover').click();
   const downloadPromise=page.waitForEvent('download'); await hub().getByRole('button',{name:'Export project review JSON',exact:true}).click();
   const download=await downloadPromise; const stream=await download.createReadStream(); const buffers=[]; for await(const chunk of stream)buffers.push(chunk); const payload=JSON.parse(Buffer.concat(buffers).toString('utf8'));
   expect(payload.format).toBe('one-live-build/project-handover'); expect(payload.fingerprint).toMatch(/^[a-f0-9]{64}$/); expect(payload.register.tasks).toHaveLength(1); expect(payload.snapshot.eco.trees).toHaveLength(2);
   await hub().locator('input[type=file]').setInputFiles({name:'same-build.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({...payload,register:{...payload.register,tasks:[...payload.register.tasks,{id:'qa-imported',title:'Confirm delivery sequence',department:'delivery',status:'open',note:''}]}}))});
   await expect(hub().getByRole('status')).toContainText('New tasks imported');
   const stored=await page.evaluate(()=>JSON.parse(localStorage.getItem('olb_project_registers_v1')).state.registers['qa-project-hub']); expect(stored.tasks).toHaveLength(2);
   await shot('handover'); result.checks.push('Tree, roof, evidence, task and same-build JSON round-trip persist through real UI');
   await section('Overview').click(); const unchanged=JSON.stringify(await model());
   for(const locale of ['en','fr','zh-CN','es']) for(const theme of ['ivory','ocean','slate']) {
    await preferences(locale,theme); expect(JSON.stringify(await model())).toBe(unchanged);
    expect(await hub().locator('h1').innerText()).toBe({en:'Overview',fr:'Vue d’ensemble','zh-CN':'概览',es:'Resumen'}[locale]);
    if(locale==='en'||theme==='ivory')await shot(`${locale}-${theme}`);
   }
   result.checks.push('All 12 language/theme combinations preserve exact measured project');
   await page.reload({waitUntil:'networkidle'}); await expect(hub()).toBeVisible(); await expect(page.locator('html')).toHaveAttribute('lang','es'); await expect(page.locator('html')).toHaveAttribute('data-ui-theme','slate'); expect((await model()).eco.trees).toHaveLength(2);
   await preferences('en','ivory'); await page.keyboard.press('Escape'); await expect(hub()).toHaveCount(0); await page.locator('.konvajs-content canvas').first().waitFor(); result.checks.push('Escape returns to designer; reload preserves model/preferences');
  } catch(error) { result.failures.push(String(error)); await page.screenshot({path:`${out}/${name}-failure.png`}).catch(()=>{}); }
  await context.close();
 }
} finally {await browser.close();writeFileSync(`${out}/report.json`,JSON.stringify(report,null,2));}
console.log(JSON.stringify(report,null,2));
if(report.cases.some(c=>c.failures.length||c.consoleErrors.length||c.pageErrors.length||c.writeRequests.length))process.exitCode=1;
