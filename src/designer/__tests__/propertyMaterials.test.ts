// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { footprintUnionArea, propertyMaterialsGeometry } from '../propertyMaterials';
import { defaultMaterialsSettings, estimateMaterials } from '../materials';
import { normaliseLoadedProperty, usePropertyStore, type Property, type Room } from '../../store/propertyStore';
import { __test, installHistorySubscriptions, useHistoryStore } from '../../store/historyStore';
import type { Vertex } from '../../lib/geometry';
import type { Opening } from '../openings';

const rect = (x: number, y: number, width: number, height: number): Vertex[] =>
  [{ x, y }, { x: x + width, y }, { x: x + width, y: y + height }, { x, y: y + height }];
const room = (id: string, polygon: Vertex[], extras: Partial<Room> = {}): Room => ({ id, name: id, polygon, placedItems: [], ...extras });
const property = (rooms: Room[], extras: Partial<Property> = {}): Property =>
  ({ id: 'takeoff', name: 'Materials geometry', rooms, activeRoomId: rooms[0]?.id ?? '', wallHeightM: 2.7, ...extras });
const opening = (edgeIndex: number, offsetM: number, widthM = 0.9, extras: Partial<Opening> = {}): Opening =>
  ({ id: `door-${edgeIndex}-${offsetM}`, edgeIndex, offsetM, widthM, kind: 'door', flipFacing: false, flipHand: false, ...extras });
const length = (p: Property, scope: 'all' | 'active' = 'all') => propertyMaterialsGeometry(p, scope).walls.reduce((sum, wall) => sum + wall.lengthM, 0);
const deducted = (p: Property) => propertyMaterialsGeometry(p).walls.reduce((sum, wall) => sum + wall.openingAreaM2, 0);

describe('exact room footprint union for material takeoffs', () => {
  it('does not double count identical, contained, overlapping or edge-touching rooms', () => {
    const a = rect(0, 0, 4, 3);
    expect(footprintUnionArea([a, a])).toBeCloseTo(12, 8);
    expect(footprintUnionArea([a, rect(1, 1, 1, 1)])).toBeCloseTo(12, 8);
    expect(footprintUnionArea([a, rect(2, 0, 4, 3)])).toBeCloseTo(18, 8);
    expect(footprintUnionArea([a, rect(4, 0, 4, 3)])).toBeCloseTo(24, 8);
  });

  it('keeps concave gaps, reversed winding, negative coordinates and a courtyard unfilled', () => {
    const l: Vertex[] = [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 1 }, { x: 1, y: 1 }, { x: 1, y: 4 }, { x: 0, y: 4 }];
    expect(footprintUnionArea([l])).toBeCloseTo(7, 8);
    const translated = [...l].reverse().map(point => ({ x: point.x - 20, y: point.y - 10 }));
    expect(footprintUnionArea([translated])).toBeCloseTo(7, 8);
    const ring = [rect(0, 0, 6, 2), rect(0, 4, 6, 2), rect(0, 2, 2, 2), rect(4, 2, 2, 2)];
    expect(footprintUnionArea(ring)).toBeCloseTo(32, 8);
  });

  it('splits diagonal boundary crossings inside a strip, rather than using bounding rectangles', () => {
    const first = [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 0, y: 4 }];
    const second = [{ x: 0, y: 0 }, { x: 4, y: 4 }, { x: 0, y: 4 }];
    // Each triangle is 8m², overlap is 4m²; the crossing at x=2 is
    // not a vertex of either input polygon.
    expect(footprintUnionArea([first, second])).toBeCloseTo(12, 8);
    const diamond = [{ x: 0, y: -2 }, { x: 2, y: 0 }, { x: 0, y: 2 }, { x: -2, y: 0 }];
    expect(footprintUnionArea([diamond, diamond.map(p => ({ ...p, x: p.x + 2 }))])).toBeCloseTo(14, 8);
  });

  it('ignores empty, degenerate and non-finite polygons without corrupting a valid area', () => {
    expect(footprintUnionArea([[], [{ x: 0, y: 0 }], rect(0, 0, 0, 5), [{ x: Number.NaN, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }], rect(0, 0, 2, 3)])).toBeCloseTo(6, 8);
  });
});

