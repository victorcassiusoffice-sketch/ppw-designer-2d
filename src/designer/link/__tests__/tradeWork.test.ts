import { describe, expect, it } from 'vitest';
import { createLinkStore } from '../../../store/linkStore';
import type { Property } from '../../../store/propertyStore';
import type { PackageDraft, LinkPackage } from '../exchange';
import { buildWorkPackage, parseWorkPackage } from '../planView';
import { signPack } from '../vendor/tradefolder/lib/jobPack/protocol';
import type { InvoicePack, QuotePack, StatusPack } from '../vendor/tradefolder/lib/jobPack/types';
import { TRADE_ROLES, packageTrade, workItems, workGeometry, pinExists, projectTimeline, type CreateJobInput } from '../tradeWork';

const time=(m:number)=>new Date(Date.UTC(2026,10,10,9,m)).toISOString();
const property:Property={id:'pilot',name:'Training build',activeRoomId:'bath',rooms:[
  {id:'bath',name:'Bathroom',polygon:[{x:-3,y:0},{x:0,y:0},{x:0,y:2},{x:-3,y:2}],placedItems:[]},
  {id:'kitchen',name:'Kitchen',polygon:[{x:0,y:0},{x:3,y:0},{x:3,y:2},{x:0,y:2}],placedItems:[]},
],services:{version:1,runs:[],fixtures:[{id:'sink',levelId:'ground',kind:'sink',x:-1,y:.8,widthM:.8,depthM:.45,heightM:.8,rotation:0}]}};
const parent:PackageDraft={id:'bath-pack',projectId:'pilot',projectLabel:property.name,sourceKey:'plumbing:ground',title:'Bathroom fixtures',scope:'Bathroom first fix',
  trade:'plumbing',levelIds:['ground'],quantities:[{item:'Basin',qty:1,unit:'each',planRef:'olb:item:sink'}],
  siteId:'parcel',siteLabel:'North parcel',siteKind:'lot',phase:'Services',preferredDates:[],currency:'GBP',company:'Team',requester:'developer'};
const pin={levelId:'ground',x:-2,y:0,z:1.2,planRef:'olb:wall:wall-bath-0'};
const image='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAOnqLwAAAABJRU5ErkJggg==';
const photo={ref:'data:image/png;base64,'+image,sizeBytes:atob(image).length};
const create:CreateJobInput={id:'shower',projectId:'pilot',projectLabel:'Training build',role:'plumbing',parentId:'bath-pack',by:'Ada',title:'Shower connection',note:'Check the fitting.',
  pin,photo,status:'planned',startDate:'2026-11-12',dueDate:'2026-11-14'};
function db(){
  let stored:string|null=null;
  const port={getItem:()=>stored,setItem:(_k:string,v:string)=>{stored=v;}};
  return createLinkStore(()=>port,()=>time(59));
}
async function sendJob(row:LinkPackage) {
  const d=row.draft, j=row.job!;
  return buildWorkPackage({property,requestId:'request-job',viewId:'view-job',now:time(4),
    project:{id:d.projectId,label:d.projectLabel},site:{id:d.siteId,label:d.siteLabel,kind:d.siteKind},
    package:{id:d.id,title:d.title,trade:d.trade},phase:d.phase,companyName:d.company,requesterType:d.requester,
    description:d.scope,currency:d.currency,quantities:d.quantities,revision:1,levelIds:d.levelIds,preferredDates:d.preferredDates,jobPin:j.pin,photo:j.photo});
}
const from={app:'tradefolder' as const,label:'Trade team'};
const envelope={type:'ppw-job-pack' as const,v:1 as const,requestId:'request-job',expiresAt:'2026-12-10T09:00:00.000Z',from};
const line={kind:'labour' as const,text:'Site visit',qty:1,unit:'each',rate:10,amount:10};
const amounts={lines:[line],subtotal:10,vat:{rate:0,included:false},total:10,currency:'GBP'};

