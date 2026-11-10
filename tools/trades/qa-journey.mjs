// Node >=22, run from the repo root, only against this campaign's two local apps.
// Seed a measured project only: jobs, pins, history, approvals and trade files
// must all be produced by the actual user interfaces.
import {writeFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {build} from 'esbuild';
import {planPoint,housePoint} from '../authoring-coordinates.mjs';
import {acquireRun,assert,b,capture,dlg,downloadJson,expect,inspectLayout,launch,localContext,olb,physical,realQuote,save,scratch,smallPhoto,upload,assertClean} from './qa-local.mjs';

acquireRun('part6-local-work-file-journey');
const widths=(process.argv[2]||'1280,390,313').split(',').map(Number);
const shower='Shower wall connection',kitchen='Kitchen conduit check',plumber='Ari · QA',electrician='Sofia · QA';
const instant=()=>new Date().toISOString(),day=()=>instant().slice(0,10);
const signerPath=resolve(scratch,'pinned-protocol.cjs');
await build({entryPoints:['src/designer/link/vendor/tradefolder/lib/jobPack/protocol.ts'],bundle:true,platform:'node',format:'cjs',outfile:signerPath,logLevel:'silent'});
const protocol=createRequire(import.meta.url)(signerPath);
const dashboard=p=>dlg(p,'Build dashboard'),role=(p,v)=>p.getByTestId('trade-role').selectOption(v);
const workRow=(p,title)=>p.getByTestId('trade-work-row').filter({hasText:title});
const lastSheet=p=>p.locator('.bd-sheet[open]').last(), closeSheet=p=>lastSheet(p).locator('header button').first().click();
const events=p=>p.evaluate(()=>JSON.parse(localStorage.getItem('olb_link_packages_v1')||'{"events":[]}').events);
const overlay=p=>p.getByTestId('trade-progress-overlay').filter({visible:true});
async function layout(el,row,note){row.layout.push({note,...await inspectLayout(el)});}

async function openDashboard(p,row){
  await p.goto(olb+'/designer');await p.getByTestId('plan-drawing-viewport').locator('canvas').first().waitFor();
  const image=await smallPhoto(p);
  await p.goto(olb+'/designer?panel=build');await expect(dashboard(p)).toBeVisible();
  assert.equal(await p.getByTestId('trade-role').locator('option').count(),14);
  for(const id of ['owner','painting','tiling','flooring','plaster','waterproofing','plumbing','electrical','carpentry','repairs','builder','architect','engineer','supplier']){
    assert.equal(await p.getByTestId('trade-role').locator('option[value="'+id+'"]').count(),1);
  }
  await b(dashboard(p),'Make packages').click();const flow=dlg(p,'Make packages from this plan');
  await flow.getByLabel('Company name').fill('Example site team');await flow.getByLabel('Site or plot label').fill('Courtyard plot');await b(flow,'Create draft packages').click();
  await expect(flow).toHaveCount(0);await role(p,'plumbing');await expect(workRow(p,/Plumbing, Ground floor/i)).toBeVisible();
  assert.equal(await workRow(p,/Electrical, Ground floor/i).count(),0);
  await layout(dashboard(p),row,'plumber packages');
  row.contrast=await dashboard(p).evaluate(el=>{
    const lum=rgb=>{const c=rgb.match(/[\d.]+/g).slice(0,3).map(Number).map(n=>n/255).map(n=>n<=.04045?n/12.92:((n+.055)/1.055)**2.4);return .2126*c[0]+.7152*c[1]+.0722*c[2]};
    const style=getComputedStyle(el);
    const colour=value=>{const span=document.createElement('span');el.append(span);span.style.color=value;const v=getComputedStyle(span).color;span.remove();return lum(v)};
    const paper=colour(style.getPropertyValue('--bd-paper')),panel=colour(style.getPropertyValue('--bd-panel'));
    const ratio=(a,b)=>(Math.max(a,b)+.05)/(Math.min(a,b)+.05);
    return {theme:document.documentElement.dataset.uiTheme,body:ratio(lum(style.color),paper),secondary:ratio(colour(style.getPropertyValue('--bd-muted')),panel)};
  });
  assert.ok(row.contrast.body>=4.5 && row.contrast.secondary>=4.5,JSON.stringify(row.contrast));
  return image;
}
async function jobEditor(p,row,{name,who,note,status,view,image}){
  const sheet=dlg(p,'Add a pinned job');await expect(sheet).toBeVisible();
  await sheet.getByLabel('Job name',{exact:true}).fill(name);await sheet.getByLabel('Short note',{exact:true}).fill(note);
  await sheet.getByLabel('Recorded by',{exact:true}).fill(who);await sheet.getByLabel('Status',{exact:true}).selectOption(status);
  await sheet.getByLabel('Start date',{exact:true}).fill(day());await sheet.getByLabel('Due date',{exact:true}).fill(new Date(Date.now()+14*86400000).toISOString().slice(0,10));
  if(image){await sheet.getByLabel('Job photo',{exact:true}).setInputFiles(image);await expect(sheet.getByAltText('Attached job photo')).toBeVisible();}
  await layout(sheet,row,name+' editor');
  const before=(await events(p)).length;
  await b(sheet,view==='plan'?'Pin on plan':'Pin in 3D').click();
  const pick=overlay(p);await expect(pick).toBeVisible();await expect(pick).toHaveAttribute('data-mode','pick');
  if(view==='house'){await p.locator('[data-testid="wallpaint-3d-gl"][data-first-picture-ms]').waitFor();await p.getByTestId('loading-3d').waitFor({state:'hidden'});}
  const target=p.getByTestId('trade-pin-target');await target.waitFor();const bounds=await target.boundingBox();
  // The existing authored coordinates helper reads the live viewport transform /
  // rendered camera, not a dev hook or persisted job. Choose a REAL screen
  // position in the bathroom wall or kitchen, away from a dock/legend.
  let point=null,world=null;
  const candidates=view==='plan'?[[0,1.60,0],[0,1.00,0],[0,2.38,0]]:[[4.2,1.55,0],[4.8,2.25,0],[4.1,0,1.25],[3.55,1.05,0],[5.3,2,0]];
  for(const candidate of candidates){const pt=view==='plan'?await planPoint(p,candidate[0],candidate[1]):await housePoint(p,...candidate);
    if(!bounds||pt.x<=bounds.x+2||pt.y<=bounds.y+2||pt.x>=bounds.x+bounds.width-2||pt.y>=bounds.y+bounds.height-2)continue;
    const hit=await target.evaluate((el,pt)=>el.contains(document.elementFromPoint(pt.x,pt.y)),pt);
    if(hit){point=pt;world=candidate;break;}
  }
  assert.ok(point,'No unobstructed map target at measured '+name+' positions. Target bounds '+JSON.stringify(bounds));
  await physical(p,row.width,point.x,point.y);await expect(sheet).toBeVisible();await expect(sheet).toContainText('Pinned to olb:');
  assert.equal((await events(p)).length,before,'Picking a position must not save the job');
  const actual=(await sheet.innerText()).match(/Pinned to (olb:[^\s]+)/)?.[1];assert.ok(actual);
  if(view==='plan')assert.equal(actual,'olb:wall:wall-bath-3');
  else assert.ok(/^olb:(?:room:kitchen|wall:wall-kitchen-|item:board)/.test(actual),'Actual House hit was not kitchen work: '+actual);
  await b(sheet,'Save job').click();await expect(sheet).toHaveCount(0);
  await expect(dlg(p,name)).toBeVisible();await expect(dlg(p,name)).toContainText(who);
  const e=(await events(p)).find(e=>e.kind==='trade-job'&&e.input.title===name);
  assert.ok(e&&e.input.pin&&e.input.by===who&&e.input.status===status);
  assert.equal(e.input.pin.planRef,actual); if(image)assert.ok(e.input.photo?.ref.startsWith('data:image/'));
  row.picks.push({name,view,world,point,actual,effectivePin:e.input.pin,actor:who,status,photoBytes:e.input.photo?.sizeBytes??0});
  return e.input;
}
async function openWorkFile(p,title){await workRow(p,title).click();await b(dlg(p,title),'Open work file').click();return lastSheet(p);}
async function transferOut(p,row,field){
  const inspector=await openWorkFile(p,shower),author=inspector.getByLabel('Recorded by',{exact:true});if(await author.count())await author.fill(plumber);
  await b(inspector,'Build work file').click();
  const {name,body:work}=await downloadJson(p,()=>b(inspector,'Download work file').click());
  assert.match(name,/\.olbpackage\.json$/);assert.equal(work.type,'ppw-work-package');assert.equal(work.v,1);assert.equal(work.request.trade,'plumbing');
  const request=await protocol.parsePack(work.request,instant());
  assert.equal(request.id,work.planView.requestId);assert.equal(work.planView.package.id,field.id);
  assert.ok(request.quantities.some(q=>q.planRef===field.pin.planRef),'job pin is not a request plan reference');
  assert.deepEqual(request.quantities,work.planView.quantities);assert.ok(work.planView.highlights.includes(field.pin.planRef));
  assert.ok(request.photos?.some(photo=>photo.ref===field.photo.ref),'Uploaded job photo not in v1 work file');
  await closeSheet(p);row.file={bytes:Buffer.byteLength(JSON.stringify(work)),requestHash:request.sha256,planViewHash:work.planView.sha256,planRef:field.pin.planRef,photoBytes:field.photo.sizeBytes};
  return work;
}
async function addAnswer(p,answer){
  await b(dashboard(p),'Add an answer').click();const sheet=dlg(p,'Add an answer'),before=(await events(p)).length;
  await sheet.getByLabel('Answer file').setInputFiles(upload(answer,'answer.json'));
  await expect(sheet.getByRole('heading',{name:answer.kind+' from '+answer.from.label})).toBeVisible();assert.equal((await events(p)).length,before);
  await b(sheet,'Save answer').click();await expect(sheet).toHaveCount(0);assert.equal((await events(p)).length,before+1);
}
async function mapEvidence(p,row,view,fields,phase){
  await b(dashboard(p),view==='plan'?'Progress on plan':'Progress in 3D').click();
  const map=overlay(p);await expect(map).toBeVisible();await expect(map).toHaveAttribute('data-mode','map');
  if(view==='house'){await p.locator('[data-testid="wallpaint-3d-gl"][data-first-picture-ms]').waitFor();await p.getByTestId('loading-3d').waitFor({state:'hidden'});}
  const shows=[];
  for(const f of fields){
    const selector='[data-plan-ref="'+f.pin.planRef+'"][data-status="'+f.status+'"]';
    const shape=map.getByTestId('trade-progress-shapes').locator(selector+'[data-work-id="'+f.id+'"]').first();await shape.waitFor({state:'attached'});
    const rendered=await shape.evaluate(el=>{const style=getComputedStyle(el),rect=el.getBoundingClientRect();
      return {ref:el.getAttribute('data-plan-ref'),work:el.getAttribute('data-work-id'),status:el.getAttribute('data-status'),exchange:el.getAttribute('data-exchange'),fileOutline:el.nextElementSibling?getComputedStyle(el.nextElementSibling).stroke:null,tag:el.tagName,fill:style.fill,stroke:style.stroke,opacity:style.opacity,width:rect.width,height:rect.height};});
    assert.ok(rendered.fill!=='none'||rendered.stroke!=='none');assert.ok(Number(rendered.opacity)>0);
    assert.ok(rendered.width>0||rendered.height>0,'Geometry must project onto viewport');
    if(f.exchange){assert.equal(rendered.exchange,f.exchange);assert.ok(rendered.fileOutline&&rendered.fileOutline!=='none');}
    shows.push(rendered);
  }
  if(fields.length===2)assert.notDeepEqual([shows[0].fill,shows[0].stroke],[shows[1].fill,shows[1].stroke],'status colours must differ on actual geometry');
  await b(map,'Status key').click();await expect(p.getByTestId('trade-status-key')).toContainText(/snagged/i);await b(p.getByTestId('trade-status-key'),'Close map details').click();
  await capture(p,'map-'+view+'-'+row.width+'-'+phase);
  const pin=map.getByTestId('trade-work-pin').filter({hasText:shower});
  const target=(await pin.count())?pin.first():map.locator('[data-testid="trade-work-pin"][data-work-id="'+shows[0].work+'"]').first();
  await target.waitFor();const r=await target.boundingBox();assert.ok(r.width>=47.99&&r.height>=47.99,'Map hit area below 48px');
  const path=map.locator('path[data-work-id="'+shows[0].work+'"][data-plan-ref="'+fields[0].pin.planRef+'"]').first();
  const shownPoint=await path.evaluate(el=>{const mat=el.getScreenCTM(),length=el.getTotalLength();for(const frac of [.15,.85,.3,.68,.5]){
    const point=el.getPointAtLength(length*frac).matrixTransform(mat);if(document.elementFromPoint(point.x,point.y)===el)return{x:point.x,y:point.y};
  }return null;});
  await physical(p,row.width,shownPoint?.x??r.x+r.width/2,shownPoint?.y??r.y+r.height/2);
  const detail=map.getByTestId('trade-part-detail');
  await expect(detail).toBeVisible();await expect(detail).toContainText(shower);await expect(detail).toContainText(plumber);
  row.views.push({view,phase,rendered:shows,detail:true,physicalHit:shownPoint?'painted surface':'surface pin',target:[r.width,r.height]});
  await b(detail,'Close map details').click();await b(map,'Dashboard').click();await expect(dashboard(p)).toBeVisible();
}
async function campaign(width){
  const browser=await launch(),{context,log}=await localContext(browser,width,{seed:true}),page=await context.newPage();page.setDefaultTimeout(18000);
  const row={width,textScale:width===313?1.15:1,started:instant(),steps:[],picks:[],views:[],layout:[],log};let phase='open dashboard';
  try{
    if(width===313) await context.addInitScript(()=>localStorage.setItem('olb.ui-preferences.v1',JSON.stringify({locale:'en',theme:'ocean'})));
    const photo=await openDashboard(page,row);phase='take plumbing package';
    await workRow(page,/Plumbing, Ground floor/i).click();const take=lastSheet(page);
    await take.getByLabel('Recorded by',{exact:true}).fill(plumber);await b(take,'Take package').click();await expect(take).toContainText('Taken by '+plumber);
    await b(take,'Add pinned job').click();phase='plumbing pin';
    const plumbing=await jobEditor(page,row,{name:shower,who:plumber,note:'Check the shower connection against the wall.',status:'planned',view:'plan',image:photo});
    assert.ok(plumbing.parentId);await b(dlg(page,shower),'Edit job').click();const edit=dlg(page,'Edit job');
    await edit.getByLabel('Status',{exact:true}).selectOption('started');await edit.getByLabel('Recorded by',{exact:true}).fill(plumber);await b(edit,'Save job').click();
    await expect(dlg(page,shower)).toContainText('Started');await closeSheet(page);row.steps.push('Plumber took measured package, pinned a photographed job on the shower wall, recorded work started.');
    phase='electrical pin';await role(page,'electrical');assert.equal(await workRow(page,shower).count(),0);await b(dashboard(page),'Add a job').click();
    const electrical=await jobEditor(page,row,{name:kitchen,who:electrician,note:'Locate the kitchen conduit route.',status:'waiting',view:'house'});await closeSheet(page);
    await role(page,'owner');const timeline=page.getByTestId('trade-timeline').first();await expect(timeline).toContainText(plumber);await expect(timeline).toContainText(electrician);
    row.steps.push('Electrician created separate kitchen job from actual House surface; owner timeline includes both named trades.');
    phase='owner map';const both=[{...plumbing,status:'started'},{...electrical,status:'waiting'}];
    for(const view of ['plan','house'])await mapEvidence(page,row,view,both,'field');
    phase='work file';await role(page,'plumbing');const work=await transferOut(page,row,plumbing);
    phase='Trade Folder quote';const trade=await context.newPage(),quote=await realQuote(trade,work);await protocol.parsePack(quote,instant());
    await addAnswer(page,quote);await expect(workRow(page,shower)).toContainText('Quote in');
    const money=await openWorkFile(page,shower);await money.getByTestId('bd-decision-name').fill('QA owner');await money.getByTestId('bd-decision-role').selectOption('owner');await b(money,'Approve quote').click();await expect(money).toContainText(/approved/i);await closeSheet(page);
    phase='Trade Folder progress';await trade.getByLabel('Work status').selectOption('done');await trade.getByLabel('Work note').fill('Testing completed on the shower connection.');await b(trade,'Make the status pack').click();
    const progress=(await downloadJson(trade,()=>b(trade,'Save the status file').click())).body;assert.equal(progress.quoteId,quote.id);await addAnswer(page,progress);await trade.close();
    phase='invoice';const invoice=await protocol.signPack({type:'ppw-job-pack',v:1,kind:'invoice',id:'invoice-qa-'+width,requestId:work.request.id,createdAt:instant(),expiresAt:new Date(Date.now()+86400000).toISOString(),from:quote.from,quoteId:quote.id,number:'TEST-01',lines:quote.lines,subtotal:quote.subtotal,vat:quote.vat,total:quote.total,currency:quote.currency});
    await addAnswer(page,invoice);row.exchange={realReceiver:true,requestId:work.request.id,quoteId:quote.id,quoteHash:quote.sha256,realProgress:progress.state,invoice:'signed fixture'};
    await role(page,'owner');await expect(timeline).toContainText(quote.from.label);await expect(timeline).toContainText(shower);
    phase='returned status map';
    for(const view of ['plan','house'])await mapEvidence(page,row,view,[{...plumbing,status:'done',exchange:'invoiced'},both[1]],'return');
    await role(page,'plumbing');await workRow(page,shower).scrollIntoViewIfNeeded();await layout(dashboard(page),row,'trade with returned work');
    await capture(page,'plumbing-station-'+width);await role(page,'owner');await b(dashboard(page),'Project timeline').click();await capture(page,'owner-timeline-'+width);
    row.steps.push('Unchanged v1 work file carried job/same photo to real Trade Folder; returned quote and done report imported; invoice fixture changed the exchange display without moving money.');
    await page.reload();await expect(dashboard(page)).toBeVisible();await expect(page.getByTestId('trade-timeline').first()).toContainText(quote.from.label);row.steps.push('Timeline survived reload.');
    await page.waitForLoadState('networkidle');assertClean(log);row.pass=true;
  }catch(e){row.pass=false;row.error=phase+': '+String(e).slice(0,1100);writeFileSync(resolve(scratch,'journey-'+width+'-failure.txt'),String(e)+'\n'+await page.locator('body').innerText().catch(()=>''));await page.screenshot({path:resolve(scratch,'journey-'+width+'-failure.png')}).catch(()=>{});}
  finally{await context.close();await browser.close();row.ended=instant();save('journey-'+width,row);console.log(JSON.stringify({width,pass:row.pass,error:row.error,steps:row.steps}));}
  return row;
}
const rows=[];for(const width of widths)rows.push(await campaign(width));if(rows.some(r=>!r.pass))process.exitCode=1;
