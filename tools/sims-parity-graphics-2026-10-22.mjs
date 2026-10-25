/** Local compiled-build graphics evidence. No application hooks or live writes.
 * Run: node tools/sims-parity-graphics-2026-10-22.mjs before http://127.0.0.1:5175
 * Frames are ThreeStage's existing data-shading mutations AFTER renderer.render,
 * not idle requestAnimationFrame callbacks. The same fixtures/bookmarks serve after.
 */
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync, readFileSync, readdirSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const phase = process.argv[2] ?? 'before';
const base = process.argv[3] ?? 'http://127.0.0.1:5175';
if (!['before', 'after'].includes(phase) || !['127.0.0.1', 'localhost'].includes(new URL(base).hostname)) throw Error('Local before/after QA only');
const out = `docs/qa-sims-parity-2026-10-22/${phase}-graphics`;
mkdirSync(out, { recursive: true });
const item = (id, productId, x, y, rotation = 0) => ({ instanceId: id, productId, x, y, rotation });
const room = (id, w, d, placedItems) => ({ id, name: id, polygon: [{x:0,y:0},{x:w,y:0},{x:w,y:d},{x:0,y:d}], placedItems,
  wallPaint: [0,1,2,3].map(edgeIndex => ({edgeIndex,paintId:'permoglaze-soft-feel',colourHex:'#D9D5C5',colourName:'Warm ivory'})),
  openings: [{id:`${id}-window`,kind:'window',edgeIndex:0,offsetM:w-1.6,widthM:1.2,heightM:1.5,sillM:.8,flipHand:false,flipFacing:false},
    {id:`${id}-door`,kind:'door',edgeIndex:3,offsetM:.5,widthM:.9,flipHand:false,flipFacing:false}] });
const make = (id, r, extra={}) => ({id:`qa-sims-${id}`,name:`QA ${id}`,activeRoomId:r.id,wallHeightM:2.7,activeLevelId:'ground',rooms:[r],...extra});
// Existing main-branch catalog identities and envelopes. No PR49-only GLBs.
const fixtures = [
  { name:'furnished-room', property:make('furnished',room('living',6,4,[item('sofa','courts-comfy-3-seater-dove',.45,.25),item('coffee','courts-perera-coffee-table',1,1.7),item('sideboard','courts-lavis-sideboard',4.35,.2)])), dimensions:'6 × 4 m; Comfy 2.30 × 0.94 × 0.94 m; Perera 1.20 × 0.60 × 0.43 m' },
  { name:'kitchen-dining', property:make('kitchen',room('dining',5,4,[item('dining','courts-gessica-dining-6',1.1,1.3),item('fridge','courts-samsung-rb33-fridge',4.2,.15),item('sideboard','courts-lavis-sideboard',.2,.15)])), dimensions:'5 × 4 m; Gessica chairs-included planning footprint 2.40 × 1.80 × 0.74 m; fridge 0.60 × 0.67 × 1.78 m' },
  { name:'bathroom', property:make('bathroom',room('bath',3,3,[item('toilet','espace-emilia-toilet-bowl',.3,.3),item('basin','espace-durastyle-washbasin-800',1.7,.08),item('bidet','espace-duravit-dcode-bidet-224110',.3,1.4)])), dimensions:'3 × 3 m; bowl 0.650 × 0.395 × 0.400 m; basin 0.800 × 0.480 × 0.170 m; bidet 0.560 × 0.360 × 0.385 m' },
  { name:'outside', property:make('outside',room('garden-room',4,3,[item('garden-sofa','espace-seville-garden-sofa',.5,.3),item('tank','resiglas-water-tank-1000-c',5,.4)]),{site:{widthM:9,depthM:7,originM:{x:-1.5,y:-1.5}},garden:{surfaces:[{id:'lawn',kind:'lawn',x:-1.5,y:-1.5,widthM:9,depthM:7,elevationM:0},{id:'path',kind:'concrete',x:-.5,y:3,widthM:6.5,depthM:1,elevationM:.04}],fences:[]}}), dimensions:'4 × 3 m room on 9 × 7 m site; Seville sofa 1.140 × 0.670 × 0.870 m; Resiglas tank 1.320 × 1.320 × 1.055 m' },
];
const vendor = readdirSync('dist/assets').find(name=>/^vendor-three-.*\.js$/.test(name));
const report = { phase, base, capturedAt:new Date().toISOString(), sourceHead:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),
  sourceWorkingTreeDirty:Boolean(execFileSync('git',['status','--porcelain'],{encoding:'utf8'}).trim()),compiledIndexSha256:createHash('sha256').update(readFileSync('dist/index.html')).digest('hex'),
  rendererAttempt:'Native D3D11 on Windows (default headless fell back to SwiftShader; initial probe preserved separately). Explicit SwiftShader only if native attempt has no WebGL2.', vendorThree:{file:vendor,bytes:readFileSync(`dist/assets/${vendor}`).length,gzipBytes:gzipSync(readFileSync(`dist/assets/${vendor}`)).length},
  methodology:'Cold browser contexts, network cache disabled. First paint is first existing ThreeStage data-shading mutation after render. FPS counts those mutations while continuous real pointer orbit is active, including event dispatch overhead. This is observed app rendering throughput, not idle RAF or certified physical-device performance.',
  fixtures, cases:[] };