describe('local field jobs use one checked work ledger',()=>{
  it('maps thirteen role dashboards onto the nine unchanged v1 trade names',()=>{
    expect(TRADE_ROLES).toHaveLength(13);
    expect(new Set(TRADE_ROLES.map(r=>r.id)).size).toBe(13);
    expect(new Set(TRADE_ROLES.map(r=>r.wire)).size).toBe(9);
    for(const [key,trade,role] of [['plastering','plastering','plaster'],['repairs','general','repairs'],['masonry','general','builder'],['concrete/2','general','builder']]){
      expect(packageTrade({draft:{...parent,sourceKey:key,trade},sends:[],history:[],updatedAt:time(0)})).toBe(role);
    }
  });
  it('takes work by name, refuses cross-trade claims, and preserves older backups',async()=>{
    const store=db(), api=store.getState();await api.saveDraft(parent,time(0));
    const original=api.backup();expect(JSON.parse(original).v).toBe(1);
    await expect(api.takePackage(parent.id,'electrical','Ben',time(1))).rejects.toThrow('different trade');
    await expect(api.takePackage(parent.id,'plumbing','',time(1))).rejects.toThrow();
    await api.takePackage(parent.id,'plumbing','Ada',time(1));
    const backup=api.backup();expect(JSON.parse(backup).v).toBe(2);
    await api.takePackage(parent.id,'plumbing','Ada',time(1));expect(api.backup()).toBe(backup);
    await expect(api.takePackage(parent.id,'plumbing','Ben',time(2))).rejects.toThrow('already taken');
    await expect(api.saveDraft({...parent,scope:'Changed'},time(2))).rejects.toThrow('name');
    await api.saveDraft({...parent,scope:'Changed'},time(2),'Ada');
    expect(projectTimeline('pilot',store.getState().packages).map(e=>e.actor)).toEqual(['Ada','Ada','Name not recorded']);
    const fresh=db();await fresh.getState().restoreBackup(original);expect(fresh.getState().packages[0].claim).toBeUndefined();
    await fresh.getState().restoreBackup(backup);expect(fresh.getState().packages[0].claim?.name).toBe('Ada');
  });
  it('checks the complete job event before modifying storage',async()=>{
    const store=db(), api=store.getState();await api.saveDraft(parent,time(0));
    const before=api.backup();
    for(const input of [{...create,projectId:'other'},{...create,role:'engineer' as const},{...create,by:'   '},{...create,dueDate:'2026-11-10'},{...create,photo:{ref:'https://elsewhere.invalid/image',sizeBytes:2}},{...create,photo:{...photo,sizeBytes:1}},{...create,pin:{...pin,x:NaN}},{...create,pin:{...pin,planRef:'unrecognised:wall'}}]){
      await expect(api.createJob(input,time(1))).rejects.toThrow();
      expect(api.backup()).toBe(before);
    }
    await api.createJob(create,time(1));
    await expect(api.createJob(create,time(2))).rejects.toThrow('already exists');
    await expect(api.editJob('shower',{startDate:'2026-12-30'},'Ada',time(2))).rejects.toThrow('due date');
    expect(store.getState().packages[1].job?.photo).toEqual(photo);
    await api.editJob('shower',{title:'Mixer fitting',note:'Measure first',dueDate:null,photo:null,pin:{...pin,x:-1.5},status:'waiting'},'Ada',time(2));
    const row=store.getState().packages[1];expect(row.job?.photo).toBeUndefined();expect(row.job?.dueDate).toBeUndefined();
    expect(row.job?.pin.x).toBe(-1.5);expect(row.draft.quantities[0].item).toBe('Mixer fitting');expect(row.draft.scope).toBe('Measure first');
    const fresh=db();await fresh.getState().restoreBackup(api.backup());expect(fresh.getState().packages).toEqual(store.getState().packages);
    const changed=JSON.parse(api.backup());changed.events[1].input.__unknown=true;
    await expect(fresh.getState().restoreBackup(JSON.stringify(changed))).rejects.toThrow('invalid action');expect(fresh.getState().packages).toEqual(store.getState().packages);
  });
  it('projects the actual referenced model parts and confines storey-wide material totals to their scope',async()=>{
    const store=db(), api=store.getState();await api.saveDraft(parent,time(0));await api.createJob(create,time(1));
    await api.saveDraft({...parent,id:'aggregate',sourceKey:'masonry',trade:'general',quantities:[{item:'Blocks',qty:30,unit:'blocks',planRef:'olb:mat:blocks'}]},time(2));
    await api.createJob({...create,id:'light',parentId:undefined,role:'electrical',by:'Ben',pin:{levelId:'ground',x:1,y:.4,z:0,planRef:'olb:room:kitchen'}},time(3));
    const rows=workItems(property,store.getState().packages);
    expect(rows.map(r=>r.id)).toEqual(['light','aggregate','shower',parent.id]);
    expect(rows[1].anchors.map(a=>a.planRef)).toEqual(['olb:level:ground']);
    expect(rows[2].anchors).toEqual([pin]);
    expect(rows[3].anchors[0]).toMatchObject({planRef:'olb:item:sink',x:-1,y:.8});
    expect(workGeometry(property)).toBe(workGeometry(property));expect(pinExists(property,pin)).toBe(true);
    expect(pinExists({...property,rooms:[]},pin)).toBe(false);
    expect(projectTimeline('another',store.getState().packages)).toEqual([]);
    expect(projectTimeline('pilot',store.getState().packages)).toHaveLength(4);
  });
  it('shares the real job via unchanged v1, attributes signed replies, and never confuses an invoice with physical completion',async()=>{
    const store=db(), api=store.getState();await api.saveDraft(parent,time(0));await api.createJob(create,time(1));
    const row=()=>store.getState().packages[1], current=()=>workItems(property,store.getState().packages).find(r=>r.id==='shower')!;
    const work=await sendJob(row());expect(await parseWorkPackage(work,time(4))).toEqual(work);
    expect(work.request).toMatchObject({v:1,title:create.title,description:create.note,quantities:[{qty:1,planRef:pin.planRef}],photos:[photo],currency:'GBP',site:{label:'North parcel'}});
    expect(work.planView!.notes.join(' ')).toContain('height 1.2 m');expect(work.planView!.highlights).toContain(pin.planRef);
    await expect(api.send(work,time(4))).rejects.toThrow('name');await api.send(work,time(4),'Ada');
    const q=await signPack<QuotePack>({...envelope,id:'quote',kind:'quote',createdAt:time(5),validUntil:'2026-11-30',...amounts,assumptions:[],exclusions:[],pricing:{source:'manual'}});
    await api.addAnswer(q,time(6));expect(current()).toMatchObject({status:'planned',exchange:'quote'});
    expect(current().history[0]).toMatchObject({source:'trade-folder',actor:'Trade team'});
    const p=await signPack<StatusPack>({...envelope,id:'report',kind:'status',quoteId:q.id,state:'started',note:'First fix',createdAt:time(6)});
    await api.addAnswer(p,time(7));expect(current().status).toBe('started');
    await api.editJob('shower',{status:'snagged'},'Ada',time(8));expect(current().status).toBe('snagged');
    await api.decide(work.request.id,q.id,'approved',{name:'Morgan',role:'owner'},time(9));
    const invoice=await signPack<InvoicePack>({...envelope,id:'invoice',kind:'invoice',quoteId:q.id,createdAt:time(10),number:'I-1',...amounts});
    await api.addAnswer(invoice,time(11));expect(current()).toMatchObject({status:'snagged',exchange:'invoiced'});
    // Backdated report arrived later but cannot override the worker's newer report.
    await api.addAnswer(await signPack<StatusPack>({...envelope,id:'older',kind:'status',quoteId:q.id,state:'done',note:'Older report',createdAt:time(7)}),time(12));
    expect(current().status).toBe('snagged');
    const backup=api.backup();await api.addAnswer(invoice,time(12));expect(api.backup()).toBe(backup);
    const fresh=db();await fresh.getState().restoreBackup(backup);expect(fresh.getState().packages).toEqual(store.getState().packages);
  });
});
