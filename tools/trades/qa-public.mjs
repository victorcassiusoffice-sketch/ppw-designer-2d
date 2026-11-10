import {acquireRun,assert,launch,localContext,olb,assertClean,save} from './qa-local.mjs';
acquireRun('part6-public-functional-smoke');
const browser=await launch(),rows=[];
try {
  for(const width of [1280,390,313])for(const [path,view] of [['/demo','2d'],['/demo','3d'],['/embed/designer','2d'],['/embed/designer','3d'],['/pitch/plumbing','pitch']]){
    const {context,log}=await localContext(browser,width);const p=await context.newPage();p.setDefaultTimeout(60000);
    const row={width,path,view,log};rows.push(row);
    try{
      const resp=await p.goto(olb+path+'?view='+view+'&pitch=1&panel=build#w=not-a-valid-answer');assert.equal(resp?.status(),200);
      if(view==='pitch')await p.getByRole('heading').first().waitFor();
      else if(view==='3d'){await p.locator('[data-testid="wallpaint-3d-gl"][data-first-picture-ms]').waitFor();await p.getByTestId('loading-3d').waitFor({state:'hidden'});}
      else await p.getByTestId('plan-drawing-viewport').locator('canvas').first().waitFor();
      await p.waitForLoadState('networkidle');
      const facts=await p.evaluate(()=>({privateAssets:performance.getEntriesByType('resource').map(r=>new URL(r.name).pathname).filter(r=>r.includes('/assets/studio/')||/TradeProgress|TradeJob|BuildDashboard|TradeMap/i.test(r)),privateUi:!!document.querySelector('[data-testid="trade-role"],[data-testid="trade-progress-overlay"],.build-dashboard'),width:document.documentElement.scrollWidth,viewport:innerWidth}));
      Object.assign(row,facts);assert.deepEqual(row.privateAssets,[]);assert.equal(row.privateUi,false);assert.ok(row.width<=row.viewport+1);
      if(view!=='pitch')assert.ok(!/\b(MUR|GBP|USD|EUR|courts mammouth|espace maison)\b|[$£€]/i.test(await p.locator('body').innerText()),'public money or retailer name');
      assertClean(log);row.pass=true;
    }catch(e){row.pass=false;row.error=String(e).slice(0,500);}
    finally{await context.close();save('public-routes',{rows});}
    console.log(JSON.stringify({width,path,view,pass:row.pass,error:row.error}));
  }
}finally{await browser.close();}
if(rows.some(r=>!r.pass))process.exitCode=1;