let browser = await chromium.launch({headless:true,args:process.platform==='win32'?['--use-angle=d3d11','--enable-gpu','--ignore-gpu-blocklist']:['--enable-gpu']});
const probe = await browser.newPage();
const probeResult = await probe.evaluate(()=>{const gl=document.createElement('canvas').getContext('webgl2');if(!gl)return null;const ext=gl.getExtension('WEBGL_debug_renderer_info');return{renderer:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),vendor:ext?gl.getParameter(ext.UNMASKED_VENDOR_WEBGL):gl.getParameter(gl.VENDOR)};});
await probe.close();
report.nativeProbe = probeResult;
if (!probeResult) { await browser.close(); browser = await chromium.launch({headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']}); report.explicitSoftwareFallback=true; }
const save = () => writeFileSync(`${out}/report.json`,JSON.stringify(report,null,2));
try {
  for (const fixture of fixtures) for (const [device, viewport] of [['desktop',{width:1280,height:900}],['phone',{width:390,height:844}]]) {
    const context = await browser.newContext({viewport,isMobile:device==='phone',hasTouch:device==='phone',deviceScaleFactor:1});
    const row = {scene:fixture.name,device,viewport,cpuThrottle:device==='phone'?4:1,consoleErrors:[],pageErrors:[],failedResponses:[],blockedWrites:[],apiRequests:[],screenshots:[]};report.cases.push(row);save();
    try {
      await context.addInitScript(property=>{
        localStorage.clear();localStorage.setItem('ppw_designer_coach_v1','1');localStorage.setItem('ppw_room_lighting_v1','natural');
        localStorage.setItem('ppw_property_v2',JSON.stringify({version:2,state:{property,pxPerMetre:85,showGrid:false}}));
        window.__graphicsQA={frames:[],firstFrame:null};
        new MutationObserver(records=>{for(const change of records)if(change.attributeName==='data-shading'&&change.target.matches('[data-testid="wallpaint-3d-gl"]')){const now=performance.now();window.__graphicsQA.firstFrame??=now;window.__graphicsQA.frames.push(now);}}).observe(document,{subtree:true,attributes:true,attributeFilter:['data-shading']});
      },fixture.property);
      const page=await context.newPage();page.setDefaultTimeout(60000);
      const cdp=await context.newCDPSession(page);await cdp.send('Network.enable');await cdp.send('Network.setCacheDisabled',{cacheDisabled:true});await cdp.send('Emulation.setCPUThrottlingRate',{rate:row.cpuThrottle});
      page.on('console',msg=>{if(msg.type()==='error')row.consoleErrors.push(msg.text());});page.on('pageerror',e=>row.pageErrors.push(e.message));
      page.on('request',request=>{const url=new URL(request.url());if(url.pathname.startsWith('/api/')||url.hostname.startsWith('api.'))row.apiRequests.push({method:request.method(),url:`${url.origin}${url.pathname}`});});
      page.on('response',response=>{if(response.status()>=400)row.failedResponses.push({url:response.url(),status:response.status()});});
      await page.route('**/*',async route=>{if(!['GET','HEAD','OPTIONS'].includes(route.request().method())){row.blockedWrites.push({url:route.request().url(),method:route.request().method()});await route.abort();}else await route.continue();});
      await page.goto(`${base}/designer?view=3d&pitch=1`,{waitUntil:'domcontentloaded'});
      // Saved ordinary /designer projects boot in Plan. Enter 3D by the same
      // accessible control as a person; URL-only view applies to demo routes.
      await page.getByRole('button',{name:'3D House',exact:true}).waitFor();
      row.activationMs=await page.evaluate(()=>performance.now());
      await page.getByRole('button',{name:'3D House',exact:true}).click();
      await page.locator('[data-testid="wallpaint-3d-gl"][data-shading]').waitFor();
      await page.getByTestId('loading-3d').waitFor({state:'hidden'});
      await page.waitForLoadState('networkidle',{timeout:20000}).catch(()=>{});await page.waitForTimeout(1500);
      row.firstFrameFromNavigationMs=await page.evaluate(()=>window.__graphicsQA.firstFrame);
      row.firstPaintMs=row.firstFrameFromNavigationMs-row.activationMs;
      row.settledCaptureMs=await page.evaluate(()=>performance.now());
      row.renderer=await page.getByTestId('wallpaint-3d-gl').evaluate(canvas=>{const gl=canvas.getContext('webgl2');const ext=gl.getExtension('WEBGL_debug_renderer_info');return{renderer:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),vendor:ext?gl.getParameter(ext.UNMASKED_VENDOR_WEBGL):gl.getParameter(gl.VENDOR),shading:canvas.dataset.shading,pixelWidth:canvas.width,pixelHeight:canvas.height};});
      row.softwareRenderer=/swiftshader|llvmpipe|software|basic render/i.test(row.renderer.renderer);
      row.camera=JSON.parse(await page.getByTestId('wallpaint-3d-canvas').getAttribute('data-camera'));
      row.renderCamera=JSON.parse(await page.getByTestId('wallpaint-3d-canvas').getAttribute('data-render-camera'));
      row.propertyBefore=await page.evaluate(()=>JSON.parse(localStorage.getItem('ppw_property_v2')).state.property);
      row.horizontalOverflowPx=await page.evaluate(()=>Math.max(0,document.documentElement.scrollWidth-innerWidth));
      const shot=`${out}/${fixture.name}-${device}.png`;await page.screenshot({path:shot});row.screenshots.push(shot);
      const stage=await page.getByTestId('wallpaint-3d-canvas').boundingBox();
      if(!stage || stage.height<80)throw Error('3D interaction surface too small');
      const cx=stage.x+stage.width*.5,cy=stage.y+stage.height*.5;
      await page.mouse.move(cx,cy);await page.mouse.down({button:'right'});
      const start=await page.evaluate(()=>{window.__graphicsQA.frames=[];return performance.now();});
      let inputSteps=0;const wallStart=Date.now();
      while(Date.now()-wallStart<10000){inputSteps++;const seconds=(Date.now()-wallStart)/1000;await page.mouse.move(cx+Math.sin(seconds*1.5)*Math.min(70,stage.width*.17),cy+Math.cos(seconds)*Math.min(20,stage.height*.08));}
      const end=await page.evaluate(()=>performance.now());await page.mouse.up({button:'right'});
      const frames=await page.evaluate(()=>window.__graphicsQA.frames);
      const active=frames.filter(t=>t>=start&&t<=end),intervals=active.slice(1).map((t,i)=>t-active[i]).sort((a,b)=>a-b);
      row.motion={durationMs:end-start,renderedFrames:active.length,fps:active.length*1000/(end-start),medianFrameMs:intervals[Math.floor(intervals.length*.5)]??null,p95FrameMs:intervals[Math.floor(intervals.length*.95)]??null,inputSteps};
      row.cameraAfterOrbit=JSON.parse(await page.getByTestId('wallpaint-3d-canvas').getAttribute('data-camera'));
      row.geometryUnchanged=await page.evaluate(before=>JSON.stringify(before)===JSON.stringify(JSON.parse(localStorage.getItem('ppw_property_v2')).state.property),row.propertyBefore);
      delete row.propertyBefore;
      row.hardwareTargetAssessment=row.softwareRenderer?'Not established: software renderer is not physical laptop/phone hardware':row.motion.fps>=(device==='phone'?30:60)?'Observed target met in this controlled browser run':'Observed target not met in this controlled browser run';
      row.firstPaintTargetMet=row.firstPaintMs<3000;
    } catch(error) {row.failure=String(error.stack??error);} finally {await context.close();save();console.log(JSON.stringify(row));}
  }
} finally {await browser.close();save();}
const escape=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
writeFileSync(`${out}/index.html`,`<!doctype html><meta charset="utf-8"><title>Sims parity ${phase} graphics evidence</title><style>body{font:16px system-ui;background:#20282e;color:#edf1f3;margin:24px}section{margin-bottom:32px}img{max-width:100%;border:1px solid #76828b}.shots{display:grid;grid-template-columns:minmax(0,1280px) minmax(230px,390px);gap:16px}p{max-width:1000px;line-height:1.5}small{color:#c3d2d7}code{white-space:pre-wrap}</style><h1>${phase} · fixed graphics bookmarks</h1><p>${escape(report.methodology)} Software-rendered measurements do not establish the physical 60/30 FPS targets.</p>${fixtures.map(f=>`<section><h2>${f.name}</h2><p>${escape(f.dimensions)}</p><div class="shots">${report.cases.filter(r=>r.scene===f.name).map(r=>`<div><h3>${r.device} · ${r.motion?.fps?.toFixed(1)??'not measured'} rendered FPS</h3><p>First render: ${r.firstPaintMs?.toFixed(0)??'?'} ms · CPU ×${r.cpuThrottle}<br><small>${escape(r.renderer?.renderer??r.failure)}</small></p><img src="${f.name}-${r.device}.png" alt="Actual ${f.name} ${r.device} before image"></div>`).join('')}</div></section>`).join('')}`);
