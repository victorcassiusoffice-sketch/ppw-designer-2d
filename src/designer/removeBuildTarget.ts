import { usePropertyStore, roomOpenings, type Property } from '../store/propertyStore';
import { beginDrawTransaction, endDrawTransaction } from '../store/historyStore';
import { getProductById } from '../data/products';
import { rotatedFootprint, pointInPolygon, type Vertex } from '../lib/geometry';
import { roomEdges } from './wallEdges';
import { openingSpan } from './openings';
import { roomLevelId } from './levels';
import { tileAt, tileRect, runsToSet, setToRuns } from './floorTiles';
import type { WallHit } from './roomView3d';

export type RemoveBuildTarget = { kind:'item'; instanceId:string } | { kind:'opening'; openingId:string }
  | { kind:'wall'; hit:WallHit } | { kind:'floor'; roomId:string; point:Vertex };
export const PERIMETER_REMOVE_REASON = 'Room-boundary removal is not available here: the closed room and its measurements are kept. Separate drawn walls can be removed.';
const distance = (p:Vertex,a:Vertex,b:Vertex) => {
  const dx=b.x-a.x,dy=b.y-a.y,length=Math.hypot(dx,dy),t=length?Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(length*length))):0;
  return { distance:Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dy),along:t*length };
};
function floorTile(property:Property, target:Extract<RemoveBuildTarget,{kind:'floor'}>) {
  const room=property.rooms.find(r=>r.id===target.roomId);
  for(const [index,zone] of (room?.floorTiles??[]).entries()) {
    const tile=tileAt(zone,target.point),key=`${tile.row},${tile.col}`;
    if(runsToSet(zone.runs).has(key))return {room,zone,index,key,rect:tileRect(zone,tile.row,tile.col)};
  }
  return null;
}
/** Semantic 2D picking uses the same measured objects and wall openings as 3D. */
export function pickPlanRemoveTarget(property:Property,level:string,p:Vertex,toleranceM:number):RemoveBuildTarget|null {
  const rooms=property.rooms.filter(r=>roomLevelId(r)===level);
  for(const room of rooms) for(const opening of roomOpenings(room)) {
    const edge=roomEdges(room).find(e=>e.index===opening.edgeIndex);if(!edge)continue;
    const hit=distance(p,edge.a,edge.b),span=openingSpan(opening);
    if(hit.distance<=toleranceM&&hit.along>=span.t0&&hit.along<=span.t1)return {kind:'opening',openingId:opening.id};
  }
  for(const room of rooms)for(const item of [...room.placedItems].reverse()) {
    const product=getProductById(item.productId);if(!product)continue;
    const {w,h}=rotatedFootprint({lengthM:product.dimensions_cm.length/100,widthM:product.dimensions_cm.width/100},item.rotation);
    if(p.x>=item.x&&p.y>=item.y&&p.x<=item.x+w&&p.y<=item.y+h)return {kind:'item',instanceId:item.instanceId};
  }
  for(const wall of property.walls??[])if(roomLevelId(wall)===level&&distance(p,wall.a,wall.b).distance<=Math.max(toleranceM,wall.thicknessM/2))return {kind:'wall',hit:{kind:'free',wallId:wall.id}};
  for(const room of rooms)for(const edge of roomEdges(room))if(distance(p,edge.a,edge.b).distance<=toleranceM)return {kind:'wall',hit:{kind:'edge',roomId:room.id,edgeIndex:edge.index}};
  for(const room of rooms)if(pointInPolygon(p,room.polygon)&&(room.floorFinish||room.floorTiles?.length)) {
    const target:RemoveBuildTarget={kind:'floor',roomId:room.id,point:p};if(room.floorFinish||floorTile(property,target))return target;
  }
  return null;
}
export function removeTargetMessage(target:RemoveBuildTarget|null):string {
  if(!target)return 'Hover to highlight · tap to remove · Esc to finish';
  if(target.kind==='wall'&&target.hit.kind==='edge')return PERIMETER_REMOVE_REASON;
  return target.kind==='floor'?'Remove this floor finish; the room and structure stay.':`Remove this ${target.kind==='opening'?'door or window':target.kind==='wall'?'drawn wall':'object'} · Undo is available`;
}
/** One deliberate release, one existing history transaction. Never deletes a room. */
export function removeBuildTarget(target:RemoveBuildTarget):{ok:boolean;message:string} {
  const store=usePropertyStore.getState(),property=store.property;
  if(target.kind==='wall'&&target.hit.kind==='edge')return {ok:false,message:PERIMETER_REMOVE_REASON};
  const exists=target.kind==='item'?property.rooms.some(r=>r.placedItems.some(i=>i.instanceId===target.instanceId))
    :target.kind==='opening'?property.rooms.some(r=>roomOpenings(r).some(o=>o.id===target.openingId))
    :target.kind==='wall'?property.walls?.some(w=>w.id===target.hit.wallId)
    :property.rooms.some(r=>r.id===target.roomId&&(r.floorFinish||floorTile(property,target)));
  if(!exists)return {ok:false,message:'That element is no longer available.'};
  beginDrawTransaction('remove element');
  try {
    if(target.kind==='item')store.removeItem(target.instanceId);
    else if(target.kind==='opening')store.removeOpening(target.openingId);
    else if(target.kind==='wall')store.removeFreeWall(target.hit.wallId!);
    else {
      const tile=floorTile(property,target);
      if(tile) {
        const remaining=runsToSet(tile.zone.runs);remaining.delete(tile.key);
        const zones=tile.room!.floorTiles!.map((zone,index)=>index===tile.index?{...zone,runs:setToRuns(remaining)}:zone).filter(zone=>zone.runs.length);
        usePropertyStore.setState({property:{...property,rooms:property.rooms.map(r=>r.id===target.roomId?{...r,floorTiles:zones.length?zones:undefined}:r)}});
      } else store.clearRoomFloor(target.roomId);
    }
  } finally {endDrawTransaction();}
  return {ok:true,message:'Removed · Undo restores it.'};
}
export function removeTargetOutline(property:Property,target:RemoveBuildTarget|null):Vertex[] {
  if(!target)return [];
  if(target.kind==='floor') {
    const tile=floorTile(property,target);if(tile){const {x,y,w,h}=tile.rect;return [{x,y},{x:x+w,y},{x:x+w,y:y+h},{x,y:y+h}];}
    return property.rooms.find(r=>r.id===target.roomId)?.polygon??[];
  }
  if(target.kind==='item')for(const room of property.rooms){const item=room.placedItems.find(i=>i.instanceId===target.instanceId),p=item&&getProductById(item.productId);if(item&&p){const {w,h}=rotatedFootprint({lengthM:p.dimensions_cm.length/100,widthM:p.dimensions_cm.width/100},item.rotation);return [{x:item.x,y:item.y},{x:item.x+w,y:item.y},{x:item.x+w,y:item.y+h},{x:item.x,y:item.y+h}];}}
  if(target.kind==='wall') {if(target.hit.kind==='free'){const wall=property.walls?.find(w=>w.id===target.hit.wallId);return wall?[wall.a,wall.b]:[];}const room=property.rooms.find(r=>r.id===target.hit.roomId),edge=room&&roomEdges(room).find(e=>e.index===target.hit.edgeIndex);return edge?[edge.a,edge.b]:[];}
  if(target.kind==='opening')for(const room of property.rooms){const o=roomOpenings(room).find(o=>o.id===target.openingId),edge=o&&roomEdges(room).find(e=>e.index===o.edgeIndex);if(o&&edge){const span=openingSpan(o);return [{x:edge.a.x+edge.dx*span.t0,y:edge.a.y+edge.dy*span.t0},{x:edge.a.x+edge.dx*span.t1,y:edge.a.y+edge.dy*span.t1}];}}
  return [];
}
const cursorSvg=(path:string)=>`url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><path d="${path}" fill="#f6e7cf" stroke="#633d25" stroke-width="2" stroke-linejoin="round"/></svg>`)}") 16 16, crosshair`;
export function removeCursor(target:RemoveBuildTarget|null):string {
  if(target?.kind==='item'||target?.kind==='opening')return 'pointer';
  if(target?.kind==='floor')return cursorSvg('M13 2h6v5h-6z M16 7v12 M10 18h12v5l-6 7-6-7z');
  if(target?.kind==='wall')return cursorSvg('M3 19h20v7H3z M7 10h11v9H7z M11 6h7v8h-7z M23 18l6-7v17h-6z');
  return 'crosshair';
}
