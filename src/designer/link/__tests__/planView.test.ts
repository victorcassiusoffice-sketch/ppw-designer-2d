import { describe, expect, it } from 'vitest';
import planJson from '../../../../docs/link/fixture-plan-view.json';
import requestJson from '../../../../docs/link/fixture-request.json';
import type { Property } from '../../../store/propertyStore';
import { projectFingerprint } from '../../projectHub';
import { buildWorkPackage, parsePlanView, parseWorkPackage, readAnswer, signPlanView, type PlanView, type WorkPackageInput } from '../planView';
import { packLink, parsePack, signPack } from '../vendor/tradefolder/lib/jobPack/protocol';
import type { QuotePack, RequestPack } from '../vendor/tradefolder/lib/jobPack/types';

const now='2026-10-28T00:00:00.000Z';
const fixture=()=>structuredClone(planJson) as PlanView;
const work=(view:PlanView|null=fixture(),request:unknown=requestJson)=>({type:'ppw-work-package',v:1,request,planView:view});
async function modified(change:(view:PlanView)=>void) {
  const body=fixture();
  change(body);
  return signPlanView(body);
}
describe('checked file exchange', () => {
  it('reads both pinned fixtures, their enclosing work file and a request without a plan', async () => {
    expect((await parsePack(requestJson,now)).sha256).toBe('cd8e33d1a57b689c2ed8436bafae7d598e8541b91e7df85ff2f3d16718d92c24');
    expect((await parsePlanView(JSON.stringify(planJson),now)).sha256).toBe('7492ca24d66bbd93baad6818a73a263ab7b9b2eee381780fb2fcf5fe849a4b1d');
    expect(await parseWorkPackage(JSON.stringify(work()),now)).toEqual(work());
    expect(await parseWorkPackage(work(null),now)).toEqual(work(null));
  });
  it('checks the UTF-8 size of the file before parsing, even for whitespace and multibyte input', async () => {
    await expect(parsePlanView(' '.repeat(300001),now)).rejects.toThrow(/too large/);
    await expect(parseWorkPackage('池'.repeat(133334),now)).rejects.toThrow(/too large/);
  });
  it('refuses unknown fields and versions', async () => {
    await expect(parsePlanView({...fixture(),address:'private'},now)).rejects.toThrow(/newer version/);
    await expect(parsePlanView({...fixture(),v:2},now)).rejects.toThrow(/newer version/);
    await expect(parseWorkPackage({...work(),notes:'private'},now)).rejects.toThrow(/newer version/);
  });
  it('refuses damage, future or invalid instants', async () => {
    await expect(parsePlanView({...fixture(),phase:'Phase 2'},now)).rejects.toThrow(/changed or is damaged/);
    await expect(parsePlanView(await modified(v=>{v.createdAt='2027-01-01T00:00:00.000Z';}),now)).rejects.toThrow(/future/);
    await expect(parsePlanView(await modified(v=>{v.createdAt='2026-02-31T00:00:00.000Z';}),now)).rejects.toThrow(/date/);
  });
  it('rejects repeated IDs, missing levels, dangling openings, rooms and highlights', async () => {
    await expect(parsePlanView(await modified(v=>{v.rooms[1].id=v.rooms[0].id;}),now)).rejects.toThrow(/same ID/);
    await expect(parsePlanView(await modified(v=>{v.walls[0].levelId='other';}),now)).rejects.toThrow(/level missing/);
    await expect(parsePlanView(await modified(v=>{v.openings[0].wallId='other';}),now)).rejects.toThrow(/wall missing/);
    await expect(parsePlanView(await modified(v=>{v.items[0].roomId='other';}),now)).rejects.toThrow(/room missing/);
    await expect(parsePlanView(await modified(v=>{v.highlights.push('olb:room:other');}),now)).rejects.toThrow(/highlight/);
  });
  it('rejects a mismatched request ID, quantity order, sender, and request from Trade Folder', async () => {
    await expect(parseWorkPackage(work(await modified(v=>{v.requestId='other';})),now)).rejects.toThrow(/different request/);
    await expect(parseWorkPackage(work(await modified(v=>{v.quantities.reverse();})),now)).rejects.toThrow(/different quantities/);
    await expect(parseWorkPackage(work(await modified(v=>{v.from.label='Another sender';})),now)).rejects.toThrow(/different senders/);
    const foreign=await signPack<RequestPack>({...requestJson as RequestPack,from:{app:'tradefolder',label:'Trade'}});
    await expect(parseWorkPackage(work(null,foreign),now)).rejects.toThrow(/wrong app/);
  });
  it('accepts checked files and carried answers, and never treats requests as answers', async () => {
    const quote=await signPack<QuotePack>({type:'ppw-job-pack',v:1,kind:'quote',id:'quote-1',requestId:requestJson.id,
      from:{app:'tradefolder',label:'Sample trade'},createdAt:now,expiresAt:'2026-11-28T00:00:00.000Z',
      lines:[{kind:'labour',text:'Fit a basin',qty:2,unit:'h',rate:100,amount:200}],
      subtotal:200,vat:{rate:0,included:true},total:200,currency:'MUR',validUntil:'2026-11-09',assumptions:[],exclusions:[],pricing:{source:'manual'}});
    await expect(readAnswer(JSON.stringify(quote),now)).resolves.toEqual(quote);
    const link=await packLink(quote,'https://onelivebuild.com/designer');
    expect(link).toBeTruthy(); await expect(readAnswer(link!,now)).resolves.toEqual(quote);
    await expect(readAnswer(JSON.stringify(requestJson),now)).rejects.toThrow(/quote, progress report or invoice/);
  });
});
describe('measured extract and privacy boundary', () => {
  const property:Property={id:'source',name:'Internal property name',activeRoomId:'room',levels:[{id:'ground',name:'Ground',index:0},{id:'upper',name:'Upper',index:1}],
    rooms:[{id:'room',name:'Workshop',polygon:[{x:-1,y:2},{x:3,y:2},{x:3,y:4},{x:-1,y:6}],placedItems:[{instanceId:'chair-1',productId:'chair',x:-1,y:2,rotation:90}],
      wallConstruction:[{kind:'glass',edgeIndex:0,thicknessMm:12}],openings:[{id:'door',edgeIndex:0,kind:'door',offsetM:1,widthM:.8,flipFacing:false,flipHand:false}]},
      {id:'secret-room',levelId:'upper',name:'Other level',polygon:[{x:0,y:0},{x:2,y:0},{x:0,y:2}],placedItems:[]}],
    walls:[{id:'partition',a:{x:1,y:1},b:{x:1,y:3},thicknessM:.2}],
    services:{version:1,runs:[{id:'riser',levelId:'ground',system:'cold-water',materialId:'private supplier',diameterMm:20,startElevationM:-1,endElevationM:2,
      points:[{x:1,y:3},{x:1,y:3}]}],fixtures:[{id:'basin',levelId:'ground',kind:'sink',x:1,y:3,widthM:.8,depthM:.48,heightM:.17,rotation:90,connectionLabel:'private meter'}]}};
  const input:WorkPackageInput={property,now:requestJson.createdAt,requestId:'request-1',viewId:'pv-1',project:{id:'p1',label:'Example'},
    site:{id:'site1',kind:'build-site',label:'Plot 4'},package:{id:'package1',title:'Plumbing',trade:'plumbing'},phase:'Rough-in',companyName:'Builder',
    requesterType:'developer',description:'Check installation on site.',currency:'MUR',revision:1,levelIds:['ground'],
    quantities:[{item:'Cold water',qty:3,unit:'m',planRef:'olb:run:riser'}],resolveItem:()=>({label:'Chair',widthM:.8,depthM:.5})};
  it('preserves the 2D axis, item centres, wall thickness, opening positions and vertical run heights', async () => {
    const exported=await buildWorkPackage(input);
    expect(exported.request.expiresAt).toBe('2026-11-26T12:00:00.000Z');
    const view=exported.planView!;
    expect(view.levels.map(l=>l.id)).toEqual(['ground']);
    expect(view.rooms[0]).toMatchObject({polygon:[[-1,2],[3,2],[3,4],[-1,6]],areaM2:12});
    expect(view.items.find(i=>i.id==='chair-1')).toMatchObject({center:[-.75,2.4],sizeM:[.8,.5],rotationDeg:90});
    expect(view.items.find(i=>i.id==='basin')).toMatchObject({center:[1,3],roomId:'room'});
    expect(view.walls[0]).toMatchObject({a:[-1,2],b:[3,2],thicknessM:.012});
    expect(view.openings[0]).toMatchObject({wallId:view.walls[0].id,offsetM:.6});
    expect(view.openings[0].widthM).toBeCloseTo(.8);
    expect(view.runs[0]).toMatchObject({points:[[1,3,-1],[1,3,2]],lengthM:3});
    expect(view.plan.fingerprint).toBe(await projectFingerprint(property));
    expect(view.highlights).toContain('olb:run:riser');
    expect(view.quantities).toEqual(exported.request.quantities);
    expect(JSON.stringify(exported)).not.toMatch(/Internal property|Other level|private supplier|private meter|rateCard|bankDetails/i);
  });
  it('places the gap at the same physical endpoints when two rooms share a reversed wall', async () => {
    const site:Property={id:'p',name:'p',activeRoomId:'left',rooms:[
      {id:'left',name:'Left',polygon:[{x:0,y:0},{x:2,y:0},{x:2,y:4},{x:0,y:4}],placedItems:[]},
      {id:'right',name:'Right',polygon:[{x:2,y:0},{x:4,y:0},{x:4,y:4},{x:2,y:4}],placedItems:[],
        openings:[{id:'shared',kind:'window',edgeIndex:3,offsetM:1,widthM:1.2,sillM:.9,flipFacing:false,flipHand:false}]}]};
    const {planView}=await buildWorkPackage({...input,property:site,quantities:[]});
    const view=planView!, opening=view.openings[0], wall=view.walls.find(w=>w.id===opening.wallId)!;
    expect(view.walls).toHaveLength(7);
    expect(wall.a).toEqual([2,0]);expect(wall.b).toEqual([2,4]);
    // OLB centre is y=3 (one metre along the reverse edge). The Trade Folder
    // gap is [offset,offset+width], so its drawing must omit y=2.4 through 3.6.
    expect(opening.offsetM).toBeCloseTo(2.4);expect(opening.offsetM+opening.widthM).toBeCloseTo(3.6);
  });
  it('does not serialise unknown draft fields, private budgets, notes, or extra quantity fields', async () => {
    const enriched={...input,planned:12345,notes:'SECRET',site:{...input.site,address:'SECRET'},
      quantities:input.quantities.map(q=>({...q,rate:'SECRET'}))};
    expect(JSON.stringify(await buildWorkPackage(enriched))).not.toMatch(/12345|SECRET/);
  });
});
