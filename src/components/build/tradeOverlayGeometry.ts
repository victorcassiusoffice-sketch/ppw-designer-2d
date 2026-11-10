import { cameraBasis, cameraPosition, projectPoint } from '../../designer/roomView3d';
import { cutawayState, type WallSolid } from '../../designer/roomSolids';
import { pointInPolygon } from '../../lib/geometry';
import { foundationElementBounds, type FoundationModel } from '../../designer/foundation';
import type { PlanView } from '../../designer/link/planView';
import type { WorkPin } from '../../designer/link/tradeWork';
import type { OverlayFrame } from './TradeOverlayHost';

export type OverlayGeometry = Pick<PlanView,'levels'|'rooms'|'walls'|'openings'|'runs'|'items'>;
type V = {x:number;y:number};
type W = V & {z:number};
export type Ink = {d:string; line:boolean};
type Wall = OverlayGeometry['walls'][number];
const xy = ([x,y]:number[]):V => ({x,y});
const pt = (x:number,y:number,z:number):W=>({x,y,z});
const ref=(kind:string,id:string)=>'olb:'+kind+':'+id;
const same=(a:V,b:V)=>Math.hypot(a.x-b.x,a.y-b.y)<1e-5;
const bounded=(v:number,a:number,b:number)=>Math.max(a,Math.min(b,v));
function segment(p:V,a:V,b:V) {
  const dx=b.x-a.x,dy=b.y-a.y,d2=dx*dx+dy*dy;
  const t=d2?bounded(((p.x-a.x)*dx+(p.y-a.y)*dy)/d2,0,1):0;
  const x=a.x+dx*t,y=a.y+dy*t;
  return {x,y,t,distance:Math.hypot(x-p.x,y-p.y)};
}
function rotatedRect(i:OverlayGeometry['items'][number]):V[] {
  const a=i.rotationDeg*Math.PI/180,c=Math.cos(a),s=Math.sin(a);
  return [[-1,-1],[1,-1],[1,1],[-1,1]].map(([dx,dy])=>{
    const x=dx*i.sizeM[0]/2,y=dy*i.sizeM[1]/2;
    return {x:i.center[0]+c*x-s*y,y:i.center[1]+s*x+c*y};
  });
}
function sameWall(s:WallSolid,w:Wall) {
  return (same(s.a,xy(w.a))&&same(s.b,xy(w.b)))||(same(s.a,xy(w.b))&&same(s.b,xy(w.a)));
}
/** 3D uses the actual renderer camera (including orthographic views). The
 * painter fallback uses the very same projection as the existing canvas. */
export function frameProjector(frame:OverlayFrame):(world:W)=>V|null {
  if(frame.view==='plan'){
    const m=frame.viewport.scale*frame.pxPerMetre;
    return p=>({x:frame.viewport.x+m*p.x,y:frame.viewport.y+m*p.y});
  }
  if(frame.backend==='gl')return p=>frame.stageRef.current?.projectPoint(p.x,p.y,p.z)??null;
  const basis=cameraBasis(frame.camera);
  return p=>projectPoint(p,basis,frame.camera,frame.size);
}
function path(points:W[],project:(p:W)=>V|null,closed:boolean):string {
  if(!points.length)return '';
  const screen=points.map(project);
  if(screen.some(p=>!p||!Number.isFinite(p.x)||!Number.isFinite(p.y)))return '';
  return screen.map((p,i)=>(i?'L':'M')+p!.x.toFixed(2)+' '+p!.y.toFixed(2)).join(' ')+(closed?' Z':'');
}
function equalStorey(l:string|undefined,level:string){return (l??'ground')===level}
/** References are resolved against the current measured geometry each time,
 * not multiplied by an assumed drawing scale or stored as screen pixels. */
