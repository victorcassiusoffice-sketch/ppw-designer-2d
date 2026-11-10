import { describe, expect, it } from 'vitest';
import type { Property, Room } from '../../../store/propertyStore';
import { polygonArea } from '../../../lib/geometry';
import { SERVICE_MATERIALS } from '../../../data/buildingServicesCatalog';
import { estimateServices, SERVICE_FIXTURES, SERVICE_SYSTEMS } from '../../buildingServices';
import type { ServiceFixture, ServiceFixtureKind, ServiceRun, ServiceSystem } from '../../buildingServices';
import { defaultFoundationRebar, estimateFoundation, type FoundationElement } from '../../foundation';
import { defaultMaterialsSettings, estimateMaterials } from '../../materials';
import { propertyMaterialsGeometry } from '../../propertyMaterials';
import { packagesFromProperty } from '../packages';

const rect = (x:number, y:number, w:number, h:number) => [{x,y}, {x:x+w,y}, {x:x+w,y:y+h}, {x,y:y+h}];
const room = (id: string, polygon: Room['polygon'], more: Partial<Room> = {}): Room =>
  ({ id, name:id, polygon, placedItems:[], ...more });
const run = (id:string, levelId:string, system:ServiceSystem): ServiceRun => {
  const material = SERVICE_MATERIALS.find(m => m.system === system);
  return { id, levelId, system, materialId:material?.id ?? 'custom', diameterMm:material?.nominalDiameterMm ?? 20,
    startElevationM:0, endElevationM:2, points:[{x:0,y:0,elevationM:0}, {x:2,y:0,elevationM:0}, {x:2,y:0,elevationM:2}] };
};
const fixture = (id:string, levelId:string, kind:ServiceFixtureKind):ServiceFixture =>
  ({ ...SERVICE_FIXTURES[kind], id, levelId, kind, x:1, y:1, rotation:0 });
const firstPlan = ():Property => {
  const materials=defaultMaterialsSettings();
  materials.scope='active'; materials.plaster.sides=2; materials.base.enabled=true;
  materials.pillars.count=2; materials.roof.kind='sheet';
  const r1=room('studio',rect(0,0,4,4), {openings:[{id:'d',kind:'door',edgeIndex:0,offsetM:1,widthM:.9,heightM:2,flipFacing:false,flipHand:false}]});
  const r2=room('wash',rect(4,0,2,4), {floorFinish:{materialId:'gym-interlock'}});
  // A concave upstairs floor; its bounding box is not its floor area.
  const r3=room('suite',[{x:0,y:0},{x:4,y:0},{x:4,y:2},{x:2,y:2},{x:2,y:3},{x:0,y:3}], {levelId:'L2'});
  return { id:'project-A', name:'Courtyard project', activeRoomId:'studio', materials, activeLevelId:'L2',
    levels:[{id:'ground', name:'Ground floor',index:0},{id:'L2',name:'Upper floor',index:1}],
    rooms:[r1,r2,r3,room('garden',rect(0,0,20,20),{kind:'outdoor'}),room('roof',rect(0,0,4,4),{kind:'roof'})],
    services:{ version:1, runs:[run('cw','ground','cold-water'),run('hot','L2','hot-water'),run('w','L2','waste'),
      run('spr','ground','fire-water'),run('e','ground','electrical'),run('net','L2','data'),run('air','L2','ventilation')],
    fixtures:[fixture('basin','ground','sink'),fixture('toilet','L2','toilet'),fixture('tap','ground','mains-tap'),
      fixture('db','ground','electrical-board'),fixture('cam','L2','security-camera'),fixture('fan','L2','extractor-fan')] } };
};
const pad = (id:string,x:number):FoundationElement => ({ id,name:id,kind:'pad',x,y:0,lengthM:4,widthM:4,depthM:.5,topElevationM:0,
  excavation:{depthM:1,topElevationM:0,marginM:.25,stage:'filled'},rebar:defaultFoundationRebar() });
