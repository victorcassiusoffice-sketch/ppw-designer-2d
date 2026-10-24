import { chromium, expect } from '@playwright/test';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
const base=process.argv[2]??'http://127.0.0.1:5176';
if(!['127.0.0.1','localhost'].includes(new URL(base).hostname))throw Error('Local QA only');
const fixture=JSON.parse(readFileSync('docs/qa-sims-parity-2026-10-22/before-graphics/report.json','utf8')).fixtures[0].property;
const out='docs/qa-sims-parity-2026-10-22/quality-controls';mkdirSync(out,{recursive:true});
const report={base,capturedAt:new Date().toISOString(),cases:[]};
const browser=await chromium.launch({headless:true,args:['--use-angle=d3d11','--enable-gpu','--ignore-gpu-blocklist']});
try{
  for(const [device,viewport] of [['desktop',{width:1280,height:900}],['phone',{width:390,height:844}]]){
    const context=await browser.newContext({viewport,deviceScaleFactor:1,isMobile:device==='phone',hasTouch:device==='phone'});
    const row={device,errors:[],blockedWrites:[],checks:[]};report.cases.push(row);
    try{
      await context.addInitScript(property=>{localStorage.clear();localStorage.setItem('ppw_designer_coach_v1','1');localStorage.setItem('ppw_property_v2',JSON.stringify({version:2,state:{property,pxPerMetre:85,showGrid:false}}));},fixture);
      const page=await context.newPage();page.setDefaultTimeout(45000);
      page.on('pageerror',error=>row.errors.push(error.message));page.on('console',message=>{if(message.type()==='error')row.errors.push(message.text());});
      await page.route('**/*',async route=>{if(!['GET','HEAD','OPTIONS'].includes(route.request().method())){row.blockedWrites.push(route.request().url());await route.abort();}else await route.continue();});
      await page.goto(`${base}/designer?pitch=1`,{waitUntil:'domcontentloaded'});await page.getByRole('button',{name:'3D House',exact:true}).click();
      const gl=page.getByTestId('wallpaint-3d-gl'),stage=page.getByTestId('wallpaint-3d-canvas');
      await expect(gl).toHaveAttribute('data-quality','medium');await page.getByTestId('loading-3d').waitFor({state:'hidden'});await page.waitForTimeout(800);
      const camera=await stage.getAttribute('data-camera'),property=await page.evaluate(()=>localStorage.getItem('ppw_property_v2'));
      await gl.evaluate(canvas=>{window.__qualityOriginalCanvas=canvas;});
      await page.getByTestId('house-view-settings').click();
      const select=page.getByRole('combobox',{name:'3D rendering quality'});
      for(const choice of ['high','low','medium','auto']){
        await select.selectOption(choice);await expect(gl).toHaveAttribute('data-quality',choice==='auto'?'medium':choice);
        await expect(gl).toHaveAttribute('data-shading',choice==='high'&&device==='desktop'?'natural-depth':'natural-basic');
        await expect(gl).toHaveAttribute('data-shadow-size',device==='phone'||choice==='low'?'1024':'2048');
        expect(await stage.getAttribute('data-camera')).toBe(camera);expect(await page.evaluate(()=>localStorage.getItem('ppw_property_v2'))).toBe(property);
        expect(await gl.evaluate(canvas=>canvas===window.__qualityOriginalCanvas)).toBe(true);
        row.checks.push(`${choice}: same camera/property/canvas; expected shading/shadow resolution`);
        if(choice==='high'){await page.screenshot({path:`${out}/${device}-high.png`});}
      }
      await page.getByTestId('view3d-lighting').selectOption('architectural');await expect(gl).toHaveAttribute('data-shading','colour-check');
      await select.selectOption('high');await expect(gl).toHaveAttribute('data-shading','colour-check');
      row.checks.push('Colour check remains direct/calibrated even at High');
      await page.getByRole('button',{name:'Close view settings',exact:true}).click();await expect(page.getByTestId('house-view-options')).toBeHidden();
      expect(await stage.getAttribute('data-camera')).toBe(camera);
      row.horizontalOverflowPx=await page.evaluate(()=>Math.max(0,document.documentElement.scrollWidth-innerWidth));expect(row.horizontalOverflowPx).toBe(0);
      expect(row.errors).toEqual([]);expect(row.blockedWrites).toEqual([]);row.passed=true;
    }catch(error){row.failure=String(error.stack??error);}finally{await context.close();writeFileSync(`${out}/report.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(row));}
  }
}finally{await browser.close();}
if(report.cases.some(row=>!row.passed))process.exitCode=1;
