import { chromium, expect, assert, localContext, olb, saveEvidence } from './qa-helpers.mjs';
// The integration is entirely absent from public entry graphs. These URL
// attempts are against our own compiled server; no passcode is submitted.
const browser=await chromium.launch({headless:true,args:['--use-angle=d3d11','--enable-gpu','--ignore-gpu-blocklist']});
const rows=[];
try {
  for(const width of [1280,390]) for(const [path,view] of [['/demo','2d'],['/demo','3d'],['/embed/designer','2d'],['/embed/designer','3d'],['/pitch/plumbing','pitch']]){
    const {context,network}=await localContext(browser,width,false);const page=await context.newPage();
    page.setDefaultTimeout(45000);
    const row={width,path,view,network};rows.push(row);
    try {
      const response=await page.goto(olb+path+'?view='+view+'&pitch=1&panel=build#w=not-a-real-answer');
      assert.equal(response?.status(),200);
      if(view==='pitch') await page.getByRole('heading').first().waitFor();
      else await page.getByTestId(view==='3d'?'wallpaint-3d-gl':'plan-drawing-viewport').waitFor();
      if(view==='3d')await page.getByTestId('loading-3d').waitFor({state:'hidden'});
      assert.equal(await page.getByRole('heading',{name:'Build dashboard'}).count(),0);
      const publicText=await page.locator('body').innerText();
      if(view!=='pitch') assert.ok(!/\b(MUR|GBP|USD|EUR|rs\.|courts mammouth|espace maison)\b|[$£€]/i.test(publicText),'public money or retailer text');
      const resources=await page.evaluate(()=>performance.getEntriesByType('resource').map(r=>new URL(r.name).pathname));
      row.privateRequests=resources.filter(s=>/BuildDashboard|PackageInspector|jobPack|linkStore|private-entry|uqr|TradeFolder|\/assets\/studio\/|\/studio-assets\//i.test(s));
      assert.deepEqual(row.privateRequests,[]);
      assert.deepEqual(network.errors,[]);assert.deepEqual(network.pageErrors,[]);assert.deepEqual(network.attemptedWrites,[]);assert.deepEqual(network.httpErrors,[]);
      row.pass=true;
    }catch(e){row.pass=false;row.failure=String(e);}
    finally{await context.close()}
  }
}finally{await browser.close();saveEvidence('public-routes',{rows});}
console.log(JSON.stringify(rows));if(rows.some(r=>!r.pass))process.exitCode=1;
