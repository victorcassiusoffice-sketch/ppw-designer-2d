import type { Property } from '../../store/propertyStore';
import { GROUND_LEVEL_ID, isRoofLevel, levelsOf } from '../levels';
import { projectGeometry } from './planGeometry';
import type { WorkPin } from './tradeJobs';

type Geometry=ReturnType<typeof projectGeometry>;
type SpatialIndex={geometry:Geometry;refs:Map<string,WorkPin>};
const cache=new WeakMap<Property,SpatialIndex>();

// The overlay reads the same metres and deduplicated walls as the work file.
// No quantity estimator runs here; a camera gesture must not rebuild geometry.
function spatialIndex(property:Property):SpatialIndex {
  const cached=cache.get(property);if(cached)return cached;
  const levelIds=levelsOf(property).filter(l=>!isRoofLevel(l)).map(l=>l.id);
  const g=projectGeometry(property,levelIds);
  const refs=new Map<string,WorkPin>();
  const put=(kind:string,id:string,levelId:string,x:number,y:number,z=0)=>{
    if([x,y,z].every(Number.isFinite))refs.set('olb:'+kind+':'+id,{levelId,x,y,z,planRef:'olb:'+kind+':'+id});
  };
  for(const r of g.rooms){
    if(!r.polygon.length)continue;
    // Use an interior horizontal scanline (mean-of-vertices can sit outside a concave room).
    const ys=[...new Set(r.polygon.map(p=>p[1]))].sort((a,b)=>a-b);
    const middle=Math.floor(ys.length/2),y=(ys[middle]+ys[Math.max(0,middle-1)])/2;
    const xs:number[]=[];
    r.polygon.forEach(([x1,y1],i)=>{const [x2,y2]=r.polygon[(i+1)%r.polygon.length];if((y1>y)!==(y2>y))xs.push(x1+(x2-x1)*(y-y1)/(y2-y1));});
    xs.sort((a,b)=>a-b);let span=-1,x=r.polygon[0][0];
    for(let i=0;i+1<xs.length;i+=2)if(xs[i+1]-xs[i]>span){span=xs[i+1]-xs[i];x=(xs[i]+xs[i+1])/2;}
    put('room',r.id,r.levelId,x,y);
  }
  for(const w of g.walls)put('wall',w.id,w.levelId,(w.a[0]+w.b[0])/2,(w.a[1]+w.b[1])/2,w.heightM/2);
  const walls=new Map(g.walls.map(w=>[w.id,w]));
  for(const o of g.openings){const w=walls.get(o.wallId);if(!w)continue;
    const length=Math.hypot(w.b[0]-w.a[0],w.b[1]-w.a[1]);if(!length)continue;
    const t=(o.offsetM+o.widthM/2)/length;put('opening',o.id,w.levelId,w.a[0]+t*(w.b[0]-w.a[0]),w.a[1]+t*(w.b[1]-w.a[1]),(o.sillM??0)+o.heightM/2);}
  for(const r of g.runs){const point=r.points[Math.floor((r.points.length-1)/2)];if(point)put('run',r.id,r.levelId,...point);}
  for(const i of g.items)put('item',i.id,i.levelId,...i.center);
  if(property.foundation?.enabled)for(const e of [...property.foundation.elements,...(property.foundation.bores??[])])
    put('fnd',e.id,GROUND_LEVEL_ID,e.x,e.y,e.topElevationM);
  for(const l of g.levels){
    const zone=[...refs.values()].find(p=>p.levelId===l.id);
    if(zone)put('level',l.id,l.id,zone.x,zone.y);
  }
  const result={geometry:g,refs};cache.set(property,result);return result;
}
export const workGeometry=(property:Property)=>spatialIndex(property).geometry;
export function pinExists(property:Property,pin:WorkPin):boolean{
  const {geometry,refs}=spatialIndex(property);
  if(pin.planRef==='olb:level:'+pin.levelId)return geometry.levels.some(l=>l.id===pin.levelId);
  return refs.get(pin.planRef)?.levelId===pin.levelId;
}
export function measuredAnchors(property:Property,levelIds:string[],lines:{planRef?:string}[]):WorkPin[]{
  const {refs}=spatialIndex(property), anchors=new Map<string,WorkPin>();
  const levels=new Set(levelIds);
  for(const q of lines){
    if(!q.planRef)continue;
    const pin=refs.get(q.planRef);
    if(pin&&levels.has(pin.levelId))anchors.set(pin.planRef,pin);
    else if(q.planRef.startsWith('olb:mat:'))for(const level of levels){
      // A schedule total is not an individual wall measurement. Mark its
      // storey scope rather than inventing an allocation to particular walls.
      const levelPin=refs.get('olb:level:'+level);if(levelPin)anchors.set(levelPin.planRef,levelPin);
    }
  }
  if(!anchors.size)for(const l of levels){const pin=refs.get('olb:level:'+l);if(pin)anchors.set(pin.planRef,pin);}
  return [...anchors.values()];
}
