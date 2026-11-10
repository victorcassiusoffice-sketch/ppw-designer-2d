import { expect, it } from 'vitest';
import { districtDistances } from '../cityAccess';
import { captureBuilding, placeBuilding } from '../cityLibrary';
import { buildingPolygons } from '../cityBuildingForm';
import { emptyCity, normaliseCity, cityPolygonUnionArea } from '../city';
import { CitySchema } from '../cityContract';
import type { Property } from '../../store/propertyStore';

it('keeps a concave house and upper floor to scale through placement and project exchange', () => {
  const polygon = [[0,0],[4,0],[4,1],[1,1],[1,4],[0,4]].map(([x,y]) => ({x,y}));
  const property: Property = { id:'house', name:'Court house', activeRoomId:'ground-room',
    levels:[{id:'ground',name:'Ground',index:0},{id:'first',name:'First',index:1}],
    rooms:['ground','first'].map(levelId => ({id:levelId+'-room',name:'Room',levelId,polygon,placedItems:[]})) };
  const saved = captureBuilding(property,'Court house','lib');
  expect(saved.buildingForm[1].base).toBeGreaterThan(0);
  expect(saved.widthM).toBe(4);
  const a = placeBuilding(saved,'a',12,20), b = placeBuilding(saved,'b',20,12);
  a.rotation = 90;
  expect(cityPolygonUnionArea(buildingPolygons(a))).toBeCloseTo(7);
  expect(a.buildingForm).not.toBe(b.buildingForm);
  const model = {...emptyCity(),enabled:true,assets:[a,b]};
  const distances = districtDistances({...model, roads:[{id:'r',name:'Road',presetId:'custom',widthM:6,baseDepthM:.1,surfaceDepthM:.1,points:[{x:0,y:0},{x:25,y:0}]}]},a);
  expect(distances[0].distance).toBe(20);
  expect(distances[1].distance).toBeNull();
  expect(CitySchema.safeParse(model).success).toBe(true);
  expect(normaliseCity(JSON.parse(JSON.stringify(model)))?.assets).toEqual([a,b]);
  expect(normaliseCity({...model,assets:[{...a,buildingForm:[{base:1,top:0,polygon}]}]})).toBeUndefined();
});