describe('physical wall and opening adapter', () => {
  it('deducts actual opening metres on long and diagonal walls, not normalized fractions', () => {
    const p = property([room('a', rect(0, 0, 4, 3), { openings: [opening(0, 2)] })]);
    expect(length(p)).toBeCloseTo(14, 8);
    expect(deducted(p)).toBeCloseTo(0.9 * 2.04, 8);
    const angle = 37 * Math.PI / 180;
    p.rooms[0].polygon = p.rooms[0].polygon.map(v => ({ x: v.x * Math.cos(angle) - v.y * Math.sin(angle), y: v.x * Math.sin(angle) + v.y * Math.cos(angle) }));
    expect(length(p)).toBeCloseTo(14, 8);
    expect(deducted(p)).toBeCloseTo(0.9 * 2.04, 8);
  });

  it('counts a shared wall and its oppositely oriented mirrored door once', () => {
    const a = room('a', rect(0, 0, 4, 3), { openings: [opening(1, 1)] });
    const b = room('b', rect(4, 0, 4, 3), { openings: [opening(3, 2)] });
    const p = property([a, b]);
    expect(length(p)).toBeCloseTo(25, 8); // 28 total perimeter minus 3 shared.
    expect(deducted(p)).toBeCloseTo(0.9 * 2.04, 8);
    const report = estimateMaterials(propertyMaterialsGeometry(p));
    expect(report.totals.wallGrossAreaM2).toBeCloseTo(25 * 2.7, 8);
    expect(report.totals.wallNetAreaM2).toBeCloseTo(25 * 2.7 - 0.9 * 2.04, 8);
    // Duplicating an existing perimeter as a free wall is not another wall.
    p.walls = [{ id: 'free', a: { x: 4, y: 3 }, b: { x: 4, y: 0 }, thicknessM: 0.15 }];
    expect(length(p)).toBeCloseTo(25, 8);
    expect(deducted(p)).toBeCloseTo(0.9 * 2.04, 8);
  });

  it('unions partial shared walls and overlapping door/window holes only where they actually overlap', () => {
    const a = room('a', rect(0, 0, 4, 4), { openings: [opening(1, 1.5, 1.2, { kind: 'window', sillM: 0.9 })] });
    const b = room('b', rect(4, 0, 3, 3), { openings: [opening(3, 2)] });
    const p = property([a, b]);
    expect(length(p)).toBeCloseTo(25, 8); //16+12−3 shared.
    // Door y=.55..1.45, window y=.9..2.1; vertical intersection=.9..2.04.
    expect(deducted(p)).toBeCloseTo(0.9 * 2.04 + 1.2 * 1.2 - 0.55 * 1.14, 8);
  });

  it('clips edge overflow and height and ignores holes wholly outside a wall', () => {
    const p = property([room('a', rect(0, 0, 4, 3), { openings: [
      opening(0, 0, 1), opening(0, 10, 0.9), opening(0, -5, 0.9),
      opening(2, 2, 1, { kind: 'window', sillM: 2.5 }),
      opening(1, Number.NaN), opening(3, 1, -1),
    ] })]);
    expect(deducted(p)).toBeCloseTo(0.5 * 2.04 + 1 * 0.2, 8);
  });

  it('never deduplicates walls on different storeys and applies each storey height', () => {
    const a = room('a', rect(0, 0, 4, 3), { openings: [opening(0, 2)] });
    const b = room('b', rect(0, 0, 4, 3), { levelId: 'first', openings: [opening(0, 2)] });
    const p = property([a, b], { activeLevelId: 'first', levels: [{ id: 'ground', name: 'Ground', index: 0, heightM: 2.7 }, { id: 'first', name: 'First', index: 1, heightM: 3.2 }] });
    expect(length(p)).toBeCloseTo(28, 8);
    expect(length(p, 'active')).toBeCloseTo(14, 8);
    expect(deducted(p)).toBeCloseTo(2 * 0.9 * 2.04, 8);
    expect(estimateMaterials(propertyMaterialsGeometry(p)).totals.wallGrossAreaM2).toBeCloseTo(14 * (2.7 + 3.2), 8);
    expect(propertyMaterialsGeometry(p, 'active').walls.every(w => w.levelId === 'first' && w.heightM === 3.2)).toBe(true);
  });
});

