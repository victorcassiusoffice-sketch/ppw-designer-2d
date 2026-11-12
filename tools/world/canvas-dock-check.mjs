// Browser proof for the drawing surface, snap gestures and mutually exclusive panels.
// Hosted verification is read-only; every API write is blocked before it can leave Chromium.
import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';

const [origin, out, expectedHead] = process.argv.slice(2);
if (!origin || !out) throw Error('Supply the app origin and an evidence folder.');
const host = new URL(origin).hostname, local = ['127.0.0.1', 'localhost'].includes(host);
if (!local && !expectedHead) throw Error('Supply the immutable preview commit.');
const args = ['--use-angle=d3d11','--ignore-gpu-blocklist'];
if (process.env.OLB_VERIFY_EDGE_IP) args.push('--host-resolver-rules=MAP ' + host + ' ' + process.env.OLB_VERIFY_EDGE_IP);
const browser = await chromium.launch({ args });
await fs.mkdir(out, {recursive:true});
const rows = [], errors = [], writes = [];
const box = async l => { const b = await l.boundingBox(); assert(b); return b };
const overlaps = (a,b) => a.x < b.x+b.width && b.x < a.x+a.width && a.y < b.y+b.height && b.y < a.y+a.height;
try {
 for (const [width,height] of [[313,567],[400,844],[1180,820],[390,844],[1280,800]]) {
  const ctx = await browser.newContext({ viewport:{width,height},hasTouch:width<600,serviceWorkers:'block' });
  try {
   await ctx.addInitScript(()=>localStorage.setItem('ppw_designer_coach_v1','1'));
   await ctx.route('**/*', route => {
    const req = route.request();
    if (!['GET','HEAD'].includes(req.method())) { writes.push(req.method()+' '+new URL(req.url()).pathname); return route.abort(); }
    return route.continue();
   });
   const p=await ctx.newPage(); p.setDefaultTimeout(12000);
   p.on('pageerror',e=>errors.push(e.message)); p.on('console',m=>{if(m.type()==='error')errors.push(m.text().slice(0,120))});
   if (!local) {
    const res=await p.goto(origin+'/api/healthcheck?dock='+Date.now());assert.equal((await res.json()).commit,expectedHead);
   }
   await p.goto(origin+'/demo?view=2d&pitch=1');await p.locator('.konvajs-content canvas').first().waitFor();
   const dock = view => p.locator('.canvas-edge-dock[data-workspace="'+view+'"]:visible');
   const row={width,height};rows.push(row);
   const button=(n,scope=p)=>scope.getByRole('button',{name:n,exact:true});
   async function move(view,to) {
    const d=dock(view),grip=d.locator('.edge-dock-grip'), g=await box(grip);
    const parent=await box(d.locator('..'));const x=g.x+g.width/2,start=g.y+g.height/2,end=parent.y+(to==='bottom'?0.82:0.18)*parent.height;
    if(width<600) {
     const cdp=await ctx.newCDPSession(p);
     const send=(type,y)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:y==null?[]:[{x,y,id:1}]});
     try {await send('touchStart',start);await send('touchMove',(start+end)/2);await send('touchMove',end);await send('touchEnd');} finally {await cdp.detach()}
    } else {
     await p.mouse.move(x,start);await p.mouse.down();await p.mouse.move(x,end,{steps:8});await p.mouse.up();
    }
    assert.equal(await d.getAttribute('data-edge'),to,view+' drag');
   }
   const wall=p.getByTestId('wall-tool-toggle').first();
   if(!await wall.isVisible())await button('Build').first().click();await wall.click();
   const viewport=p.getByTestId('plan-drawing-viewport').first();
   await move('plan','bottom');
   let v=await box(viewport),d=await box(dock('plan'));assert(!overlaps(v,d),'plan covers drawing');
   row.planWallCanvasPx=Math.round(v.height);row.planWallDockPx=Math.round(d.height);
   assert(v.height>height*.47,'plan lost half its height');
   const walls=p.getByTestId('room-draw-hud');await walls.waitFor();
   await p.mouse.click(v.x+v.width*.27,v.y+v.height*.38);
   await p.mouse.click(v.x+v.width*.62,v.y+v.height*.38);
   await p.screenshot({path:path.join(out,'plan-'+width+'.jpg'),type:'jpeg',quality:65});
   const finish=p.getByTestId('room-draw-finish-walls');
   assert(await finish.isEnabled(),'two corners must form a wall');
   await finish.click();
   assert.equal(await walls.isVisible(),false,'finished wall is still armed');
   await dock('plan').locator('.edge-dock-grip').focus();await p.keyboard.press('Enter');assert.equal(await dock('plan').getAttribute('data-edge'),'top','keyboard redock');
   await p.goto(origin+'/demo?view=3d&pitch=1');await p.locator('[data-first-picture-ms]').first().waitFor({timeout:60000});
   await move('house','bottom');
   const walls3=p.getByTestId('house-draw-walls');if(!await walls3.isVisible())await button('Build tools').click();await walls3.click();
   const surface=p.getByTestId('wallpaint-3d-canvas').first();
   const h=await box(surface),hd=await box(dock('house'));
   assert(!overlaps(h,hd),'house toolbar covers canvas');row.houseWallCanvasPx=Math.round(h.height);
   assert(h.height>height*.39,'house canvas too small');
   await p.screenshot({path:path.join(out,'house-'+width+'.jpg'),type:'jpeg',quality:65});
   await p.reload();await p.locator('[data-first-picture-ms]').first().waitFor({timeout:60000});assert.equal(await dock('house').getAttribute('data-edge'),'bottom','remember House edge');
   await button('Open Walk mode').click();await button('Start walk').click();await dock('walk').waitFor({timeout:55000});
   const wd=await box(dock('walk'));row.walkToolbarPx=Math.round(wd.height);assert(wd.height<=55,'Walk toolbar wrapped');
   await move('walk','bottom');
   await button('Dig / fill',dock('walk')).click();await p.getByTestId('earthworks-panel').waitFor();
   assert(!overlaps(await box(p.getByTestId('earthworks-panel')),await box(dock('walk'))),'Earthworks covers dock');
   await button('Components',dock('walk')).click();await p.getByTestId('boundary-editor').waitFor();assert.equal(await p.getByTestId('earthworks-panel').count(),0,'stale earthworks');
   await button('Shared build',dock('walk')).click();await p.getByTestId('shared-build-panel').waitFor();assert.equal(await p.getByTestId('boundary-editor').count(),0,'stale components');
   assert(!overlaps(await box(p.getByTestId('shared-build-panel')),await box(dock('walk'))),'shared panel covers toolbar');
   await p.keyboard.press('Escape');await p.getByTestId('shared-build-panel').waitFor({state:'detached'});assert(await dock('walk').isVisible(),'Esc left Walk instead of closing its panel');
   if(width<600){const more=dock('walk').locator('.edge-dock-more');await more.click();assert(await dock('walk').locator('.edge-dock-scroll').evaluate(e=>e.scrollLeft>0),'overflow unreachable')}
   await move('walk','top');await p.screenshot({path:path.join(out,'walk-'+width+'.jpg'),type:'jpeg',quality:65});
   assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
   row.pass=true;console.log(width,JSON.stringify(row));
  } finally {await ctx.close()}
 }
 assert.equal(writes.length,0);assert.deepEqual(errors,[]);
} finally {
 await fs.writeFile(path.join(out,'dock-report.json'),JSON.stringify({origin,expectedHead,rows,errors,writes},null,2));
 await browser.close();
}