export function overlayProjection(frame:OverlayFrame,g:OverlayGeometry,foundation?:FoundationModel) {
  const project=frameProjector(frame);
  const elevation=(level:string)=>g.levels.find(l=>l.id===level)?.elevationM??0;
  const shown=frame.view==='house'&&frame.wallView==='cutaway'
    ? cutawayState(frame.solids,cameraPosition(frame.camera),frame.camera.target) : undefined;
  function wallState(w:Wall) {
    if(frame.view==='plan')return w.heightM;
    const solids=frame.solids.walls.filter(s=>equalStorey(s.levelId,w.levelId)&&sameWall(s,w)&&!s.renderDuplicateOf);
    return Math.max(0,...solids.map(s=>{
      const v=frame.wallView==='up'?'full':frame.wallView==='down'?'stub':shown?.get(s.key);
      return v==='hidden'?0:v==='stub'?s.stubHeightM:s.heightM;
    }));
  }
  function ink(pin:WorkPin,wholeLevel=true):Ink[] {
    const level=pin.levelId,base=elevation(level),r=pin.planRef;
    const P=(p:V,z=0)=>pt(p.x,p.y,base+z);
    const poly=(v:W[])=>({d:path(v,project,true),line:false});
    const line=(v:W[])=>({d:path(v,project,false),line:true});
    if(!r)return [];
    if(r.startsWith('olb:fnd:')&&foundation?.enabled){
      const id=r.slice('olb:fnd:'.length),e=foundation.elements.find(v=>v.id===id),bore=foundation.bores?.find(v=>v.id===id);
      let outline:V[]=[],top=0,bottom=0;
      if(e){const b=foundationElementBounds(e);top=b.maxElevationM;bottom=b.minElevationM;
        outline=[{x:b.minX,y:b.minY},{x:b.maxX,y:b.minY},{x:b.maxX,y:b.maxY},{x:b.minX,y:b.maxY}];}
      if(bore){top=bore.topElevationM;bottom=top-bore.depthM;outline=Array.from({length:32},(_,i)=>({x:bore.x+Math.cos(i*Math.PI/16)*bore.diameterM/2,y:bore.y+Math.sin(i*Math.PI/16)*bore.diameterM/2}));}
      if(!outline.length)return [];
      const faces=[poly(outline.map(v=>P(v,top)))];
      if(frame.view==='house'&&e)for(let i=0;i<outline.length;i++){const a=outline[i],b=outline[(i+1)%outline.length];faces.push(poly([P(a,top),P(b,top),P(b,bottom),P(a,bottom)]));}
      return faces;
    }
    if(r===ref('level',level)&&!wholeLevel){
      // A location chosen in open ground is a spot, not a claim on the
      // entire storey. Give the measured pin a screen-space ring.
      const q=project(P(pin,pin.z)); if(!q)return [];
      return [{d:`M${q.x-8} ${q.y}a8 8 0 1 0 16 0a8 8 0 1 0 -16 0Z`,line:false}];
    }
    const room=g.rooms.find(v=>v.levelId===level&&r===ref('room',v.id));
    if(room||r===ref('level',level)){
      const rooms=room?[room]:g.rooms.filter(v=>v.levelId===level);
      if(!rooms.length&&wholeLevel)return g.walls.filter(w=>w.levelId===level).flatMap(w=>ink({...pin,planRef:ref('wall',w.id)}));
      return rooms.flatMap(v=>{
        const floor=frame.view==='house'?frame.solids.floors.find(f=>equalStorey(f.levelId,level)&&f.roomId===v.id):undefined;
        if(frame.view==='house'&&!floor)return [];
        const contour=poly(v.polygon.map(a=>P(xy(a))));
        for(const hole of floor?.holes??[])contour.d+=' '+path(hole.map(a=>P(a)),project,true);
        return contour.d.trim()?[contour]:[];
      });
    }
    const opening=g.openings.find(v=>r===ref('opening',v.id));
    const wall=g.walls.find(v=>v.levelId===level&&(r===ref('wall',v.id)||opening?.wallId===v.id));
    if(wall){
      const a=xy(wall.a),b=xy(wall.b),height=wallState(wall),length=Math.hypot(a.x-b.x,a.y-b.y);
      if(!height||!length)return [];
      const along=(t:number,z:number)=>P({x:a.x+(b.x-a.x)*t/length,y:a.y+(b.y-a.y)*t/length},z);
      if(opening){
        const l=opening.offsetM,h=l+opening.widthM,bottom=opening.sillM??0,top=Math.min(height,bottom+opening.heightM);
        if(frame.view==='plan')return [line([along(l,0),along(h,0)])];
        return top<=bottom?[]:[poly([along(l,bottom),along(h,bottom),along(h,top),along(l,top)])];
      }
      if(frame.view==='plan')return [line([P(a),P(b)])];
      const surface=poly([P(a),P(b),P(b,height),P(a,height)]);
      for(const o of g.openings.filter(v=>v.wallId===wall.id)){
        const lo=o.sillM??0,hi=Math.min(height,lo+o.heightM);
        if(lo>=hi)continue;
        surface.d+=' '+path([along(o.offsetM,lo),along(o.offsetM+o.widthM,lo),along(o.offsetM+o.widthM,hi),along(o.offsetM,hi)],project,true);
      }
      return [surface];
    }
    const run=g.runs.find(v=>v.levelId===level&&r===ref('run',v.id));
    if(run)return [line(run.points.map(v=>P(xy(v),v[2])))];
    const item=g.items.find(v=>v.levelId===level&&r===ref('item',v.id));
    if(item){
      const solid=frame.view==='house'?frame.solids.items.find(i=>i.instanceId===item.id):undefined;
      return [poly(rotatedRect(item).map(v=>P(v,solid?solid.z1-base:pin.z)))];
    }
    return [];
  }
  return {ink,screen:(pin:WorkPin)=>project(pt(pin.x,pin.y,pin.z+elevation(pin.levelId)))};
}
function pin(levelId:string,p:V,z:number,planRef:string):WorkPin {
  return {levelId,x:p.x,y:p.y,z,planRef};
}
export function planPin(p:V,g:OverlayGeometry,levelId:string,radius:number):WorkPin {
  const walls=g.walls.filter(w=>w.levelId===levelId).map(w=>({w,...segment(p,xy(w.a),xy(w.b))})).sort((a,b)=>a.distance-b.distance);
  const wall=walls[0];
  const wallOrOpening=()=>{
    const pos=wall.t*Math.hypot(wall.w.a[0]-wall.w.b[0],wall.w.a[1]-wall.w.b[1]);
    const opening=g.openings.find(o=>o.wallId===wall.w.id&&pos>=o.offsetM&&pos<=o.offsetM+o.widthM);
    return pin(levelId,wall,opening?.sillM??0,opening?ref('opening',opening.id):ref('wall',wall.w.id));
  };
  if(wall&&wall.distance<=wall.w.thicknessM/2)return wallOrOpening();
  const item=g.items.find(i=>i.levelId===levelId&&pointInPolygon(p,rotatedRect(i)));
  if(item)return pin(levelId,p,0,ref('item',item.id));
  let closest:WorkPin|null=null,best=radius;
  for(const r of g.runs.filter(v=>v.levelId===levelId)){
    for(let i=1;i<r.points.length;i++){
      const a=r.points[i-1],b=r.points[i],s=segment(p,xy(a),xy(b));
      if(s.distance<=best){best=s.distance;closest=pin(levelId,s,a[2]+(b[2]-a[2])*s.t,ref('run',r.id));}
    }
  }
  if(closest&&(!wall||best<wall.distance))return closest;
  if(wall&&wall.distance<=radius)return wallOrOpening();
  if(closest)return closest;
  const room=g.rooms.find(r=>r.levelId===levelId&&pointInPolygon(p,r.polygon.map(xy)));
  return pin(levelId,p,0,room?ref('room',room.id):ref('level',levelId));
}
/** Recover the touched height along a projected vertical. Perspective is
 * monotone, but not linear, so binary search uses actual GPU screen points. */
