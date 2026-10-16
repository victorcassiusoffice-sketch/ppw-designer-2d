// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { glassTakeoff } from '../../data/mauritiusGlass';
import { sanitizeWallMaterialSpec, remapConstruction, resolvedWallSurfaces } from '../wallConstruction';
import { propertyMaterialsGeometry } from '../propertyMaterials';
import { defaultMaterialsSettings, estimateMaterials } from '../materials';
import { buildSolids } from '../roomSolids';
import { usePropertyStore, normaliseLoadedProperty, type Property } from '../../store/propertyStore';
import { openingProfileAreaM2 } from '../openingGeometry';

const rectangle = (x = 0) => [{x,y:0},{x:x+4,y:0},{x:x+4,y:3},{x,y:3}];
const property = (): Property => ({ id:'glass',name:'Glass test',wallHeightM:2.7,activeRoomId:'a',rooms:[{id:'a',name:'a',polygon:rectangle(),placedItems:[]}] });

describe('sourced glass takeoffs and physical wall integrity', () => {
  it('converts square metres and millimetres once, and separates laminate interlayer from glass mass', () => {
    expect(glassTakeoff(10,10)).toMatchObject({ areaM2:10,volumeM3:.1,glassMassKg:250 });
    const laminate = glassTakeoff(10,10.38,'birmingham-laminated-10-38')!;
    expect(laminate.volumeM3).toBeCloseTo(.1038,8);
    expect(laminate.glassMassKg).toBe(250);
    expect(laminate.excludesInterlayerMass).toBe(true);
    expect(glassTakeoff(10,12,'birmingham-laminated-10-38')!.reference).toBeUndefined();
    expect(glassTakeoff(-1,10)).toBeNull();
    expect(glassTakeoff(1,NaN)).toBeNull();
  });
  it('does not carry supplier association over a changed thickness or different substrate', () => {
    expect(sanitizeWallMaterialSpec('glass',{thicknessMm:12,materialProductId:'birmingham-tempered-10'})).toEqual({thicknessMm:12});
    expect(sanitizeWallMaterialSpec('glass',{thicknessMm:10,materialProductId:'birmingham-tempered-10'})).toEqual({thicknessMm:10,materialProductId:'birmingham-tempered-10'});
    expect(sanitizeWallMaterialSpec('brick',{thicknessMm:10,materialProductId:'birmingham-tempered-10'})).toEqual({});
    expect(remapConstruction([{edgeIndex:0,kind:'glass',thicknessMm:12}], [1,0,2,3], rectangle())).toEqual([{edgeIndex:1,kind:'glass',thicknessMm:12}]);
  });
  it('persists exact thickness and clears incompatible coatings when a shared wall becomes glass', () => {
    const p=property(); p.rooms.push({id:'b',name:'b',polygon:rectangle(4),placedItems:[]});
    p.rooms[0].wallPaint=[{edgeIndex:1,paintId:'permoglaze-matt-emulsion'}];
    usePropertyStore.setState({property:p});
    usePropertyStore.getState().setWallConstruction('a',1,'glass',{thicknessMm:12,materialProductId:'birmingham-tempered-12'});
    const saved=normaliseLoadedProperty(usePropertyStore.getState().property)!;
    expect(saved.rooms[0].wallConstruction).toContainEqual({edgeIndex:1,kind:'glass',thicknessMm:12,materialProductId:'birmingham-tempered-12'});
    expect(saved.rooms[1].wallConstruction).toContainEqual({edgeIndex:3,kind:'glass',thicknessMm:12,materialProductId:'birmingham-tempered-12'});
    expect(saved.rooms[0].wallPaint?.some(e=>e.edgeIndex===1) ?? false).toBe(false);
    const geometry=propertyMaterialsGeometry(saved);
    const glasses=geometry.walls.filter(w=>w.construction==='glass');
    expect(glasses.reduce((n,w)=>n+w.lengthM,0)).toBeCloseTo(3,8);
    const report=estimateMaterials(geometry,defaultMaterialsSettings());
    expect(report.lines.find(l=>l.id.startsWith('glass-')&&l.unit==='m²')?.net).toBeCloseTo(8.1,8);
    expect(report.totals.wallNetAreaM2).toBeCloseTo((25-3)*2.7,8);
  });
  it('deducts a circular cutout by its canonical profile and renders the same glass thickness', () => {
    const p=property(); const room=p.rooms[0];
    room.wallConstruction=[{edgeIndex:0,kind:'glass',thicknessMm:10}];
    room.openings=[{id:'round',edgeIndex:0,offsetM:2,widthM:1,heightM:1,sillM:.8,kind:'hole',shape:'circle',flipHand:false,flipFacing:false}];
    const geometry=propertyMaterialsGeometry(p);
    const cut=geometry.walls.reduce((n,w)=>n+w.openingAreaM2,0);
    expect(cut).toBeCloseTo(openingProfileAreaM2(room.openings[0],2.7),8);
    expect(cut).toBeCloseTo(Math.PI/4,2);
    const solids=buildSolids({rooms:[{...room,items:[],...resolvedWallSurfaces(room)}],walls:[],wallHeightM:2.7,cameraPos:{x:10,y:10,z:10},cameraTarget:{x:0,y:0,z:0}});
    expect(solids.walls[0].thicknessM).toBe(.01);
    expect(solids.walls[0].openings[0]).toMatchObject({id:'round',kind:'hole',shape:'circle'});
    expect(solids.walls[0].openings[0].profile!.length).toBeGreaterThanOrEqual(64);
  });
  it('excludes explicitly concrete wall faces from blocks while retaining their concrete volume', () => {
    const p=property(); p.rooms[0].wallConstruction=[{edgeIndex:0,kind:'concrete'}];
    const geometry=propertyMaterialsGeometry(p), settings=defaultMaterialsSettings();
    settings.base.enabled=false; settings.roof.kind='none'; settings.pillars.count=0;
    const report=estimateMaterials(geometry,settings);
    expect(report.totals.concreteNetM3).toBeCloseTo(4*2.7*settings.wall.thicknessM,8);
    expect(report.lines.find(l=>l.id==='blocks')!.formula).toContain('27 m²');
  });
});
