/** Read-only production baseline. Browser-local edits only; all server mutations blocked. */
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
const base = process.argv[2] || 'https://onelivebuild.com';
const out = 'docs/qa-sims-parity-2026-10-22/before-interaction';
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ headless: true });
const report = { base, cases: [] };
try {
  for (const [device, viewport] of [['desktop', {width:1280,height:900}], ['phone', {width:390,height:844}]]) {
    const context = await browser.newContext({ viewport, isMobile: device==='phone', hasTouch: device==='phone' });
    await context.addInitScript(() => localStorage.setItem('ppw_designer_coach_v1','1'));
    const page = await context.newPage(); page.setDefaultTimeout(30000);
    const row = { device, screenshots: [], errors: [], writes: [], states: [] }; report.cases.push(row);
    page.on('pageerror', e => row.errors.push(String(e)));
    page.on('console', m => { if(m.type()==='error') row.errors.push(m.text()); });
    await page.route('**/api/**', route => {
      if (!['GET','HEAD','OPTIONS'].includes(route.request().method())) { row.writes.push(route.request().url()); return route.abort(); }
      return route.continue();
    });
    const shot = async name => {
      const path = `${out}/${device}-${name}.png`;
      await page.screenshot({path}); row.screenshots.push(path);
      row.states.push({ name, url:page.url(), ...(await page.evaluate(() => ({
        overflow:document.documentElement.scrollWidth-innerWidth,
        buttons:[...document.querySelectorAll('button')].filter(e=>e.getBoundingClientRect().width&&e.getBoundingClientRect().height).map(e=>({text:e.textContent,aria:e.getAttribute('aria-label'),testid:e.getAttribute('data-testid')})),
        property: JSON.parse(localStorage.getItem('ppw_property_v2') || 'null'),
        ui: JSON.parse(localStorage.getItem('ppw-designer-ui') || 'null'),
        visibleText:document.body.innerText,
      }))) });
      writeFileSync(`${out}/report.json`,JSON.stringify(report,null,2));
    };
    await page.goto(`${base}/demo?view=2d&pitch=1`,{waitUntil:'networkidle'});
    await page.getByTestId('plan-drawing-viewport').waitFor();
    await shot('plan');
    const furnish=page.getByRole('button',{name:/^Furnish(?:\s|$)/}).first();
    if(await furnish.isVisible()) { await furnish.click(); await page.waitForTimeout(800); await shot('catalogue'); }
    await page.keyboard.press('Escape');
    await page.goto(`${base}/demo?view=3d&pitch=1`,{waitUntil:'networkidle'});
    await page.getByTestId('wallpaint-3d-gl').waitFor();
    await page.getByTestId('loading-3d').waitFor({state:'hidden'});
    await page.waitForTimeout(1500); await shot('house');
    const canvas=await page.getByTestId('wallpaint-3d-canvas').boundingBox();
    await page.mouse.click(canvas.x+canvas.width*.5, canvas.y+canvas.height*.5);
    await shot('selection-at-centre');
    await page.keyboard.press('.'); await shot('key-turn');
    await page.goto(`${base}/designer`,{waitUntil:'domcontentloaded'});
    await shot('designer-access');
    await context.close();
    console.log(JSON.stringify({device,shots:row.screenshots.length,errors:row.errors,writes:row.writes}));
  }
} finally { writeFileSync(`${out}/report.json`,JSON.stringify(report,null,2)); await browser.close(); }
