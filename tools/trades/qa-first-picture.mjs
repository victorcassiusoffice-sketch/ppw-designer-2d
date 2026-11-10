// Fixed campaign: three adjacent, alternating-order pairs at each viewport.
// Run only after local builds and all other test/browser campaigns are idle.
// Keep failed/slower rows; never rerun a timing-only change to select a better result.
import {acquireRun,assert,base,launch,localContext,olb,save,saveRaw,assertClean} from './qa-local.mjs';
acquireRun('part6-public-first-picture');
const median=a=>a.toSorted((x,y)=>x-y)[Math.floor(a.length/2)];
const pairs=[], raw=[];
const report={started:new Date().toISOString(),base,candidate:olb,method:'Three fixed pairs per width, new Chromium process and profile on every navigation; no artificial CPU/network throttle. AB/BA orders alternate and flip between widths. Empty app APIs / offline FX equally on both. Global World timing lock. First canvas render mark and external GL-ready + loader-hidden wall time independently reported. No warmup, no sample exclusions.',pairs};
for(let n=1;n<=3;n++) for(const width of [1280,390]){
  const pair={n,width,rows:[]};pairs.push(pair);
  const targets=(n+(width===390?1:0))%2?['base','candidate']:['candidate','base'];
  for(const target of targets){
    const browser=await launch();const row={target,at:new Date().toISOString()};pair.rows.push(row);
    try{
      const {context,log}=await localContext(browser,width);
      await context.addInitScript(()=>{window.__olbLoad={seen:null,ready:null};const t=setInterval(()=>{
        const loading=[...document.querySelectorAll('[data-testid="loading-3d"]')].some(e=>e.getBoundingClientRect().width&&getComputedStyle(e).visibility!=='hidden');
        if(loading)window.__olbLoad.seen??=performance.now();
        if(!loading&&document.querySelector('[data-first-picture-ms]')){window.__olbLoad.ready??=performance.now();clearInterval(t);}
      },20);});
      const p=await context.newPage();p.setDefaultTimeout(90000);
      const start=performance.now(),url=(target==='base'?base:olb)+'/demo?view=3d&pitch=1';
      const resp=await p.goto(url,{waitUntil:'domcontentloaded'});row.status=resp?.status();
      await p.locator('[data-testid="wallpaint-3d-gl"][data-first-picture-ms]').waitFor();await p.getByTestId('loading-3d').waitFor({state:'hidden'});row.wallMs=Math.round(performance.now()-start);
      const data=await p.evaluate(()=>{const gl=document.querySelector('[data-testid="wallpaint-3d-gl"]');
        const render=Number(gl.dataset.firstPictureMs);const resources=performance.getEntriesByType('resource').filter(r=>r.startTime<render).map(r=>({path:new URL(r.name).pathname,ms:r.startTime,end:r.responseEnd,bytes:r.transferSize}));return {canvasMs:Math.round(render),loaderMs:Math.round(window.__olbLoad.seen??-1),resources,privateAssets:resources.filter(r=>r.path.includes('/assets/studio/')).length};});
      const {resources,...metrics}=data;Object.assign(row,metrics);row.errors=[...log.consoleErrors,...log.pageErrors,...log.httpErrors,...log.failedRequests,...log.attemptedWrites];
      raw.push({n,width,target,resources,log});assertClean(log);assert.ok(row.canvasMs>0);assert.equal(row.status,200);assert.equal(row.privateAssets,0);
      await context.close();
    }catch(e){row.error=String(e).slice(0,500);}
    finally{await browser.close();}
    save('first-picture',report);saveRaw('first-picture-resources',raw);console.log(JSON.stringify({n,width,...row}));
  }
}
report.ended=new Date().toISOString();
report.summary=[1280,390].map(width=>{const rows=pairs.filter(p=>p.width===width);
  const good=rows.length===3&&rows.every(p=>p.rows.length===2&&p.rows.every(r=>!r.error));if(!good)return {width,pass:false,reason:'A required navigation failed.'};
  const metric=(target,key)=>median(rows.map(p=>p.rows.find(r=>r.target===target)[key]));
  const facts={width,baseCanvasMs:metric('base','canvasMs'),candidateCanvasMs:metric('candidate','canvasMs'),baseWallMs:metric('base','wallMs'),candidateWallMs:metric('candidate','wallMs'),baseLoadingMs:metric('base','loaderMs'),candidateLoadingMs:metric('candidate','loaderMs')};
  const differences=rows.map(p=>p.rows.find(r=>r.target==='candidate').canvasMs-p.rows.find(r=>r.target==='base').canvasMs);
  return {...facts,pairedCanvasDeltaMs:differences,medianPairedCanvasDeltaMs:median(differences),canvasNoSlower:facts.candidateCanvasMs<=facts.baseCanvasMs,wallNoSlower:facts.candidateWallMs<=facts.baseWallMs,pass:facts.candidateCanvasMs<=facts.baseCanvasMs&&facts.candidateWallMs<=facts.baseWallMs};
});
save('first-picture',report);console.log(JSON.stringify(report.summary));if(report.summary.some(r=>!r.pass))process.exitCode=1;
