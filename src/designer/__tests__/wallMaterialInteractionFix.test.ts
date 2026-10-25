// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { usePropertyStore, normaliseLoadedProperty, type Room } from '../../store/propertyStore';
import { useDesignerUIStore } from '../../store/designerUIStore';
import { applyWallPaintBrush } from '../wallPaintBrush';
import { resolvedWallSurfaces } from '../wallConstruction';
import { defaultMaterialsSettings, estimateMaterials } from '../materials';
import { propertyMaterialsGeometry } from '../propertyMaterials';
import { estimateMaterialCosts, materialsProcurement, setMaterialRate } from '../materials/costs';

const rect = (id: string, x = 0, levelId = 'ground'): Room => ({ id, name: id, levelId, placedItems: [],
  polygon: [{ x, y: 0 }, { x: x + 4, y: 0 }, { x: x + 4, y: 3 }, { x, y: 3 }] });
beforeEach(() => {
  usePropertyStore.getState().resetToDefault();
  usePropertyStore.setState(s => ({ property: { ...s.property, rooms: [rect('a'), rect('b', 4), rect('upper', 0, 'upper')],
    activeRoomId: 'a', wallHeightM: 2.7, materials: defaultMaterialsSettings(), walls: [] } }));
  useDesignerUIStore.getState().setWallPaintDraft({ operation: 'construction', construction: 'brick', scope: 'wall', erase: false });
});

