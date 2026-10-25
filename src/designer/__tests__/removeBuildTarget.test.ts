/** @vitest-environment jsdom */
import { beforeEach,afterEach,describe,it,expect } from 'vitest';
import { usePropertyStore } from '../../store/propertyStore';
import { useHistoryStore,installHistorySubscriptions,__test } from '../../store/historyStore';
import { removeBuildTarget,pickPlanRemoveTarget,PERIMETER_REMOVE_REASON } from '../removeBuildTarget';
let cleanup:()=>void;
beforeEach(()=>{
  usePropertyStore.getState().resetToDefault();const p=usePropertyStore.getState().property;
  usePropertyStore.setState({property:{...p,activeRoomId:'r',rooms:[{id:'r',name:'Measured room',polygon:[{x:0,y:0},{x:8,y:0},{x:8,y:6},{x:0,y:6}],placedItems:[{instanceId:'chair',productId:'demo-console-table',x:2,y:2,rotation:0}],openings:[{id:'door',edgeIndex:0,offsetM:2,widthM:1,kind:'door',flipFacing:false,flipHand:false}],floorFinish:{materialId:'existing-finish'}}],walls:[{id:'free',a:{x:9,y:1},b:{x:9,y:4},thicknessM:.15,levelId:'ground'}]}});
  __test.resetSubscriptions();cleanup=installHistorySubscriptions({coalesceMs:0});useHistoryStore.getState().reset();
});
afterEach(()=>cleanup());
describe('specific element removal keeps one reversible edit',()=>{
  for(const target of [{kind:'item',instanceId:'chair'},{kind:'opening',openingId:'door'},{kind:'wall',hit:{kind:'free',wallId:'free'}},{kind:'floor',roomId:'r',point:{x:5,y:5}}] as const){
    it(`removes only ${target.kind}, and Undo restores the exact property`,()=>{
      const before=structuredClone(usePropertyStore.getState().property);
      expect(removeBuildTarget(target).ok).toBe(true);
      expect(usePropertyStore.getState().property.rooms[0].polygon).toEqual(before.rooms[0].polygon);
      expect(useHistoryStore.getState().past).toHaveLength(1);
      useHistoryStore.getState().undo();expect(usePropertyStore.getState().property).toEqual(before);
    });
  }
  it('refuses a closed room boundary without changing geometry, quantities or history',()=>{
    const before=structuredClone(usePropertyStore.getState().property);
    expect(removeBuildTarget({kind:'wall',hit:{kind:'edge',roomId:'r',edgeIndex:1}})).toEqual({ok:false,message:PERIMETER_REMOVE_REASON});
    expect(usePropertyStore.getState().property).toEqual(before);expect(useHistoryStore.getState().past).toHaveLength(0);
  });
  it('picks an opening ahead of its wall and the clicked object ahead of its floor',()=>{
    const p=usePropertyStore.getState().property;
    expect(pickPlanRemoveTarget(p,'ground',{x:2,y:0},.1)).toEqual({kind:'opening',openingId:'door'});
    expect(pickPlanRemoveTarget(p,'ground',{x:2.3,y:2.2},.1)).toEqual({kind:'item',instanceId:'chair'});
    expect(pickPlanRemoveTarget(p,'ground',{x:9,y:2},.1)).toEqual({kind:'wall',hit:{kind:'free',wallId:'free'}});
  });
  it('erases one tile, retaining adjacent tiles and unrelated materials',()=>{
    const p=usePropertyStore.getState().property;
    usePropertyStore.setState({property:{...p,rooms:[{...p.rooms[0],floorFinish:null,floorTiles:[{materialId:'a',tileWm:1,tileHm:1,originM:{x:0,y:0},runs:[0,0,2]},{materialId:'b',tileWm:1,tileHm:1,originM:{x:4,y:4},runs:[0,0,1]}]}]}});
    expect(removeBuildTarget({kind:'floor',roomId:'r',point:{x:.2,y:.2}}).ok).toBe(true);
    expect(usePropertyStore.getState().property.rooms[0].floorTiles?.map(z=>z.runs)).toEqual([[0,1,1],[0,0,1]]);
  });
});