const secondPlan = ():Property => {
  const materials=defaultMaterialsSettings(); materials.base.enabled=true; materials.base.areaOverrideM2=900;
  materials.roof.kind='reinforced-concrete'; materials.roof.depthM=.3; materials.roof.rebar.enabled=true;materials.roof.rebar.lapLengthM=.4;
  return { id:'project-B',name:'Foundation project',activeRoomId:'slab',rooms:[room('slab',rect(0,0,8,4))],materials,
    foundation:{version:1,enabled:true,elements:[pad('left',0),pad('right',1)]} };
};
const wire=(n:number)=>Number(n.toFixed(3));
/** Independent reconciliation against the engine reports / drawing. Package
 * output never provides the expected number. Unknown lines fail this audit. */
function reconcile(p:Property) {
  const previous=JSON.stringify(p);
  const generated=packagesFromProperty(p);
  const materials=estimateMaterials(propertyMaterialsGeometry(p,'all'),p.materials);
  const foundation=p.foundation && estimateFoundation(p.foundation,materials.settings.concrete);
  const service=p.services && estimateServices(p.services);
  for(const draft of generated) for(const line of draft.quantities) {
    const [,kind,...parts]=line.planRef.split(':'); const id=parts.join(':');
    let expected:number|undefined;
    let label:string|undefined;
    switch(kind) {
      case 'mat': { const src=materials.lines.find(row=>row.id===id); expected=src?.quantity; label=src?.label; break; }
      case 'fnd': {
        expect(p.foundation?.elements.some(el=>el.id===id)).toBe(true);
        if(line.item==='Excavation'){expected=foundation?.totalExcavationVolumeM3??undefined;label='Excavation';}
        else {expected=foundation?.rebar.find(el=>el.elementId===id)?.takeoff.bars;label=p.foundation?.elements.find(el=>el.id===id)?.name+' foundation rebar';}
        break;
      }
      case 'run': { const row=service?.find(s=>s.id===id), source=p.services?.runs.find(s=>s.id===id);
        expected=row?.lengthM;label=SERVICE_MATERIALS.find(m=>m.id===row?.materialId)?.label??SERVICE_SYSTEMS.find(s=>s.id===source?.system)?.label;
        expect(draft.levelIds).toEqual([source?.levelId]);break; }
      case 'item': {const src=p.services?.fixtures.find(f=>f.id===id);
        expect(src).toBeDefined(); expected=1;label=src && SERVICE_FIXTURES[src.kind].label;break;}
      case 'room': {const src=p.rooms.find(r=>r.id===id);
        expected=src && polygonArea(src.polygon);label=src?.name;break;}
    }
    expect(expected,`No engine value for ${line.planRef}`).toBeDefined();
    expect(line.qty,line.planRef).toBe(wire(expected!));
    expect(line.item,line.planRef).toBe(label);
  }
  expect(JSON.stringify(p)).toBe(previous);
  return generated;
}

