import {describe,it,expect} from 'vitest';
import type {Property} from '../store/propertyStore';
import {ecoQuantities} from './quantities';
import {defaults} from './water';
const rect=[{x:0,y:0},{x:4,y:0},{x:4,y:3},{x:0,y:3}];
const plan:Property={id:'study',name:'Study',activeRoomId:'a',wallHeightM:3,rooms:[{id:'a',name:'Room A',polygon:rect,placedItems:[],removedWallEdges:[1],wallConstruction:[{edgeIndex:2,kind:'glass'}]}],garden:{surfaces:[{id:'path',kind:'path',x:6,y:0,widthM:2,depthM:3,elevationM:0}],fences:[]}};
describe('eco quantities follow the drawing',()=>{
 it('measures one finish face and ignores a removed edge and glazing',()=>{const q=ecoQuantities(plan,{...defaults,mossRoom:'a',blockRoom:'a',pavingId:'path',coolRoof:true});expect(q.moss).toBeCloseTo(21);expect(q.block).toBe(q.moss);expect(q.paving).toBe(6);expect(q.roof).toBe(12);expect(q.coating).toBe(12)});
 it('does not retain quantities for a deleted target',()=>{const q=ecoQuantities({...plan,rooms:[],garden:undefined},{...defaults,mossRoom:'a',pavingId:'path'});expect(q.moss+q.paving+q.roof).toBe(0)});
});
