import { describe,expect,it } from 'vitest';
import { Box3 } from 'three';
import { pilotDemonstration } from '../pilotDemonstrations';
import { buildingSolids } from '../../../designer/buildingScene';
import { defaults } from '../../../eco/water';
import type { Property } from '../../../store/propertyStore';
describe('ground-level pilot demonstrations',()=>{
 it('keeps the placed positions in both the House and Walk scene builder',()=>{
   const property:Property={id:'p',name:'Example',activeRoomId:'r',rooms:[],eco:{version:1,trees:[],greenRoofs:[],waterStudy:{...defaults,wind:true,windPoint:{x:8,y:-3},kinetic:true,kineticPoint:{x:1,y:6}}}};
   const scene=()=>({rooms:[],walls:[],cameraPos:{x:0,y:0,z:3},cameraTarget:{x:0,y:0,z:0},wallHeightM:3});
   for(const view of ['building','floor'] as const)expect(buildingSolids(property,scene,view,false).pilotItems).toEqual([{kind:'wind',x:8,y:-3},{kind:'kinetic',x:1,y:6}]);
   const wind=new Box3().setFromObject(pilotDemonstration('wind')),paving=new Box3().setFromObject(pilotDemonstration('kinetic'));expect(wind.max.y).toBeGreaterThan(3);expect(paving.min.y).toBeCloseTo(0);expect(paving.max.x-paving.min.x).toBeCloseTo(1.2);
 });
});
