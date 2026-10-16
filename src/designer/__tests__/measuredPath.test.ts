// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { polygonArea } from '../../lib/geometry';
import { sampleMeasuredPath, isSimpleMeasuredPolygon, type MeasuredPath } from '../measuredPath';
import { usePropertyStore, normaliseLoadedProperty } from '../../store/propertyStore';
import { useMeasuredPathToolStore } from '../../store/measuredPathToolStore';
import { useDesignerUIStore } from '../../store/designerUIStore';
import { roofMeasuredAreas, createRoofSurface } from '../roofSurface';
import { syncRoofRooms } from '../roof';
import { DEFAULT_ROOF_CONFIG } from '../building';
import { propertyMaterialsGeometry } from '../propertyMaterials';
import { defaultMaterialsSettings, estimateMaterials } from '../materials';

const curvedRoom: MeasuredPath = { start: { x: 0, y: 0 }, segments: [
  { kind: 'line', to: { x: 4, y: 0 } },
  { kind: 'quadratic', control: { x: 2, y: 2 }, to: { x: 0, y: 0 } },
], closed: true };
const rectangle: MeasuredPath = { start: { x: 0, y: 0 }, segments: [
  { kind: 'line', to: { x: 4, y: 0 } }, { kind: 'line', to: { x: 4, y: 3 } }, { kind: 'line', to: { x: 0, y: 3 } },
], closed: true };
beforeEach(() => { usePropertyStore.getState().resetToDefault(); useMeasuredPathToolStore.getState().cancel(); });

describe('canonical measured curves', () => {
  it('bounds quadratic tessellation error and retains analytical area and length', () => {
    const sample = sampleMeasuredPath(curvedRoom)!;
    expect(sample.vertices.length).toBeGreaterThan(10);
    expect(sample.maxDeviationM).toBeLessThanOrEqual(.003);
    expect(sample.areaM2).toBeCloseTo(8 / 3, 2);
    expect(sample.lengthM).toBeCloseTo(4 + 2 * (Math.sqrt(2) + Math.asinh(1)), 2);
    expect(sample.vertices[0]).toEqual({ x: 0, y: 0 });
    expect(sample.vertices[sample.vertices.length - 1]).not.toEqual(sample.vertices[0]);
  });
  it('rejects malformed, self-crossing and reversed overlapping paths', () => {
    expect(sampleMeasuredPath({ ...rectangle, start: { x: NaN, y: 0 } })).toBeNull();
    expect(isSimpleMeasuredPolygon([{ x: 0, y: 0 }, { x: 2, y: 2 }, { x: 0, y: 2 }, { x: 2, y: 0 }])).toBe(false);
    expect(sampleMeasuredPath({ start: { x: 0, y: 0 }, segments: [{ kind: 'line', to: { x: 4, y: 0 } }, { kind: 'line', to: { x: 2, y: 0 } }] })).toBeNull();
  });
  it('forms a curved room from canonical wall edges and keeps dimensions/material on save-load', () => {
    const store = usePropertyStore.getState();
    expect(store.addWallPath(curvedRoom, 'ground', .12, { construction: 'glass', thicknessMm: 12 }).length).toBeGreaterThan(10);
    const property = usePropertyStore.getState().property;
    const room = property.rooms.find(r => r.polygon.length >= 3)!;
    expect(polygonArea(room.polygon)).toBeCloseTo(8 / 3, 2);
    expect(room.wallConstruction?.length).toBe(room.polygon.length);
    expect(room.wallConstruction?.every(edge => edge.kind === 'glass' && edge.thicknessMm === 12)).toBe(true);
    expect(property.walls).toHaveLength(0);
    const loaded = normaliseLoadedProperty(JSON.parse(JSON.stringify(property)));
    expect(loaded.rooms.find(r => r.id === room.id)?.polygon).toEqual(room.polygon);
    expect(loaded.rooms.find(r => r.id === room.id)?.wallConstruction).toEqual(room.wallConstruction);
  });
  it('rejects a bow outside the plot even when both ends fit', () => {
    usePropertyStore.getState().setSite({ widthM: 4, depthM: 4, originM: { x: 0, y: 0 } });
    const path: MeasuredPath = { start: { x: 0, y: 0 }, segments: [{ kind: 'quadratic', to: { x: 4, y: 0 }, control: { x: 2, y: -4 } }] };
    expect(usePropertyStore.getState().addWallPath(path)).toEqual([]);
  });
  it('has a three-tap curve workflow with cancellation and no hidden zoom/data writes', () => {
    const property = usePropertyStore.getState().property;
    useDesignerUIStore.getState().setWallPaintDraft({ construction: 'glass', thicknessMm: 8 });
    const tool = useMeasuredPathToolStore.getState();
    tool.startTool('wall', property.id, 'ground');
    tool.tap({ x: 0, y: 0 }); tool.tap({ x: 4, y: 0 });
    expect(usePropertyStore.getState().property).toBe(property);
    tool.tap({ x: 2, y: 1 });
    const walls = usePropertyStore.getState().property.walls!;
    expect(walls.length).toBeGreaterThan(10);
    expect(walls.every(w => w.thicknessM === .008 && w.construction === 'glass')).toBe(true);
    expect(Math.max(...walls.map(w => w.b.y))).toBeCloseTo(1);
    const committed = usePropertyStore.getState().property;
    tool.cancel();
    expect(usePropertyStore.getState().property).toBe(committed);
  });
});

