// Build both apps first and start only your own local servers. Default verifies
// all 3 widths: node tools/link/qa-dashboard.mjs [1280,390,360].
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { assert, chromium, expect, filePayload, localContext, measuredProperty, olb, readDownload,
  saveEvidence, scratch, shot, signing, tfQuote, zoomText } from './qa-helpers.mjs';

const widths=(process.argv[2]||'1280,390,360').split(',').map(Number);
const signer=await signing();
const instant=()=>new Date().toISOString(), day=()=>instant().slice(0,10);
const browser=await chromium.launch({headless:true,args:['--use-angle=d3d11','--enable-gpu','--ignore-gpu-blocklist']});
const ledgerKey='olb_link_packages_v1';
const ledger=page=>page.evaluate(k=>JSON.parse(localStorage.getItem(k)||'{"events":[]}'),ledgerKey);
const seenEvents=async page=>(await ledger(page)).events.length;
const button=(page,name)=>page.getByRole('button',{name,exact:typeof name==='string'});
const dialog=(page,name)=>page.getByRole('dialog',{name,exact:true});
const plumbing=page=>page.locator('.bd-row').filter({hasText:'Plumbing, Ground floor'});
const dashboard=page=>dialog(page,'Build dashboard');
const close=async (page,name)=>button(dialog(page,name),'Close '+name).click();

async function dimensions(page,row,note){
  const facts=await page.evaluate(()=>{
    const surface=[...document.querySelectorAll('dialog[open][data-build-surface]')].at(-1);
    if(!surface)throw Error('No open dashboard or package sheet at layout checkpoint');
    const bad=[],sizes=[],els=[...surface.querySelectorAll('button, input:not([type=hidden]), select, textarea, a[href],summary')];
    for(const e of els) {
      const rect=e.getBoundingClientRect();
      if(!rect.width||!rect.height||getComputedStyle(e).visibility==='hidden')continue;
      const b=rect.width<48||rect.height<48?e.closest('label')?.getBoundingClientRect()??rect:rect;
      sizes.push({w:b.width,h:b.height});
      if(b.width<47.99||b.height<47.99)bad.push({label:(e.getAttribute('aria-label')||e.textContent||e.closest('label')?.textContent||e.name||e.tagName).trim().slice(0,70),width:b.width,height:b.height});
    }
    return {docWidth:document.documentElement.scrollWidth,viewport:innerWidth,surfaceWidth:surface.clientWidth,scrollWidth:surface.scrollWidth,controlCount:sizes.length,minTargetWidth:Math.min(...sizes.map(b=>b.w)),minTargetHeight:Math.min(...sizes.map(b=>b.h)),bad};
  });
  row.layout.push({note,...facts});
  assert.ok(facts.docWidth<=facts.viewport+1, note+': document overflow');
  assert.ok(facts.scrollWidth<=facts.surfaceWidth+1, note+': dialog overflow');
  assert.deepEqual(facts.bad,[],note+': touch targets below 48 px');
}

async function captureTop(page,row) {
  const panel=dashboard(page);
  // Prior actions can scroll the modal to the register. Capture the intended
  // initial viewport with title and Needs you together, not that scroll offset.
  await panel.evaluate(async el=>{
    el.scrollTo({top:0,behavior:'instant'}); await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
  });
  const contrast=await panel.evaluate(el=>{
    const rgb=v=>v.match(/[\d.]+/g).map(Number);
    const luminance=c=>c.slice(0,3).reduce((s,x,i)=>{const v=x/255;return s+[.2126,.7152,.0722][i]*(v<=.04045?v/12.92:((v+.055)/1.055)**2.4)},0);
    const getBg=node=>{let c=[255,255,255];const elements=[];for(let n=node;n;n=n.parentElement)elements.unshift(n);
      for(const n of elements){const b=rgb(getComputedStyle(n).backgroundColor),a=b[3]??1;
        c=c.map((x,i)=>a*b[i]+(1-a)*x)}return c};
    return ['#build-title','.bd-needs h2','.bd-needs p','.bd-needs .bd-kicker','.bd-need-actions button','.bd-money span','.bd-row small','.bd-chip[data-kind="quote"]'].map(selector=>{
      const n=el.querySelector(selector);if(!n)throw Error('Missing contrast sample '+selector);
      const ink=rgb(getComputedStyle(n).color),bg=getBg(n),foreground=ink.slice(0,3).map((x,i)=>(ink[3]??1)*x+(1-(ink[3]??1))*bg[i]);
      const a=luminance(foreground),b=luminance(bg);
      return {selector,ratio:Number(((Math.max(a,b)+.05)/(Math.min(a,b)+.05)).toFixed(2))};
    });
  });
  assert.ok(contrast.every(x=>x.ratio>=4.5),'Normal-theme key text contrast below 4.5:1');
  row.contrast=contrast;
  const heading=await panel.getByRole('heading',{name:'Build dashboard',exact:true}).boundingBox();
  const focus=await panel.getByRole('heading',{name:'Needs you',exact:true}).boundingBox();
  assert.ok(heading.y>=0 && focus.y>=0 && focus.y<page.viewportSize().height,'Top viewport must show title and Needs you');
  await shot(page,'dashboard-'+row.width,null);
  if(row.width===1280)await shot(page,'dashboard-focal-point',null,true);
}