describe('separate ground-base and highest-storey roof quantities', () => {
  it('uses each footprint once and excludes outdoor containers and mirrored roof slabs', () => {
    const p = property([
      room('ground', rect(0, 0, 8, 6)), room('first', rect(0, 0, 4, 3), { levelId: 'first' }),
      room('roof-first', rect(0, 0, 4, 3), { levelId: 'roof', kind: 'roof' }),
      room('garden', rect(-10, -10, 40, 30), { kind: 'outdoor' }),
    ], { activeLevelId: 'first', levels: [{ id: 'ground', name: 'Ground', index: 0 }, { id: 'first', name: 'First', index: 1 }, { id: 'roof', name: 'Roof', index: 2, kind: 'roof' }] });
    const geometry = propertyMaterialsGeometry(p, 'active');
    expect(geometry.baseAreaM2).toBeCloseTo(48, 8);
    expect(geometry.roofAreaM2).toBeCloseTo(12, 8);
    expect(geometry.roofLengthM).toBe(4);
    expect(geometry.roofWidthM).toBe(3);
    expect(geometry.roofRectangular).toBe(true);
    expect(length(p)).toBeCloseTo(28 + 14, 8);
    const saved = JSON.stringify(p);
    const settings = defaultMaterialsSettings();
    settings.base.enabled = true;
    settings.roof.kind = 'reinforced-concrete';
    expect(estimateMaterials(geometry, settings).totals.concreteNetM3).toBeCloseTo((48 + 12) * 0.15, 8);
    expect(JSON.stringify(p)).toBe(saved);
  });

  it('retains courtyard holes and flags irregular roof envelopes', () => {
    const polygons = [rect(0, 0, 6, 2), rect(0, 4, 6, 2), rect(0, 2, 2, 2), rect(4, 2, 2, 2)];
    const geometry = propertyMaterialsGeometry(property(polygons.map((polygon, i) => room(`r${i}`, polygon))));
    expect(geometry.baseAreaM2).toBeCloseTo(32, 8);
    expect(geometry.roofAreaM2).toBeCloseTo(32, 8);
    expect(geometry.roofLengthM * geometry.roofWidthM).toBe(36);
    expect(geometry.roofRectangular).toBe(false);
  });
});

let unsubscribe: (() => void) | undefined;
beforeEach(() => {
  __test.resetSubscriptions();
  usePropertyStore.getState().resetToDefault();
  useHistoryStore.getState().reset();
});
afterEach(() => { unsubscribe?.(); unsubscribe = undefined; __test.resetSubscriptions(); });

describe('permanent property Materials assumptions', () => {
  it('keeps custom ratios, depths and roof selections through JSON save/load and history', () => {
    const settings = defaultMaterialsSettings();
    settings.mortar.sand = 4.5;
    settings.concrete.supply = 'site-mix';
    settings.concrete.aggregate = 4;
    settings.base = { enabled: true, depthM: 0.27, areaOverrideM2: 63.2 };
    settings.roof.kind = 'sheet';
    settings.roof.sheet.effectiveCoverM = 0.97;
    settings.roof.rebar.spacingMm = 175;
    unsubscribe = installHistorySubscriptions({ coalesceMs: 0 });
    usePropertyStore.getState().setMaterialsSettings(settings);
    const current = usePropertyStore.getState().property;
    const reloaded = normaliseLoadedProperty(JSON.parse(JSON.stringify(current)));
    expect(reloaded.materials).toEqual(settings);
    useHistoryStore.getState().undo();
    expect(usePropertyStore.getState().property.materials).toBeUndefined();
    useHistoryStore.getState().redo();
    expect(usePropertyStore.getState().property.materials).toEqual(settings);
  });

  it('leaves old projects without Materials untouched and cleans corrupt persisted inputs', () => {
    const old = property([room('a', rect(0, 0, 4, 3))]);
    expect(normaliseLoadedProperty(old).materials).toBeUndefined();
    const raw = { ...old, materials: { version: 900, wall: { thicknessM: -5 }, mortar: { sand: 'wrong' }, base: { depthM: Number.NaN }, roof: { rebar: { spacingMm: 0 } } } };
    const fixed = normaliseLoadedProperty(raw).materials!;
    expect(fixed.version).toBe(1);
    expect(fixed.wall.thicknessM).toBeGreaterThan(0);
    expect(Number.isFinite(fixed.mortar.sand)).toBe(true);
    expect(Number.isFinite(fixed.base.depthM)).toBe(true);
    expect(fixed.roof.rebar.spacingMm).toBeGreaterThan(0);
  });
});
