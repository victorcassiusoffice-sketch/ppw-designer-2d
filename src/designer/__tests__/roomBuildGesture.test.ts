import { describe, expect, it } from 'vitest';
import type { Property } from '../../store/propertyStore';
import { previewRectRoomBuild } from '../roomBuildGesture';

const rectangle = (left: number, top: number, width: number, depth: number) => [
  { x: left, y: top }, { x: left + width, y: top },
  { x: left + width, y: top + depth }, { x: left, y: top + depth },
];
const blank = (): Property => ({ id: 'p', name: 'House', activeRoomId: 'blank', rooms: [
  { id: 'blank', name: 'Treatment Room', polygon: [], placedItems: [] },
] });

describe('rectangular room gesture preview', () => {
  it('snaps either drag direction to the same canonical room and reports live dimensions without mutation', () => {
    const property = blank();
    const before = JSON.stringify(property);
    const a = { x: -1.12, y: 2.12 }, b = { x: 3.11, y: 5.13 };
    const preview = previewRectRoomBuild(property, a, b, { stepM: 0.5 });
    expect(preview).toMatchObject({ ok: true, widthM: 4, depthM: 3, areaM2: 12, levelId: 'ground', elevationM: 0 });
    expect(preview.polygon).toEqual(rectangle(-1, 2, 4, 3));
    expect(previewRectRoomBuild(property, b, a).polygon).toEqual(preview.polygon);
    expect(JSON.stringify(property)).toBe(before);
  });

  it('keeps an attached room flush with an off-grid wall instead of snapping it back onto the grid', () => {
    const property = blank();
    property.rooms.push({ id: 'host', name: 'Host', polygon: rectangle(0, 0, 5.13, 4), placedItems: [] });
    const preview = previewRectRoomBuild(property, { x: 5.12, y: 0.02 }, { x: 8.01, y: 3.99 });
    expect(preview.ok).toBe(true);
    expect(preview.polygon).toEqual(rectangle(5.13, 0, 2.87, 4));
  });

  it('rejects intersecting and completely coincident same-floor rooms but permits a shared edge', () => {
    const property = blank();
    property.rooms.push({ id: 'host', name: 'Host', polygon: rectangle(0, 0, 4, 4), placedItems: [] });
    expect(previewRectRoomBuild(property, { x: 0, y: 0 }, { x: 4, y: 4 })).toMatchObject({ ok: false, reason: 'overlapping-room' });
    expect(previewRectRoomBuild(property, { x: 3, y: 1 }, { x: 6, y: 3 })).toMatchObject({ ok: false, reason: 'overlapping-room' });
    expect(previewRectRoomBuild(property, { x: 4, y: 0 }, { x: 7, y: 4 }).ok).toBe(true);
  });

  it('detects crossing an irregular existing room without relying only on rectangle corners', () => {
    const property = blank();
    property.rooms.push({ id: 'crossed', name: 'Crossed', polygon: rectangle(2, -2, 1, 8), placedItems: [] });
    expect(previewRectRoomBuild(property, { x: 0, y: 0 }, { x: 6, y: 4 })).toMatchObject({ ok: false, reason: 'overlapping-room' });
  });

  it('allows a new upper room above a lower room and ignores outdoor containers', () => {
    const property = blank();
    property.levels = [{ id: 'ground', name: 'Ground', index: 0, heightM: 3 }, { id: 'upper', name: 'Upper', index: 1 }];
    property.activeLevelId = 'upper';
    property.rooms[0].polygon = rectangle(0, 0, 4, 4);
    property.rooms.push({ id: 'outside', name: 'Outside', kind: 'outdoor', levelId: 'upper', polygon: rectangle(-10, -10, 20, 20), placedItems: [] });
    expect(previewRectRoomBuild(property, { x: 0, y: 0 }, { x: 4, y: 4 })).toMatchObject({ ok: true, levelId: 'upper', elevationM: 3.18 });
  });

  it('respects a plot with an off-grid origin, allowing its boundary but refusing an overhang', () => {
    const property = blank();
    property.site = { originM: { x: 1.13, y: 2.13 }, widthM: 8, depthM: 6 };
    const touchingBoundary = previewRectRoomBuild(property, { x: 1.12, y: 2.12 }, { x: 9.12, y: 8.12 });
    expect(touchingBoundary.ok).toBe(true);
    expect(touchingBoundary.widthM).toBeCloseTo(8);
    expect(touchingBoundary.depthM).toBeCloseTo(6);
    expect(previewRectRoomBuild(property, { x: 1.13, y: 2.13 }, { x: 10, y: 9 })).toMatchObject({ ok: false, reason: 'off-plot' });
  });

  it('refuses rooms on a roof or on a deleted/changed captured floor', () => {
    const property = blank();
    property.levels = [{ id: 'ground', name: 'Ground', index: 0 }, { id: 'roof', name: 'Roof', index: 1, kind: 'roof' }];
    property.activeLevelId = 'roof';
    expect(previewRectRoomBuild(property, { x: 0, y: 0 }, { x: 4, y: 4 })).toMatchObject({ ok: false, reason: 'roof-level' });
    expect(previewRectRoomBuild(property, { x: 0, y: 0 }, { x: 4, y: 4 }, { levelId: 'ground' })).toMatchObject({ ok: false, reason: 'level-changed' });
    expect(previewRectRoomBuild(property, { x: 0, y: 0 }, { x: 4, y: 4 }, { levelId: 'deleted' })).toMatchObject({ ok: false, reason: 'missing-level' });
  });

  it('rejects zero-area/tiny gestures while retaining a finite preview for a status outline', () => {
    const preview = previewRectRoomBuild(blank(), { x: 1, y: 1 }, { x: 1.04, y: 4 }, { stepM: 0.01 });
    expect(preview).toMatchObject({ ok: false, reason: 'too-small' });
    expect(preview.polygon).toHaveLength(4);
    expect(preview.polygon.every((point) => Number.isFinite(point.x) && Number.isFinite(point.y))).toBe(true);
  });

  it('refuses invalid input rather than handing non-finite geometry to the renderer', () => {
    expect(previewRectRoomBuild(blank(), { x: NaN, y: 1 }, { x: 3, y: 4 })).toMatchObject({ ok: false, reason: 'invalid-point', polygon: [] });
    expect(previewRectRoomBuild(blank(), { x: 0, y: 0 }, { x: 3, y: 4 }, { stepM: 0 })).toMatchObject({ ok: false, reason: 'invalid-snap', polygon: [] });
    expect(previewRectRoomBuild(blank(), { x: 0, y: 0 }, { x: 1e300, y: 1e300 })).toMatchObject({ ok: false, reason: 'invalid-point', polygon: [] });
  });
});