export function touchHeight(p:V,base:number,height:number,at:V,project:(x:W)=>V|null) {
  const b=project(pt(p.x,p.y,base)),t=project(pt(p.x,p.y,base+height));
  if(!b||!t||same(b,t))return 0;
  const measure=(q:V)=>(q.x-b.x)*(t.x-b.x)+(q.y-b.y)*(t.y-b.y);
  let lo=0,hi=height;
  for(let j=0;j<16;j++){const z=(lo+hi)/2,m=project(pt(p.x,p.y,base+z));if(!m)break;if(measure(m)<measure(at))lo=z;else hi=z;}
  return (lo+hi)/2;
}
export function pickPixel(frame:OverlayFrame,g:OverlayGeometry,screen:V):WorkPin|null {
  const level=frame.levelId,base=g.levels.find(l=>l.id===level)?.elevationM;
  if(base===undefined)return null; // Virtual roof is not a physical Plan View storey.
  if(frame.view==='plan'){
    const m=frame.pxPerMetre*frame.viewport.scale;
    if(!m)return null;
    return planPin({x:(screen.x-frame.viewport.x)/m,y:(screen.y-frame.viewport.y)/m},g,level,Math.min(.35,12/m));
  }
  const stage=frame.stageRef.current;
  if(frame.backend!=='gl'||!stage)return null;
  const at=stage.hitErase(screen.x,screen.y);
  const project=frameProjector(frame);
  if(at?.kind==='wall'){
    const actual=stage.wallPoint(screen.x,screen.y);
    const solid=frame.solids.walls.find(s=>equalStorey(s.levelId,level)&&s.hit.kind===at.hit.kind&&
      (at.hit.kind==='edge'?s.hit.roomId===at.hit.roomId&&s.hit.edgeIndex===at.hit.edgeIndex:s.hit.wallId===at.hit.wallId));
    const wall=solid&&g.walls.find(w=>w.levelId===level&&sameWall(solid,w));
    if(actual&&wall){
      const s=segment(actual,xy(wall.a),xy(wall.b));
      return pin(level,s,touchHeight(actual,base,wall.heightM,screen,project),ref('wall',wall.id));
    }
  }
  if(at?.kind==='opening'){
    const o=g.openings.find(o=>o.id===at.openingId),w=g.walls.find(w=>w.id===o?.wallId&&w.levelId===level);
    if(o&&w){const len=Math.hypot(w.a[0]-w.b[0],w.a[1]-w.b[1]);if(len){const t=(o.offsetM+o.widthM/2)/len;
      return pin(level,{x:w.a[0]+(w.b[0]-w.a[0])*t,y:w.a[1]+(w.b[1]-w.a[1])*t},(o.sillM??0)+o.heightM/2,ref('opening',o.id));}}
  }
  const itemId=at?.kind==='item'?at.instanceId:stage.hitServiceFixture?.(screen.x,screen.y);
  const i=itemId&&g.items.find(i=>i.id===itemId&&i.levelId===level);
  if(i){
    const s=frame.solids.items.find(s=>s.instanceId===i.id);
    return pin(level,xy(i.center),s?(s.z0+s.z1)/2-base:0,ref('item',i.id));
  }
  // Services are linear parts, including risers. Pick their rendered segment,
  // not the plane below a pipe at ceiling height.
  let runPin:WorkPin|null=null,nearest=8;
  for(const run of g.runs.filter(r=>r.levelId===level))for(let n=1;n<run.points.length;n++){
    const a=run.points[n-1],b=run.points[n],pa=project(pt(a[0],a[1],base+a[2])),pb=project(pt(b[0],b[1],base+b[2]));
    if(!pa||!pb)continue;
    const s=segment(screen,pa,pb);
    if(s.distance<nearest){nearest=s.distance;runPin=pin(level,{x:a[0]+(b[0]-a[0])*s.t,y:a[1]+(b[1]-a[1])*s.t},a[2]+(b[2]-a[2])*s.t,ref('run',run.id));}
  }
  if(runPin)return runPin;
  if(at?.kind==='floor')return pin(level,at.point,0,ref('room',at.roomId));
  const floor=stage.floorPoint(screen.x,screen.y);
  if(!floor||!Number.isFinite(floor.x)||!Number.isFinite(floor.y))return null;
  const room=g.rooms.find(r=>r.levelId===level&&pointInPolygon(floor,r.polygon.map(xy)));
  return pin(level,floor,0,room?ref('room',room.id):ref('level',level));
}
