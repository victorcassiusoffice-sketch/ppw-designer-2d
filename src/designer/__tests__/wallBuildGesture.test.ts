import { describe, expect, it } from 'vitest';
import type { Property } from '../../store/propertyStore';
import type { Vertex } from '../../lib/geometry';
import { isSimpleWallLoop, previewWallBuild, reconcileWallBuildChain, type WallBuildChain } from '../wallBuildGesture';
import { runToFreeWalls } from '../freeWalls';

const blank = (): Property => ({ id: 'p', name: 'House', activeRoomId: 'r', rooms: [{ id: 'r', name: 'Room', polygon: [], placedItems: [] }] });
function chainOn(property: Property, vertices: Vertex[], levelId = 'ground'): WallBuildChain {
  const walls = runToFreeWalls(vertices, levelId).map((wall, i) => ({ ...wall, id: `wall-${i}` }));
  property.walls = [...(property.walls ?? []), ...walls];
  return { propertyId: property.id, levelId, vertices, wallIds: walls.map((wall) => wall.id) };
}
const v = (x: number, y: number) => ({ x, y });

describe('3D wall gesture geometry', () => {
  it('snaps to the grid and assists straight and diagonal runs, while Shift frees the angle', () => {
    expect(previewWallBuild(blank(), v(0.02, 0.01), v(4.01, 0.4), { stepM: 0.1 })).toMatchObject({ ok: true, a: v(0, 0), b: v(4, 0), lengthM: 4, angleDeg: 0 });
    expect(previewWallBuild(blank(), v(0, 0), v(4, 0.4), { stepM: 0.1, freeAngle: true })).toMatchObject({ ok: true, b: v(4, 0.4) });
    expect(previewWallBuild(blank(), v(0, 0), v(2, 2.2), { stepM: 0.1 })).toMatchObject({ ok: true, b: v(2.2, 2.2), angleDeg: 45 });
  });

  it('joins exact off-grid room corners and free-wall endpoints instead of drifting them onto the grid', () => {
    const p = blank();
    p.rooms[0].polygon = [v(0, 0), v(5.13, 0), v(5.13, 4), v(0, 4)];
    p.walls = [{ id: 'free', a: v(8.12, 2.04), b: v(8.12, 5), thicknessM: 0.12 }];
    const result = previewWallBuild(p, v(5.1, 0.03), v(8.1, 2));
    expect(result).toMatchObject({ ok: true, a: v(5.13, 0), b: v(8.12, 2.04), snapped: true });
  });

  it('lets a short continuation escape its own endpoint magnet without losing nearby joins', () => {
    const p = blank();
    const chain = chainOn(p, [v(0, 0), v(4.13, 0)]);
    expect(previewWallBuild(p, v(4.13, 0), v(4.34, 0), { chain })).toMatchObject({ ok: true, a: v(4.13, 0), b: v(4.5, 0) });
    const corner = blank();
    const turn = chainOn(corner, [v(0, 0.13), v(4, 0.13)]);
    expect(previewWallBuild(corner, v(4, 0.13), v(4, 0.34), { chain: turn })).toMatchObject({ ok: true, b: v(4, 0.5), angleDeg: 90 });
    corner.walls!.push({ id: 'join', a: v(4, 0.35), b: v(5, 0.35), thicknessM: 0.12 });
    expect(previewWallBuild(corner, v(4, 0.13), v(4, 0.34), { chain: turn })).toMatchObject({ ok: true, b: v(4, 0.35), snapped: true });
  });

  it('rejects overlapping duplicate walls in either direction but permits endpoint joins and partitions', () => {
    const p = blank();
    p.walls = [{ id: 'free', a: v(0, 0), b: v(4, 0), thicknessM: 0.12 }];
    expect(previewWallBuild(p, v(3, 0), v(1, 0))).toMatchObject({ ok: false, reason: 'duplicate-wall' });
    expect(previewWallBuild(p, v(4, 0), v(6, 0)).ok).toBe(true);
    expect(previewWallBuild(p, v(2, 0), v(2, 3)).ok).toBe(true);
    p.rooms[0].polygon = [v(0, 0), v(4, 0), v(4, 4), v(0, 4)];
    expect(previewWallBuild(p, v(1, 2), v(3, 2)).ok).toBe(true);
  });

  it('keeps snapped walls inside the plot, including an initial click outside it', () => {
    const p = blank();
    p.site = { originM: v(2, 3), widthM: 6, depthM: 7 };
    expect(previewWallBuild(p, v(2, 3), v(8, 3)).ok).toBe(true);
    expect(previewWallBuild(p, v(2, 3), v(9, 3))).toMatchObject({ ok: false, reason: 'off-plot' });
    expect(previewWallBuild(p, v(0, 0), v(0, 0))).toMatchObject({ ok: false, reason: 'off-plot' });
  });

  it('closes a concave connected run into the correct room polygon', () => {
    const p = blank();
    const vertices = [v(0, 0), v(5, 0), v(5, 2), v(3, 2), v(3, 4), v(0, 4)];
    const chain = chainOn(p, vertices);
    expect(previewWallBuild(p, v(0, 4), v(0.1, 0.1), { chain })).toMatchObject({ ok: true, closesRoom: true, b: v(0, 0), roomPolygon: vertices });
  });

  it('permits closing three new sides against an existing shared room boundary', () => {
    const p = blank();
    p.rooms[0].polygon = [v(0, 0), v(4, 0), v(4, 4), v(0, 4)];
    const chain = chainOn(p, [v(4, 0), v(7, 0), v(7, 4), v(4, 4)]);
    expect(previewWallBuild(p, v(4, 4), v(4, 0), { chain })).toMatchObject({ ok: true, closesRoom: true });
  });

  it('rejects self-crossing or self-touching runs and unsafe room overlap before any mutation', () => {
    const p = blank();
    const chain = chainOn(p, [v(0, 0), v(4, 0), v(4, 4)]);
    expect(previewWallBuild(p, v(4, 4), v(2, -2), { chain, freeAngle: true })).toMatchObject({ ok: false, reason: 'self-crossing' });
    expect(previewWallBuild(p, v(4, 4), v(2, 0), { chain, freeAngle: true })).toMatchObject({ ok: false, reason: 'self-crossing' });
    expect(isSimpleWallLoop([v(0, 0), v(4, 4), v(0, 4), v(4, 0)])).toBe(false);
    const enclosed = blank();
    enclosed.rooms[0].polygon = [v(0, 0), v(6, 0), v(6, 6), v(0, 6)];
    const inside = chainOn(enclosed, [v(1, 1), v(3, 1), v(3, 3), v(1, 3)]);
    expect(previewWallBuild(enclosed, v(1, 3), v(1, 1), { chain: inside })).toMatchObject({ ok: false, reason: 'overlapping-room' });
  });

  it('uses only the active floor geometry and refuses roof or changed-floor gestures', () => {
    const p = blank();
    p.levels = [{ id: 'ground', name: 'Ground', index: 0, heightM: 3 }, { id: 'upper', name: 'Upper', index: 1 }, { id: 'roof', name: 'Roof', index: 2, kind: 'roof' }];
    p.walls = [{ id: 'ground-wall', a: v(0, 0), b: v(4, 0), thicknessM: 0.12 }];
    p.activeLevelId = 'upper';
    expect(previewWallBuild(p, v(0, 0), v(4, 0))).toMatchObject({ ok: true, levelId: 'upper', elevationM: 3.18 });
    expect(previewWallBuild(p, v(0, 0), v(4, 0), { levelId: 'ground' })).toMatchObject({ ok: false, reason: 'level-changed' });
    p.activeLevelId = 'roof';
    expect(previewWallBuild(p, v(0, 0), v(4, 0))).toMatchObject({ ok: false, reason: 'roof-level' });
  });

  it('trims an undone chain and rejects its stale draft without deleting unrelated walls', () => {
    const p = blank();
    const chain = chainOn(p, [v(0, 0), v(4, 0), v(4, 4)]);
    p.walls = p.walls!.slice(0, 1);
    const reconciled = reconcileWallBuildChain(p, chain);
    expect(reconciled).toMatchObject({ wallIds: ['wall-0'], vertices: [v(0, 0), v(4, 0)] });
    expect(previewWallBuild(p, v(4, 4), v(0, 4), { chain })).toMatchObject({ ok: false, reason: 'stale-chain' });
    expect(reconcileWallBuildChain({ ...p, id: 'another-plan' }, chain)).toBeNull();
  });

  it('refuses clicks, non-finite coordinates and invalid precision without mutating the design', () => {
    const p = blank();
    const before = JSON.stringify(p);
    expect(previewWallBuild(p, v(0, 0), v(0, 0))).toMatchObject({ ok: false, reason: 'too-short' });
    expect(previewWallBuild(p, v(NaN, 0), v(4, 0))).toMatchObject({ ok: false, reason: 'invalid-point' });
    expect(previewWallBuild(p, v(0, 0), v(4, 0), { stepM: 0 })).toMatchObject({ ok: false, reason: 'invalid-snap' });
    expect(isSimpleWallLoop([v(-1e200, -1e200), v(1e200, -1e200), v(1e200, 1e200)])).toBe(false);
    expect(JSON.stringify(p)).toBe(before);
  });
});
