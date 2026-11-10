import { afterEach, describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import type { Property } from '../../store/propertyStore';
import type { SceneInput } from '../../designer/roomView3d';
import { activeLevelIdOf, roomsOnLevel } from '../../designer/levels';
import { prepareWalkVisit } from '../visit';
import { createWalkWorld } from '../scene';
import { createWalker, stepWalker } from '../collision';
import { spawnAt, spawnOnLevel } from '../placement';
import { walkingRoute } from '../navigation';
import type { WalkWorld } from '../types';

const rect = [{ x: 0, y: 0 }, { x: 8, y: 0 }, { x: 8, y: 6 }, { x: 0, y: 6 }];
const house = (): Property => ({
  id: 'house', name: 'House', wallHeightM: 3, activeRoomId: 'a',
  site: { widthM: 15, depthM: 12, originM: { x: -3, y: -3 } },
  levels: [{ id: 'ground', name: 'Ground', index: 0 }, { id: 'first', name: 'First', index: 1 }],
  rooms: [{ id: 'a', name: 'Lower', polygon: rect, placedItems: [], openings: [] },
    { id: 'b', name: 'Upper', levelId: 'first', polygon: rect, placedItems: [], openings: [] }],
});
const scene = (p: Property): SceneInput => ({
  wallHeightM: p.wallHeightM ?? 3, cameraPos: { x: 10, y: 10, z: 8 }, cameraTarget: { x: 3, y: 3, z: 1 }, rooms: roomsOnLevel(p.rooms, activeLevelIdOf(p)).map(r => ({
    id: r.id, name: r.name, polygon: r.polygon, openings: r.openings, items: [],
  })),
});
const opened: WalkWorld[] = [];
function world(p: Property) {
  const { solids, property } = prepareWalkVisit(p, scene);
  const w = createWalkWorld(solids, property);
  opened.push(w); return w;
}
afterEach(() => { opened.splice(0).forEach(w => w.dispose()); });

describe('visit placement', () => {
  it('places on a real plot before a room exists, remembers grounded motion and stops at its edge', () => {
    const p = house(); p.rooms = [];
    const w = world(p);
    const spawn = spawnAt(w, { x: 2, y: 2 }, 'ground')!;
    expect(spawn.position.y).toBeCloseTo(0, 2);
    expect(spawnAt(w, { x: 100, y: 100 }, 'ground')).toBeNull();
    const walker = createWalker(w, spawn);
    for (let i = 0; i < 100; i++) stepWalker(w, walker, new Vector3(2, 0, 0), .1);
    expect(walker.position.x).toBeGreaterThan(11);
    expect(walker.position.x).toBeLessThanOrEqual(12.01);
    expect(walker.safePosition.distanceTo(walker.position)).toBeLessThan(.01);
  });
  it('finds independent upper and roof surfaces without stairs or saved roof metadata', () => {
    const p = house(), saved = JSON.stringify(p), w = world(p);
    expect(spawnAt(w, { x: 4, y: 3 }, 'first')!.position.y).toBeCloseTo(3.18, 2);
    expect(spawnOnLevel(w, 'roof')!.position.y).toBeGreaterThan(6.36);
    expect(spawnAt(w, { x: -1, y: 3 }, 'first')).toBeNull();
    expect(JSON.stringify(p)).toBe(saved);
  });
  it('accepts a shallow pitched face and refuses the steep covering above the slab', () => {
    const p = house();
    p.roof = { style: 'gable', material: 'metal', pitchDeg: 20, overhangM: .2 };
    expect(spawnAt(world(p), { x: 3, y: 1.5 }, 'roof')?.position.y).toBeGreaterThan(6.6);
    p.roof.pitchDeg = 60;
    expect(spawnOnLevel(world(p), 'roof')).toBeNull();
  });
  it('routes over a real flight to the upper storey', () => {
    const p = house();
    p.stairs = [{ id: 's', fromLevelId: 'ground', toLevelId: 'first', x: 4, y: 3, widthM: 1.4, runM: 4.5, rotation: 0 }];
    const w = world(p);
    expect(w.stairs).toHaveLength(1);
    const path = walkingRoute(w, new Vector3(4, .001, .42), new Vector3(5.1, 3.181, 5.45));
    expect(path?.some(point => point.y > .5 && point.y < 2.9)).toBe(true);
    expect(path?.[path.length - 1]?.y).toBeCloseTo(3.181);
    const walker = createWalker(w, new Vector3(4, .001, .42));
    const steps = [...path!];
    for (let tick = 0; tick < 900 && steps.length; tick++) {
      const velocity = steps[0].clone().sub(walker.position).setY(0);
      if (velocity.length() < .08) steps.shift();
      else stepWalker(w, walker, velocity.normalize().multiplyScalar(1.45), 1 / 60);
    }
    expect(steps).toHaveLength(0);
    expect(walker.position.y).toBeCloseTo(3.181, 1);
  });
  it('keeps a walker on the roof at an exposed edge', () => {
    const w = world(house()); w.roofActive = true;
    const walker = createWalker(w, spawnAt(w, { x: 4, y: 3 }, 'roof')!);
    for (let i = 0; i < 90; i++) stepWalker(w, walker, new Vector3(2, 0, 0), .1);
    expect(walker.grounded).toBe(true);
    expect(walker.position.y).toBeGreaterThan(6);
    expect(walker.position.x).toBeLessThan(8.4);
  });
  it('routes around furniture and refuses to jump to an unconnected floor', () => {
    const p = house(), visit = prepareWalkVisit(p, scene);
    const solid = { key: 'item-test', instanceId: 'test', x0: 3, x1: 5, y0: 2, y1: 4, z0: 0, z1: 1.2 };
    visit.solids.items.push(solid as typeof visit.solids.items[number]);
    const w = createWalkWorld(visit.solids, visit.property); opened.push(w);
    const from = new Vector3(2, .001, 3);
    const route = walkingRoute(w, from, new Vector3(6, .001, 3));
    expect(route?.length).toBeGreaterThan(1);
    expect(route?.some(p => p.z < 1.9 || p.z > 4.1)).toBe(true);
    expect(walkingRoute(w, from, new Vector3(2, 3.181, 3))).toBeNull();
  });
});