describe('authored roof outlines', () => {
  it('uses the same overhang polygon and pitch in mesh and measured covering', () => {
    const config = { ...DEFAULT_ROOF_CONFIG, style: 'gable' as const, pitchDeg: 30, overhangM: .2 };
    const polygon = sampleMeasuredPath(rectangle)!.vertices;
    const areas = roofMeasuredAreas(polygon, config)!;
    expect(areas.footprintM2).toBe(12);
    expect(areas.projectedM2).toBeCloseTo(4.4 * 3.4);
    expect(areas.coveringM2).toBeCloseTo(4.4 * 3.4 / Math.cos(Math.PI / 6));
    expect(polygonArea(createRoofSurface(polygon, 3, config)!.polygon)).toBeCloseTo(areas.projectedM2);
  });
  it('persists a curved outline and does not replace it when rooms underneath change', () => {
    expect(usePropertyStore.getState().setRoofOutline(curvedRoom)).toBe(true);
    const property = usePropertyStore.getState().property;
    const roof = property.rooms.find(r => r.kind === 'roof')!;
    expect(roof.polygon).toEqual(property.roof?.outline);
    const loaded = normaliseLoadedProperty(JSON.parse(JSON.stringify(property)));
    expect(loaded.roof?.outline).toEqual(roof.polygon);
    expect(syncRoofRooms(loaded).rooms.find(r => r.kind === 'roof')?.polygon).toEqual(roof.polygon);
  });
  it('uses rendered eaves and pitch once in the material engine, with explicit manual override', () => {
    usePropertyStore.getState().setRoofOutline(rectangle);
    usePropertyStore.getState().setRoofConfig({ ...usePropertyStore.getState().property.roof!, style: 'gable', pitchDeg: 30, overhangM: .2 });
    const geometry = propertyMaterialsGeometry(usePropertyStore.getState().property);
    expect(geometry.roofAreaM2).toBeCloseTo(14.96);
    const settings = defaultMaterialsSettings();
    settings.roof.kind = 'sheet';
    settings.roof.sheet.pitchDeg = 60; settings.roof.sheet.overhangM = 1;
    const report = estimateMaterials(geometry, settings);
    expect(report.lines.find(line => line.id === 'sheet-area')?.net).toBeCloseTo(14.96 / Math.cos(Math.PI / 6));
    settings.roof.lengthOverrideM = 4; settings.roof.widthOverrideM = 3;
    const manual = estimateMaterials(geometry, settings);
    expect(manual.lines.find(line => line.id === 'sheet-area')?.net).toBeCloseTo(6 * 5 / Math.cos(Math.PI / 3));
  });
  it('deduplicates overlapping eaves instead of adding the same roof area twice', () => {
    usePropertyStore.getState().addRoom({ name: 'A', polygon: sampleMeasuredPath(rectangle)!.vertices });
    usePropertyStore.getState().addRoom({ name: 'B', polygon: sampleMeasuredPath(rectangle)!.vertices.map(p => ({ x: p.x + 4, y: p.y })) });
    usePropertyStore.getState().setRoofConfig({ ...DEFAULT_ROOF_CONFIG, overhangM: .2 });
    expect(propertyMaterialsGeometry(usePropertyStore.getState().property).roofAreaM2).toBeCloseTo(8.4 * 3.4);
  });
  it('guards finished roofs against silent finish loss when returning to automatic outlines', () => {
    usePropertyStore.getState().setRoofOutline(rectangle);
    const property = usePropertyStore.getState().property;
    usePropertyStore.setState({ property: { ...property, rooms: property.rooms.map(r => r.kind === 'roof' ? { ...r, floorFinish: { materialId: 'existing-finish' } } : r) } });
    const before = usePropertyStore.getState().property;
    expect(usePropertyStore.getState().setRoofOutline(null)).toBe(false);
    expect(usePropertyStore.getState().property).toBe(before);
  });
});
