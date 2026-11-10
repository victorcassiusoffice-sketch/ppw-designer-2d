import { assert, b, capture, expect, launch, localContext, olb, physical, save, assertClean } from './qa-local.mjs';

const browser = await launch();
try {
  for (const width of (process.argv[2] || '1280,390').split(',').map(Number)) {
    const {context, log} = await localContext(browser,width,{seed:true});
    try {
      await context.addInitScript(dark => location.origin==='http://127.0.0.1:5311' && localStorage.setItem('olb.ui-preferences.v1',JSON.stringify({locale:'en',theme:dark?'ocean':'ivory'})),width===390);
      const p = await context.newPage();
      await p.goto(olb+'/designer?panel=city');
      const city = p.locator('.city-workspace');
      await expect(city).toBeVisible();
      await b(city,'My buildings').click();
      await city.getByLabel('Building name').fill('Courtyard workshop');
      await b(city,'Save current house').click();
      for (let i=0;i<2;i++) {
        if (i) await b(city,'My buildings').click();
        await b(city,'Place').click();
        const map = city.locator('.city-map');
        await map.scrollIntoViewIfNeeded();
        const box = await map.boundingBox();
        await physical(p,width,box.x+box.width*(.36+i*.22),box.y+box.height*.4);
        await expect(city.getByLabel('City item name')).toHaveValue('Courtyard workshop');
      }
      assert.equal(await city.locator('.city-map g[data-city-id] polygon').count(),6);
      await city.getByText('District connections',{exact:true}).click();
      await expect(city.locator('.city-access')).toContainText('Unmapped');
      await b(city,'Frame selected').click();
      await capture(p,'city-plan-'+width);
      await b(city,'3D').click();
      await expect(city.locator('canvas')).toBeVisible();
      await p.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
      await capture(p,'city-massing-'+width);
      await p.reload();
      await expect(city.locator('.city-map g[data-city-id] polygon')).toHaveCount(6);
      assertClean(log);
      save('city-'+width,{width,placements:2,outlines:6,threeCanvas:true,reload:true,log});
    } finally { await context.close(); }
  }
} finally { await browser.close(); }
