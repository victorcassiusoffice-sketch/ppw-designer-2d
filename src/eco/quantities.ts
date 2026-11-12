import type { Property } from '../store/propertyStore';
import type { WaterStudy } from '../designer/ecoContract';
import { propertyMaterialsGeometry, footprintUnionArea } from '../designer/propertyMaterials';
import { estimateMaterials, estimateVolumeMix } from '../designer/materials/estimate';
import { gardenSurfacePolygon } from '../designer/garden';
import { polygonArea } from '../lib/geometry';
import { serviceProductById } from '../data/serviceProducts';
import { isOutdoorRoom,isRoofRoom,roomLevelId } from '../designer/levels';
import { levelHeightM } from '../designer/building';
import { roomEdges } from '../designer/wallEdges';
import { openingProfileUnionAreaM2 } from '../designer/openingGeometry';
export function ecoQuantities(p:Property,s:WaterStudy) {
  const geom=propertyMaterialsGeometry(p), report=estimateMaterials(geom,p.materials);
  const rooms=p.rooms.filter(r=>r.polygon.length>=3&&!isOutdoorRoom(r)&&!isRoofRoom(r));
  const area=(id:string|null,blocks=false)=>{
    const r=rooms.find(room=>room.id===id);if(!r)return 0;
    const h=levelHeightM(p,roomLevelId(r));
    return roomEdges(r).reduce((a,e)=>{
      const kind=r.wallConstruction?.find(w=>w.edgeIndex===e.index)?.kind;
      if(r.removedWallEdges?.includes(e.index)||kind==='glass'||(blocks&&kind==='concrete'))return a;
      return a+Math.max(0,e.lengthM*h-openingProfileUnionAreaM2((r.openings??[]).filter(o=>o.edgeIndex===e.index),h,[{t0:0,t1:e.lengthM}]));
    },0);
  };
  const outdoors=p.garden?.surfaces??[], paths=outdoors.filter(g=>g.kind==='path'||g.kind==='gravel'||g.kind==='concrete');
  const selected=paths.find(g=>g.id===s.pavingId);
  const tankL=(p.services?.fixtures??[]).reduce((sum,f)=>sum+(serviceProductById(f.productReferenceId)?.capacityLitres??0),0)+p.rooms.flatMap(r=>r.placedItems).reduce((sum,it)=>sum+(serviceProductById(it.productId)?.capacityLitres??0),0);
  const moss=area(s.mossRoom), gardening=footprintUnionArea(outdoors.filter(g=>g.kind==='soil'||g.kind==='lawn').map(gardenSurfacePolygon));
  const aggregate=estimateVolumeMix(report.totals.concreteNetM3,report.settings.concrete).aggregateM3;
  const slope=geom.roofProfile?.pitchDeg??0;
  return {rooms,paths,moss,block:area(s.blockRoom,true),paving:selected?polygonArea(gardenSurfacePolygon(selected)):0,green:moss+gardening,roof:geom.roofAreaM2,coating:s.coolRoof?geom.roofAreaM2/Math.cos(slope*Math.PI/180):0,stone:aggregate*s.aggregateTM3*s.recycledPct/100,tankL};
}