describe('trade drafts use measured quantities without procurement duplication',()=>{
  it('matches every line of a shared-wall, multi-level plan with sheet roofing, finishes and 3D services',()=>{
    const p=firstPlan(), groups=reconcile(p), lines=groups.flatMap(g=>g.quantities), refs=lines.map(l=>l.planRef);
    expect(new Set(groups.map(g=>g.category))).toEqual(new Set(['masonry','concrete','roofing','plastering','plumbing','electrical','flooring','tiling']));
    for(const ref of ['olb:mat:blocks','olb:mat:mortar-bags','olb:mat:mortar-sand','olb:mat:plaster-area','olb:mat:plaster-bags',
      'olb:mat:base-concrete','olb:mat:pillars-concrete','olb:mat:sheets','olb:mat:roof-fasteners','olb:run:cw','olb:run:hot',
      'olb:run:w','olb:run:spr','olb:run:e','olb:run:net','olb:item:basin','olb:item:db','olb:room:studio','olb:room:wash','olb:room:suite']) expect(refs).toContain(ref);
    for(const ref of ['olb:mat:concrete-total','olb:mat:cement-total','olb:mat:mortar-cement','olb:mat:mortar-volume','olb:run:air',
      'olb:item:fan','olb:room:garden','olb:room:roof']) expect(refs).not.toContain(ref);
    expect(new Set(refs).size).toBe(refs.length);
    expect(lines.find(l=>l.planRef==='olb:run:cw')?.qty).toBe(4); // 2m plan + 2m vertical.
    expect(lines.find(l=>l.planRef==='olb:room:suite')?.qty).toBe(10);
    expect(groups.find(g=>g.category==='tiling')?.quantities.map(l=>l.planRef)).toEqual(['olb:room:wash']);
  });
  it('matches every line of overlapping excavated and filled footings below a reinforced roof; no legacy base or duplicate roof volume',()=>{
    const p=secondPlan(), groups=reconcile(p), lines=groups.flatMap(g=>g.quantities);
    const measured=estimateFoundation(p.foundation!,p.materials!.concrete);
    expect(measured.overlapM3).toBeGreaterThan(0);
    expect(lines.filter(l=>l.item==='Excavation').map(l=>l.qty)).toEqual([wire(measured.totalExcavationVolumeM3!)]);
    expect(lines.filter(l=>l.planRef==='olb:mat:base-concrete').map(l=>l.qty)).toEqual([wire(measured.concreteOrderM3)]);
    expect(groups.find(g=>g.category==='concrete')?.quantities.map(l=>l.planRef)).toContain('olb:mat:roof-concrete');
    expect(groups.find(g=>g.category==='roofing')?.quantities.map(l=>l.planRef)).toEqual(['olb:mat:rebar-bars']);
    expect(lines.filter(l=>l.planRef==='olb:mat:roof-concrete')).toHaveLength(1);
  });
  it('partitions over 50 lines by storey and then batch, never losing a quantity or changing a key on reorder',()=>{
    const p=firstPlan();
    p.services!.runs=Array.from({length:111},(_,i)=>run(`r${i}`,i<55?'ground':'L2','cold-water'));
    p.services!.fixtures=[];
    const drafts=()=>packagesFromProperty(p).filter(g=>g.category==='plumbing');
    const before=drafts(); expect(before.map(g=>g.quantities.length)).toEqual([50,5,50,6]);
    expect(new Set(before.flatMap(g=>g.quantities).map(l=>l.planRef)).size).toBe(111);
    p.services!.runs.reverse();
    expect(drafts().sort((a,b)=>a.key.localeCompare(b.key))).toEqual(before.sort((a,b)=>a.key.localeCompare(b.key)));
  });
  it('records withheld overlapping bore quantities as a review item rather than silently returning zero',()=>{
    const bore={id:'one',name:'Bore',x:0,y:0,diameterM:1,depthM:2,topElevationM:0};
    const p:Property={id:'bore',name:'Bores',activeRoomId:'',rooms:[],foundation:{version:1,enabled:true,elements:[],bores:[bore,{...bore,id:'two'}]}};
    const draft=packagesFromProperty(p).find(g=>g.category==='concrete');
    expect(draft?.quantities).toEqual([]);expect(draft?.scope).toContain('withheld');
  });
  it('supports an exclusive user room-trade choice without adding its area twice or pricing stock',()=>{
    const p=firstPlan(), drafts=packagesFromProperty(p,{roomTrades:{studio:'tiling',wash:'flooring'}});
    expect(drafts.find(g=>g.category==='tiling')?.quantities.map(l=>l.planRef)).toEqual(['olb:room:studio']);
    const roomLines=drafts.flatMap(d=>d.quantities).filter(l=>l.planRef.startsWith('olb:room:'));
    expect(roomLines).toHaveLength(3);
    for(const l of roomLines) expect(Object.keys(l).sort()).toEqual(['item','planRef','qty','unit']);
  });
  it('refuses unrepresentable identifiers rather than silently changing a source reference',()=>{
    const p=firstPlan(); p.rooms[0].id='room / broken';
    expect(()=>packagesFromProperty(p)).toThrow(/plan reference/);
  });
});