async function uploadAnswer(page,pack,expectDuplicate=false) {
  const before=await seenEvents(page);
  await button(dashboard(page),'Add an answer').click();
  const sheet=dialog(page,'Add an answer');
  await sheet.getByLabel('Answer file').setInputFiles(filePayload(pack));
  await expect(sheet.getByRole('heading',{name:pack.kind+' from '+pack.from.label})).toBeVisible();
  assert.equal(await seenEvents(page),before,'Preview must not save an answer');
  await button(sheet,'Save answer').click();
  await expect(sheet).toHaveCount(0);
  assert.equal(await seenEvents(page),before+(expectDuplicate?0:1));
}
async function decision(page,row,action) {
  await plumbing(page).click();const pane=page.locator('.bd-sheet[open]').last();
  await pane.getByTestId('bd-decision-name').fill('QA Reviewer');
  await pane.getByTestId('bd-decision-role').selectOption('engineer');
  if(action==='Record paid') {
    await pane.getByLabel(/payment date|paid on|date paid/i).fill(day());
    await pane.getByLabel('Payment method').selectOption('bank');
    await pane.getByLabel(/reference/i).last().fill('test-ref');
  }
  await button(pane,action).click();
  await expect.poll(async()=> (await ledger(page)).events.at(-1)?.kind).toBe(action==='Record paid'?'pay':'decide');
  row.steps.push(action+' by named engineer');
  await pane.locator('header button').first().click();
}
async function userPackage(page,row) {
  await page.goto(olb+'/designer');
  await page.getByTestId('plan-drawing-viewport').waitFor();await page.getByTestId('plan-drawing-viewport').locator('canvas').first().waitFor();
  if(row.width===1280) await shot(page,'01-original-plan',page.getByTestId('plan-drawing-viewport'));
  await page.goto(olb+'/designer?panel=build');await zoomText(page,row.width);
  await expect(dashboard(page)).toBeVisible();await expect(dashboard(page)).toContainText('No work packages yet');
  await dimensions(page,row,'empty dashboard');
  await button(dashboard(page),'Make packages').click();
  const make=dialog(page,'Make packages from this plan');
  await make.getByLabel('Company name').fill('Example build team');await make.getByLabel('Site or plot label').fill('Plot 12');
  await make.getByLabel('Phase').fill('First stage'); await button(make,'Create draft packages').click();
  await expect(plumbing(page)).toBeVisible();await plumbing(page).click();
  const pane=page.locator('.bd-sheet[open]').last();
  const budget=pane.getByLabel(/Planned budget/), notes=pane.getByLabel(/Internal notes/);
  await budget.fill('9876.54');await notes.fill('PRIVATE-QA-NOTE');
  if(row.width===390) await pane.getByLabel(/Include a room sketch/).uncheck();
  await button(pane,'Build work file').click();
  const {json,filename}=await readDownload(page,()=>button(pane,'Download work file').click());
  assert.match(filename,/\.olbpackage\.json$/);assert.equal(json.type,'ppw-work-package');assert.equal(json.planView.plan.revision,1);
  assert.ok(!JSON.stringify(json).includes('PRIVATE-QA-NOTE')&&!JSON.stringify(json).includes('9876.54'));
  assert.deepEqual(json.planView.quantities,json.request.quantities);assert.equal(json.request.quantities.find(x=>x.planRef==='olb:item:basin')?.qty,1);
  const tfAnchor=pane.getByRole('link',{name:/Open Trade Folder/});
  await expect.poll(async()=>((await tfAnchor.getAttribute('href'))??'').includes('#w=')||/does not fit a short link|checked link is unavailable/.test(await pane.innerText())).toBe(true);
  const address=await tfAnchor.getAttribute('href');const linkUrl=new URL(address);
  assert.equal(linkUrl.origin+linkUrl.pathname,'https://tradefolder.vercel.app/pro/job-pack');
  if(linkUrl.hash){
    assert.ok(address.length<=1800);assert.equal((await signer.readPack(address,instant())).sha256,json.request.sha256);
    await expect(button(pane,'Copy link')).toBeVisible();await button(pane,'QR code').click();
    const qr=pane.getByRole('img',{name:'Trade Folder request QR code'});await expect(qr).toBeVisible();
    await expect.poll(()=>qr.evaluate(img=>img.complete&&img.naturalWidth>0)).toBe(true);await button(pane,'QR code').click();
  }else{await expect(button(pane,'Copy link')).toHaveCount(0);await expect(button(pane,'QR code')).toHaveCount(0);}
  row.sharing={requestLinkChars:linkUrl.hash?address.length:0,qrOffered:!!linkUrl.hash,photoBytes:json.request.photos?.[0]?.sizeBytes??0};
  const expected=measuredProperty().rooms;
  for(const room of expected) {
    const target=json.planView.rooms.find(r=>r.id===room.id);assert.ok(target);
    // Normalisation may reverse/rotate ordered vertices; check each unchanged
    // world coordinate since no translation, mirroring or axis flip is valid.
    const canonical=points=>points.map(p=>p.join(',')).sort();
    assert.deepEqual(canonical(target.polygon),canonical(room.polygon.map(p=>[p.x,p.y])));
  }
  await dimensions(page,row,'package inspector');
  if(row.width===1280) await shot(page,'02-exported-plan',pane.getByTestId('build-plan-picture'));
  await pane.locator('header button').first().click();
  row.steps.push('Fixture plan measured → reviewed package → real file downloaded; geometry and privacy reconciled');
  return json;
}
async function campaign(width){
  const row={startedAt:instant(),base:olb,width,textScale:width===360?1.15:1,steps:[],layout:[]};
  const {context,network}=await localContext(browser,width);row.network=network;
  const page=await context.newPage();page.setDefaultTimeout(12000);
  try {
    const work=await userPackage(page,row); const createdAt=instant(), from={app:'tradefolder',label:'Example plumbing team'};
    const env=(kind,id)=>({type:'ppw-job-pack',v:1,kind,id,requestId:work.request.id,createdAt,expiresAt:new Date(Date.now()+30*86400000).toISOString(),from});
    let quote, trade;
    if(width===1280){
      trade=await context.newPage();trade.setDefaultTimeout(12000);
      quote=await tfQuote(trade,work,'desktop');
      row.crossApp={tfMain:'911c0e7918d97ffcb22e4d6af91250937c20638f',method:'Built local Trade Folder: file chooser → checked import → confirm job → manual price inputs → make quote → file download',requestId:work.request.id,requestHash:work.request.sha256,planHash:work.planView.sha256,quoteId:quote.id,quoteHash:quote.sha256,replyMatches:quote.requestId===work.request.id,attachedPictureBytes:work.request.photos?.[0]?.sizeBytes??0};
      row.steps.push('Actual Trade Folder main: chose exported OLB work file, confirmed job, entered line prices, made and downloaded quote');
    } else {
      quote=await signer.signPack({...env('quote','qa-quote-'+width),lines:[{kind:'labour',text:'Installation review',qty:1,unit:'job',rate:125.25,amount:125.25}],subtotal:125.25,vat:{rate:0,included:false},total:125.25,currency:work.request.currency,validUntil:new Date(Date.now()+20*86400000).toISOString().slice(0,10),assumptions:[],exclusions:[],pricing:{source:'manual'}});
    }
    await signer.parsePack(quote,instant());
    if(width===390){
      const link=await signer.packLink(quote,olb+'/designer');assert.ok(link && link.length<=1800);
      const count=await seenEvents(page);
      await page.goto(link);
      const sheet=dialog(page,'Add an answer');await expect(sheet.getByLabel('Answer link or JSON')).toHaveValue(link);
      assert.equal(await seenEvents(page),count);
      await button(sheet,'Review answer').click();await expect(sheet.getByRole('heading',{name:quote.kind+' from '+quote.from.label})).toBeVisible();
      assert.equal(await seenEvents(page),count);await button(sheet,'Save answer').click();await expect(sheet).toHaveCount(0);
      assert.equal(await seenEvents(page),count+1);
      await page.goto(olb+'/designer?panel=build');row.steps.push('Actual #w= only prefills: checking a sender/file does not save it');
    }else await uploadAnswer(page,quote);
    await uploadAnswer(page,quote,true);
    await expect(button(dashboard(page),/Quotes to decide/)).toContainText('1');
    await button(dashboard(page),'Hide amounts').click();
    const hidden=await dashboard(page).innerText();
    assert.ok(!hidden.includes('9,876.54')&&!hidden.includes(quote.total.toFixed(2)));
    // A chosen answer file must not re-expose amounts in a visible textarea.
    await button(dashboard(page),'Add an answer').click();
    const hiddenSheet=dialog(page,'Add an answer');
    await hiddenSheet.getByLabel('Answer file').setInputFiles(filePayload(quote));
    await expect(hiddenSheet.getByRole('heading',{name:quote.kind+' from '+quote.from.label})).toBeVisible();
    const liveText=await hiddenSheet.evaluate(el=>[el.innerText,...[...el.querySelectorAll('input,textarea')].filter(e=>e.offsetWidth&&e.offsetHeight&&e.type!=='password'&&e.type!=='file').map(e=>e.value)].join(' '));
    assert.ok(!liveText.includes('"subtotal"')&&!liveText.includes(quote.total.toFixed(2)),'amount leaked in masked answer preview');
    await close(page,'Add an answer');
    await dimensions(page,row,'populated dashboard');
    await captureTop(page,row);
    await button(dashboard(page),'Show amounts').click();await decision(page,row,'Approve quote');
    let status;
    if(trade){
      await trade.getByLabel('Work status').selectOption('started');await trade.getByLabel('Work date').fill(day());
      await trade.getByLabel('Work note').fill('Test work reported on site');await button(trade,'Make the status pack').click();
      status=(await readDownload(trade,()=>button(trade,'Save the status file').click())).json;
      assert.equal(status.quoteId,quote.id);assert.equal(status.requestId,work.request.id);
      row.crossApp.statusId=status.id;row.crossApp.statusHash=status.sha256;
      await trade.close();row.steps.push('Actual Trade Folder progress file downloaded for the same quote/request');
    }else status=await signer.signPack({...env('status','qa-status-'+width),from:quote.from,quoteId:quote.id,state:'started',note:'Test work reported on site',on:day()});
    await uploadAnswer(page,status);await expect(plumbing(page)).toContainText('On site');
    const invoice=await signer.signPack({...env('invoice','qa-invoice-'+width),from:quote.from,quoteId:quote.id,number:'QA-001',lines:quote.lines,subtotal:quote.subtotal,vat:quote.vat,total:quote.total,currency:quote.currency});
    await uploadAnswer(page,invoice);await decision(page,row,'Accept invoice');await decision(page,row,'Record paid');
    await expect(plumbing(page)).toContainText('Paid');
    const totalRows=dashboard(page).getByLabel(work.request.currency+' totals').locator('div');
    const amount=new Intl.NumberFormat('en-US',{style:'currency',currency:work.request.currency}).format(quote.total);
    for(const name of ['quoted','approved','invoiced','paid'])await expect(totalRows.filter({has:page.getByText(name,{exact:true})}).locator('strong')).toHaveText(amount);
    const before=await ledger(page);const priorSend=before.events.find(e=>e.kind==='send').work;
    // Change the property, not the ledger. Reopening the real editor hydrates
    // its normal store and recalculates its fingerprint, quantities and plan view.
    await page.evaluate(()=>{const saved=JSON.parse(localStorage.getItem('ppw_property_v2'));saved.state.property.services.runs[0].points[0].y+=.5;localStorage.setItem('ppw_property_v2',JSON.stringify(saved));});
    await page.reload();await zoomText(page,width);await expect(plumbing(page)).toContainText('Plan changed');
    await plumbing(page).click();const pane=page.locator('.bd-sheet[open]').last();
    await expect(button(pane,'Send update')).toBeDisabled();await button(pane,'Review latest measured lines').click();
    await button(pane,'Send update').click();await expect.poll(async()=>(await ledger(page)).events.filter(e=>e.kind==='send').length).toBe(2);
    const updated=(await readDownload(page,()=>button(pane,'Download work file').click())).json;
    assert.equal(updated.planView.plan.revision,2);assert.equal(updated.planView.package.id,priorSend.planView.package.id);
    assert.notEqual(updated.request.id,priorSend.request.id);assert.notEqual(updated.planView.plan.fingerprint,priorSend.planView.plan.fingerprint);
    const sent=(await ledger(page)).events.filter(e=>e.kind==='send');
    assert.equal(sent.length,2);assert.equal(sent[0].work.request.sha256,priorSend.request.sha256);
    assert.notEqual(updated.request.quantities.find(q=>q.planRef==='olb:run:cold-inlet').qty,priorSend.request.quantities.find(q=>q.planRef==='olb:run:cold-inlet').qty);
    await pane.locator('header button').first().click();
    if(width===1280){
      await button(dashboard(page),'Hide amounts').click();
      await context.setOffline(true);await expect(dashboard(page)).toContainText('Offline');
      await button(dashboard(page),'Files').click();const files=dialog(page,'Dashboard files');
      const csvDownload=page.waitForEvent('download');await button(files,'Download package CSV').click();
      const csv=await (await csvDownload).createReadStream();let csvText='';for await(const chunk of csv)csvText+=chunk.toString('utf8');
      assert.ok(csvText.includes('Plumbing')&&!csvText.includes('9876.54')&&!csvText.includes('PRIVATE-QA-NOTE'));
      const backup=(await readDownload(page,()=>button(files,'Export backup').click())).json;
      assert.deepEqual(backup,await ledger(page));
      const copy={...backup,events:[...backup.events,{kind:'bad-input'}]};
      await files.getByLabel('Backup file').setInputFiles(filePayload(copy,'broken.json'));await button(files,'Replace from backup').click();
      await expect(files.getByRole('alert')).toBeVisible();assert.deepEqual(await ledger(page),backup);
      await files.getByLabel('Backup file').setInputFiles(filePayload(backup,'checked.json'));await button(files,'Replace from backup').click();
      await expect(files).toHaveCount(0);assert.deepEqual(await ledger(page),backup);
      await context.setOffline(false);
      row.steps.push('Offline CSV without amounts + local backup export/restore; invalid backup leaves last good ledger untouched');
    }
    row.steps.push('Pinned protocol → idempotent quote → named approval → status → invoice accepted → payment recorded → changed routing → new revision; original retained');
    row.sendCount=sent.length;row.privateAssets=await page.evaluate(()=>[...new Set(performance.getEntriesByType('resource').map(r=>new URL(r.name).pathname).filter(p=>p.includes('/assets/studio/')))].sort());row.passed=true;
    assert.deepEqual(network.attemptedWrites,[]);assert.deepEqual(network.pageErrors,[]);assert.deepEqual(network.errors,[]);assert.deepEqual(network.httpErrors,[]);
  }catch(e){
    row.passed=false;row.failure=String(e);
    writeFileSync(resolve(scratch,'failure-'+width+'.txt'),String(e)+'\n'+await page.locator('body').innerText().catch(()=>''));
    await page.screenshot({path:resolve(scratch,'failure-'+width+'.png')}).catch(()=>{});
  }finally{await context.close()}
  row.finishedAt=instant();saveEvidence('journey-'+width,row); console.log(JSON.stringify({width,passed:row.passed,failure:row.failure,steps:row.steps}));
  return row;
}
try{
  const results=[];for(const width of widths)results.push(await campaign(width));
  if(results.some(r=>!r.passed))process.exitCode=1;
}finally{await browser.close()}
