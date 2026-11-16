import {converted,fraction,lineTotal,minorDigits,roundMinor,typed,valueOf,major,ledgerCsv,type BookCurrency,type Ledger,type Row,type Snapshot} from './ledger.js';
import {advance} from './running.js';
export function percent(amount:number,pct?:string){if(pct===undefined)return null;const p=fraction(pct);return roundMinor(BigInt(amount)*p.n,p.d*100n);}
export function ratio(a:number,b:number){if(!b)return null;const raw=BigInt(a)*10000n/BigInt(b);return major(Number(raw),2);}
export function exceeds(a:number,b:number,pct?:string){if(!b||pct===undefined)return null;const f=fraction(pct);return BigInt(a)*100n*f.d>BigInt(b)*f.n;}
export function staffCost(gross:number,charges:number,other:number,hours:string,total:string){const a=fraction(hours),b=fraction(total);if(b.n<=0n||a.n*b.d>b.n*a.d)throw Error('Total hours must cover the hours on the pilot.');return roundMinor(BigInt(gross+charges+other)*a.n*b.d,a.d*b.n);}
const latest=(rows:Ledger[])=>typed(rows,'plan_version').sort((a,b)=>b.number-a.number)[0];
export function planValues(rows:Ledger[]){
 const lines=typed(rows,'budget_line'),plan=latest(rows),settings=typed(rows,'settings')[0],values=new Map<string,number>(),moved=new Map<string,number>();
 for(const l of lines){const initial=plan?plan.lines?.find(i=>i.id===l.id)?.total??0:lineTotal(l);values.set(l.id,initial);moved.set(l.id,0);}
 const add=(key:string,num:number)=>values.set(key,(values.get(key)??0)+num);
 for(const move of typed(rows,'move').filter(m=>m.plan===plan?.id)){add(move.from,-move.amount);add(move.to,move.amount);moved.set(move.from,(moved.get(move.from)??0)-move.amount);moved.set(move.to,(moved.get(move.to)??0)+move.amount);}
 const reserve=lines.find(l=>l.kind==='contingency');
 for(const u of typed(rows,'contingency_use').filter(u=>u.plan===plan?.id)){if(reserve)add(reserve.id,-u.amount);for(const r of u.receivers)add(r.line,r.amount);}
 const direct=lines.filter(l=>l.direct).reduce((s,l)=>s+(values.get(l.id)??0),0);
 for(const l of lines.filter(l=>l.kind==='flat rate'))values.set(l.id,settings?.flatOff?0:percent(direct,settings?.flatPercent)??0);
 return {values,moved,plan,direct,contingency:reserve?values.get(reserve.id)??0:0,total:[...values.values()].reduce((s,n)=>s+n,0)};
}
export function buyingFlags(check:Row<'buying_check'>,rows:Ledger[]){
 const s=typed(rows,'settings')[0],plan=typed(rows,'procurement_plan').find(p=>p.id===check.plan),table=typed(rows,'band_table').find(t=>t.purchaseType===check.purchaseType);
 const failures:string[]=[];if(check.outcome!=='passed')failures.push('Award pending or failed');
 if(check.ownerBids){if(check.consulted<1)failures.push('Providers missing');return failures;}
 if(!plan?.noObjection||!plan.approvalFile)failures.push('No approved procurement plan');
 if(!table||check.value===undefined){failures.push('Missing value band');return failures;}
 const value=check.value+(table.includeTax?check.tax??0:0);
 const band=(v:number)=>table.edges.filter(e=>v>e.value||v===e.value&&!e.lower).length;
 const rule=table.bands[band(value)];if(!rule||check.consulted<rule.providers)failures.push('Too few providers');if(rule&&check.procedure!==rule.procedure)failures.push('Procedure differs from the band');
 if(table.committeeFrom!==undefined&&value>=table.committeeFrom){const n=check.committee?.length??0;if(!n||n%2===0||n<(s?.committeeSize??1)||!check.committeeReport||!check.tender)failures.push('Committee check failed');}
 const basis=check.purchaseType==='works'||check.purchaseType==='supply'&&!check.afterSales?'lowest price':s?.awardBasis?.[check.purchaseType??'']??'best value';if(check.awardBasis!==basis)failures.push('Award basis failed');
 const all=typed(rows,'buying_check').filter(b=>b.purchaseType===check.purchaseType && (b.id===check.id||!!b.supplier&&b.supplier===check.supplier||!!b.label&&b.label===check.label));
 if(band(all.reduce((a,b)=>a+(b.value??0)+(table.includeTax?b.tax??0:0),0))>band(value))failures.push('Possible split purchase');return failures;
}
export function paymentClock(p:Row<'payment_row'>,now:string,days?:number,confirm?:number){
 const start=p.dedicatedAccountSent??p.requestReceived;const elapsed=(a:string,b:string)=>Math.floor((Date.parse(b)-Date.parse(a))/86400000);
 if(!start||days===undefined)return null;const stopped=(p.stops??[]).reduce((sum,s)=>sum+Math.max(0,elapsed(s.notice,s.restart??now)),0);
 const due=advance(start,days+stopped);return {elapsed:elapsed(start,now)-stopped,stopped,due,confirmBy:confirm===undefined||!p.receivedDate?null:advance(p.receivedDate,confirm),deemedAccepted:now>due&&!p.replyDate&&!(p.stops??[]).some(s=>!s.restart)};
}
export function funderSet(rows:Ledger[],book:BookCurrency,snap:Record<string,Snapshot>,now:string,periodId?:string){
 const setting=typed(rows,'settings')[0],lines=typed(rows,'budget_line'),costs=typed(rows,'cost_row'),entries=typed(rows,'row_entry'),periods=typed(rows,'period');
 const period=periods.find(p=>p.id===periodId),plan=planValues(rows),final=periods.find(p=>p.final),payments=typed(rows,'payment_row'),received=payments.reduce((s,p)=>s+(p.receivedAmount??0),0),sources=typed(rows,'source');
 const amount=(c:Row<'cost_row'>)=>entries.find(e=>e.costId===c.id&&e.kind==='funder result')?.eligible??snap[c.id]?.converted??valueOf(c,rows,book).converted??0;
 const counted=costs.filter(c=>c.funding==='in the budget'&&['accepted','claimed'].includes(c.state)),projected=counted.some(c=>c.state!=='accepted');
 const flatBase=counted.filter(c=>lines.some(l=>l.id===c.line&&l.direct)).reduce((s,c)=>s+amount(c),0);
 const flat=setting?.flatOff||!lines.some(l=>l.kind==='flat rate')?0:percent(flatBase,setting?.flatPercent);
 const base=counted.reduce((s,c)=>s+amount(c),0)+(flat??0);
 const gross=setting?.maximumGrant===undefined||setting?.grantPercent===undefined?null:Math.min(setting.maximumGrant,percent(base,setting.grantPercent)!);
 const grant=gross===null?null:gross-typed(rows,'cut').reduce((s,c)=>s+c.amount,0);
 const balance=grant===null?null:grant-received;
 const eligible=final?.sent&&!projected?base:plan.total;
 const sourceTable=sources.map(s=>{const received=typed(rows,'transfer').filter(t=>t.direction==='in'&&t.source===s.id).reduce((n,t)=>n+(converted(rows,book,{amount:t.amount,currency:t.currency,date:t.date,paymentRate:t.paymentRate})?.amount??0),0);
 return {...s,received,counted:s.kind!=='in kind'&&s.giver!=='project income'};});
 const promised=sourceTable.reduce((a,s)=>a+(s.counted&&s.proofState!=='none'?s.promised:0),0);
 const reached=sourceTable.reduce((a,s)=>a+(s.counted&&s.proofState==='received'&&s.file?(s.kind==='paid staff time'?s.promised:s.received):0),0);
 const receipts=sourceTable.reduce((a,s)=>a+(s.giver==='project income'||s.counted&&s.earmarked&&s.returnsUnused?s.received:0),0);
 const profit=(include:boolean)=>{if(!base||gross===null)return {surplus:null,cut:null};const surplus=Math.max(0,receipts+(include?gross:0)-base);return {surplus,cut:roundMinor(BigInt(surplus)*BigInt(gross),BigInt(base))};};
 const assets=costs.filter(c=>c.funding==='in the budget'&&['equipment','supply'].includes(c.costType)).map(c=>{
 const asset=typed(rows,'asset').find(a=>a.costId===c.id),value=amount(c);
 return {id:c.id,item:c.description1,date:c.documentDate,value,asset,needsFile:setting?.assetValue!==undefined&&value>setting.assetValue&&!asset?.file};});
 const pending=final&&now>=final.start?costs.filter(c=>c.funding==='in the budget'&&['invoiced','committed'].includes(c.state)).map(c=>({id:c.id,provider:c.thirdParty,object:c.description1,amount:amount(c),due:c.pendingDue,document:c.documentRef,reason:c.pendingReason,late:!!c.pendingDue&&now>c.pendingDue&&!c.proofs.some(f=>f.kind==='proof of payment'&&f.file)})):[];
 const byLine=lines.map(l=>{const scoped=costs.filter(c=>c.line===l.id&&c.funding==='in the budget'&&['paid','claimed','accepted'].includes(c.state)),thisPeriod=(c:Row<'cost_row'>)=>!period||snap[c.id]?.period===period.number||(!snap[c.id]?.period&&!!c.paymentDate&&c.paymentDate>=period.start&&c.paymentDate<=period.end);
 const here=scoped.filter(thisPeriod).reduce((s,c)=>s+amount(c),0),before=scoped.filter(c=>period&&((snap[c.id]?.period??Infinity)<period.number||!snap[c.id]?.period&&!!c.paymentDate&&c.paymentDate<period.start)).reduce((s,c)=>s+amount(c),0);
 const planned=plan.values.get(l.id)??0,signed=plan.plan?.lines?.find(r=>r.id===l.id)?.total,spent=here+before,variation=planned-spent;
 const forecast=typed(rows,'forecast').find(f=>f.line===l.id&&f.period===period?.id),f=forecast?roundMinor(BigInt(forecast.unitValue)*fraction(forecast.units).n,fraction(forecast.units).d):0;
 return {id:l.id,label:l.label,heading:l.heading,kind:l.kind,planned,signed:signed??null,authorised:planned-(signed??planned),spent:l.kind==='contingency'?null:spent,thisPeriod:here,before,remaining:l.kind==='contingency'?null:variation,variationPercent:ratio(variation,planned),forecast:f,forecastGap:f-here,claimed:scoped.filter(c=>c.state==='claimed').reduce((s,c)=>s+amount(c),0),accepted:scoped.filter(c=>c.state==='accepted').reduce((s,c)=>s+amount(c),0)};});
 const headings=typed(rows,'heading').map(h=>{const inHeading=lines.filter(l=>l.heading===h.id),signed=plan.plan?.lines?.filter(l=>l.heading===h.id).reduce((s,l)=>s+l.total,0)??0;
 const delta=inHeading.reduce((s,l)=>s+(plan.moved.get(l.id)??0),0);const band=!plan.plan?null:!signed||inHeading.some(l=>!plan.plan?.lines?.some(x=>x.id===l.id))?'Needs a signed change':exceeds(Math.abs(delta),signed,setting?.upperBand)?'Needs a signed change':exceeds(Math.abs(delta),signed,setting?.lowerBand)?'Notify the funder':'Within first band';
 return {id:h.id,name:h.name,signed,delta,percent:ratio(delta,signed),band};});
 const spent=costs.filter(c=>c.funding==='in the budget'&&['claimed','accepted','paid'].includes(c.state)).reduce((s,c)=>s+amount(c),0);
 const paid=payments.filter(p=>p.receivedDate).sort((a,b)=>a.receivedDate!.localeCompare(b.receivedDate!)),last=paid[paid.length-1]?.receivedAmount??0,earlier=received-last,grantSpent=percent(spent,setting?.grantPercent);
 const adjustedMax=setting?.maximumGrant===undefined||setting.grantPercent===undefined?null:setting.maximumGrant-percent(plan.contingency,setting.grantPercent)!;
 const forecastBase=base+byLine.filter(l=>!['flat rate','contingency'].includes(l.kind)).reduce((s,l)=>s+Math.max(0,l.planned-l.claimed-l.accepted),0);
 const forecastGrant=adjustedMax===null||!setting?.grantPercent?null:Math.min(adjustedMax,percent(forecastBase,setting.grantPercent)!);
 return {lines:byLine,headings,uses:typed(rows,'contingency_use'),flat,plan:plan.total,eligible,base,sourceTable,minimumShare:setting?.minimumShare??null,promised:ratio(promised,eligible),reached:ratio(reached,eligible),
 grantShare:setting?.maximumGrant===undefined?null:ratio(setting.maximumGrant,plan.plan?.lines?.reduce((s,l)=>s+l.total,0)??0),receipts,profitWithGrant:profit(true),profitWithoutGrant:profit(false),received,gross,grant,balance,projected,balanceLabel:balance!==null&&balance<0?(final?.sent&&!projected?'To return to the funder':'Projected: below payments received'):'Balance',assets,assetsReady:setting?.assetValue===undefined?null:assets.every(a=>!a.needsFile),pending,forecasts:typed(rows,'forecast'),wrongSums:typed(rows,'wrong_sum'),grantSpent,currentAdvanceShare:grantSpent===null?null:ratio(grantSpent-earlier,last),earlierShare:grantSpent===null?null:ratio(grantSpent,earlier),adjustedMax,forecastGrant,spent};
}
export function moreCsv(kind:string,rows:Ledger[],book:BookCurrency,set:ReturnType<typeof funderSet>,members:{id:string;name:string;role:string}[],steps:{id:string;title:string}[]){
 const fmt=(n:number)=>major(n,minorDigits[book]);
 if(kind==='hours')return ledgerCsv([['first name','role','month','hours on the pilot','total hours','share','step','line reference','time sheet state','pay slip state','approved'],...typed(rows,'staff_month').map(m=>{const member=members.find(v=>v.id===m.memberId),c=typed(rows,'cost_row').find(c=>c.staffMonth===m.id);return [member?.name??'',member?.role??'',m.month,m.hours,m.totalHours,ratio(Number(fraction(m.hours).n*fraction(m.totalHours).d),Number(fraction(m.totalHours).n*fraction(m.hours).d))??'',steps.find(s=>s.id===m.step)?.title??'',typed(rows,'budget_line').find(l=>l.id===c?.line)?.number??'',c?.proofs.some(f=>f.kind==='time sheet'&&f.file)?'present':'missing',c?.proofs.some(f=>f.kind==='pay slip'&&f.file)?'present':'missing',m.approved?'yes':'no'];})]);
 if(kind==='pending')return ledgerCsv([['provider','object of the contract','amount','due date','reference document','why not yet paid'],...set.pending.map(p=>[p.provider,p.object,fmt(p.amount),p.due??'',p.document,p.reason??''])]);
 if(kind==='assets')return ledgerCsv([['description','purchase date','purchase cost','receiver','transfer date','comments'],...set.assets.map(a=>[a.item,a.date,fmt(a.value),a.asset?.receiver??'',a.asset?.actual??'',a.asset?.comments??''])]);
 const settings=typed(rows,'settings')[0],final=typed(rows,'period').find(p=>p.final&&p.sent);const grant=final?set.grant:settings?.maximumGrant;
 const contributions=(grant??0)+set.sourceTable.filter(s=>s.kind!=='in kind').reduce((s,c)=>s+c.promised,0);
 return ledgerCsv([['item','name','conditions','amount','counted'],['grant','','',grant==null?'':fmt(grant),'yes'],...set.sourceTable.slice().sort((a,b)=>sourceOrder(a)-sourceOrder(b)).map(s=>[s.kind==='in kind'?'in kind':s.giver==='lead'?'own contribution':s.giver==='project income'?'project income':'other contribution',s.name,s.conditions,fmt(s.promised),s.kind==='in kind'?'no':'yes']),['total contributions','','',fmt(contributions),'yes'],['total eligible costs','','',fmt(set.eligible),'yes'],['grant share','','',ratio(grant??0,set.eligible)??'','']]);
}
function sourceOrder(s:Row<'source'>){return s.kind==='in kind'?3:s.giver==='project income'?2:s.giver==='lead'?0:1;}