describe('visible material application and shared measured dimensions', () => {
  it('exposes brick on both faces of a shared wall without changing another wall or another floor', () => {
    usePropertyStore.setState(s => ({ property: { ...s.property, rooms: s.property.rooms.map(r => ({ ...r,
      wallPaint: [{ edgeIndex: r.id === 'b' ? 3 : 1, paintId: 'permoglaze-matt-emulsion' }, { edgeIndex: 0, paintId: 'permoglaze-matt-emulsion' }],
      wallCladding: [{ edgeIndex: r.id === 'b' ? 3 : 1, productId: 'test-cladding' }] })) } }));
    expect(applyWallPaintBrush({ kind: 'edge', roomId: 'a', edgeIndex: 1 }).kind).toBe('success');
    const [a, b, upper] = usePropertyStore.getState().property.rooms;
    expect(a.wallConstruction).toContainEqual({ edgeIndex: 1, kind: 'brick', thicknessMm: 150 });
    expect(b.wallConstruction).toContainEqual({ edgeIndex: 3, kind: 'brick', thicknessMm: 150 });
    for (const room of [a, b]) {
      expect(room.wallPaint?.map(p => p.edgeIndex)).toEqual([0]);
      expect(room.wallCladding).toEqual([]);
    }
    expect(upper.wallPaint).toHaveLength(2);
    expect(resolvedWallSurfaces(a).wallColourByEdge.get(1)).toBe('#A36B50');
    expect(resolvedWallSurfaces(a).wallThicknessByEdge.get(1)).toBe(.15);
  });

  it('passes selected glass thickness through the same brush and rejects nonexistent walls', () => {
    useDesignerUIStore.getState().setWallPaintDraft({ construction: 'glass', thicknessMm: 12 });
    applyWallPaintBrush({ kind: 'edge', roomId: 'a', edgeIndex: 0 });
    expect(usePropertyStore.getState().property.rooms[0].wallConstruction?.[0]).toMatchObject({ kind: 'glass', thicknessMm: 12 });
    const before = usePropertyStore.getState().property;
    expect(applyWallPaintBrush({ kind: 'edge', roomId: 'missing', edgeIndex: 0 }).kind).toBe('warn');
    expect(applyWallPaintBrush({ kind: 'edge', roomId: 'a', edgeIndex: 99 }).kind).toBe('warn');
    expect(usePropertyStore.getState().property).toBe(before);
  });

  it('synchronises masonry across storeys, leaves glass and centre lines intact, and survives loading', () => {
    usePropertyStore.getState().setWallConstruction('a', 0, 'glass', { thicknessMm: 12 });
    const polygons = usePropertyStore.getState().property.rooms.map(r => r.polygon);
    usePropertyStore.getState().setMasonryWallThickness(.3);
    const property = usePropertyStore.getState().property;
    expect(property.rooms.map(r => r.polygon)).toEqual(polygons);
    expect(property.materials?.wall.thicknessM).toBe(.3);
    expect(property.rooms[0].wallConstruction?.find(e => e.edgeIndex === 0)?.thicknessMm).toBe(12);
    expect(property.rooms[2].wallConstruction?.every(e => e.thicknessMm === 300)).toBe(true);
    const restored = normaliseLoadedProperty(JSON.parse(JSON.stringify(property)));
    expect(restored.rooms[2].wallConstruction?.every(e => e.thicknessMm === 300)).toBe(true);
    for (const invalid of [NaN, Infinity, 0, 3]) usePropertyStore.getState().setMasonryWallThickness(invalid);
    expect(usePropertyStore.getState().property).toBe(property);
  });

  it('uses the existing net-area formula: doubled concrete thickness doubles volume, not area', () => {
    const settings = defaultMaterialsSettings(); settings.wall.kind = 'concrete';
    usePropertyStore.getState().setMaterialsSettings(settings);
    const before = usePropertyStore.getState().property;
    const first = estimateMaterials(propertyMaterialsGeometry(before), before.materials);
    usePropertyStore.getState().setMasonryWallThickness(.3);
    const after = usePropertyStore.getState().property;
    const second = estimateMaterials(propertyMaterialsGeometry(after), after.materials);
    expect(second.totals.wallNetAreaM2).toBe(first.totals.wallNetAreaM2);
    expect(second.totals.concreteNetM3).toBeCloseTo(first.totals.concreteNetM3 * 2, 8);
  });

  it('carries saved thickness into new rooms, reshaped room edges and new separate walls', () => {
    const store = usePropertyStore.getState(); store.setMasonryWallThickness(.3);
    const drawn = store.addRoom({ polygon: rect('new', 15).polygon });
    const rectangle = store.addRectangleRoom('New room', { lengthM: 4, widthM: 3 }, { x: 25, y: 0 });
    store.setRoomPolygon(drawn, [{x:15,y:0},{x:19,y:0},{x:19,y:3},{x:17,y:4},{x:15,y:3}]);
    store.addFreeWalls([{ a:{x:30,y:0},b:{x:33,y:0},thicknessM:.12 }, { a:{x:30,y:2},b:{x:33,y:2},thicknessM:.012,construction:'glass' }]);
    const property = usePropertyStore.getState().property;
    for (const id of [drawn, rectangle]) {
      const room = property.rooms.find(r=>r.id===id)!;
      expect(room.polygon.every(point=>Number.isFinite(point.x)&&Number.isFinite(point.y))).toBe(true);
      expect(room.wallConstruction).toHaveLength(room.polygon.length);
      expect(room.wallConstruction?.every(e=>e.thicknessMm===300)).toBe(true);
    }
    expect(property.walls?.map(w=>w.thicknessM)).toEqual([.3,.012]);
  });

  it('invalidates a block quotation after the thickness specification changes', () => {
    let settings = defaultMaterialsSettings(); settings.quotationTaxBasis = 'inclusive';
    const geometry = propertyMaterialsGeometry(usePropertyStore.getState().property);
    const block = materialsProcurement(estimateMaterials(geometry, settings)).find(line => line.id === 'blocks')!;
    settings = setMaterialRate(settings, block, 50);
    usePropertyStore.getState().setMaterialsSettings(settings);
    const unchanged = usePropertyStore.getState().property;
    usePropertyStore.getState().setMasonryWallThickness(.15);
    expect(usePropertyStore.getState().property).toBe(unchanged);
    expect(usePropertyStore.getState().property.materials?.wall.presetId).toBe('ubp-150');
    const first = estimateMaterialCosts(estimateMaterials(geometry, settings)).lines.find(line => line.id === 'blocks')!;
    expect(first.needsReview).toBe(false); expect(first.unitRateMur).toBe(50);
    usePropertyStore.getState().setMasonryWallThickness(.2);
    const second = estimateMaterialCosts(estimateMaterials(geometry, usePropertyStore.getState().property.materials)).lines.find(line => line.id === 'blocks')!;
    expect(second.needsReview).toBe(true); expect(second.unitRateMur).toBeNull();
  });
});
