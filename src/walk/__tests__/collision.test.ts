import { afterEach, describe, expect, it } from 'vitest';
import { DoubleSide, Ray, Vector3 } from 'three';
import type { Property } from '../../store/propertyStore';
import type { SceneInput } from '../../designer/roomView3d';
import { buildingSolids } from '../../designer/buildingScene';
import { activeLevelIdOf, isRoofRoom, roomsOnLevel } from '../../designer/levels';
import { wallsOnLevel } from '../../designer/freeWalls';
import { buildHomeInterior } from '../../demo/homeInterior';
import { COURTS_PRODUCTS } from '../../demo/courts';
import { placedItemElevationCm } from '../../designer/placedItemElevation';
import { wallJoinery } from '../../components/three/joinery';
import { createWalkWorld } from '../scene';
import { capsuleClear, createWalker, followCamera, groundHeight, interactionDoor, nearestDoor, pullInCamera, setDoorAngle, stepWalker, toggleDoor } from '../collision';
import { findWalkSpawn } from '../spawn';
import type { WalkerState, WalkWorld } from '../types';

const rectangle = (width = 8, depth = 8) => [{ x: 0, y: 0 }, { x: width, y: 0 }, { x: width, y: depth }, { x: 0, y: depth }];
function property(width = 8): Property {
  return { id: 'walk-test', name: 'Walk test', activeRoomId: 'lower', rooms: [{ id: 'lower', name: 'Lower', polygon: rectangle(width), placedItems: [],
    openings: [{ id: 'entry', edgeIndex: 0, offsetM: width / 2, widthM: 1.1, kind: 'door', flipFacing: false, flipHand: false }] }] };
}
function source(p: Property): SceneInput {
  return { wallHeightM: p.wallHeightM ?? 2.7, cameraPos: { x: 10, y: 10, z: 8 }, cameraTarget: { x: 4, y: 4, z: 0 },
    walls: wallsOnLevel(p.walls ?? [], activeLevelIdOf(p)),
    rooms: roomsOnLevel(p.rooms, activeLevelIdOf(p)).map(room => ({ id: room.id, name: room.name, polygon: room.polygon,
      kind: isRoofRoom(room) ? 'outdoor' : room.kind, openings: room.openings,
      items: room.placedItems.map(item => ({ ...item, lengthCm: 100, widthCm: 100, heightCm: 110 })) })) };
}
const worlds: WalkWorld[] = [];
function world(p = property()): WalkWorld {
  const result = createWalkWorld(buildingSolids(p, source, 'building', true), p);
  worlds.push(result);
  return result;
}
function travel(w: WalkWorld, state: WalkerState, velocity: Vector3, seconds: number, dt = 1 / 60) {
  for (let i = 0; i < Math.round(seconds / dt); i++) stepWalker(w, state, velocity, dt);
}
function stairs(rotation = 0): Property {
  const p = property();
  p.levels = [{ id: 'ground', name: 'Ground', index: 0, heightM: 3 }, { id: 'first', name: 'First', index: 1, heightM: 3 }];
  p.rooms.push({ id: 'upper', name: 'Upper', levelId: 'first', polygon: rectangle(), placedItems: [] });
  p.stairs = [{ id: 'stair', fromLevelId: 'ground', toLevelId: 'first', x: 4, y: 4, widthM: 1.2, runM: 5, rotation }];
  return p;
}
afterEach(() => { for (const w of worlds.splice(0)) w.dispose(); });

describe('walk collision against assembled building geometry', () => {
  it('stops at full walls and slides parallel to them without touching the design', () => {
    const p = property(4), before = JSON.stringify(p), w = world(p);
    const state = createWalker(w, new Vector3(2, .001, 3));
    travel(w, state, new Vector3(3, 0, 1), 2);
    expect(state.position.x).toBeGreaterThan(3.7);
    expect(state.position.x).toBeLessThan(3.78);
    expect(state.position.z).toBeGreaterThan(4.9);
    expect(state.position.y).toBeCloseTo(0, 2);
    expect(JSON.stringify(p)).toBe(before);
  });

  it('substeps a lag frame and extreme speed so a thin wall cannot be tunnelled through', () => {
    const w = world(property(4)), state = createWalker(w, new Vector3(2, .001, 4));
    stepWalker(w, state, new Vector3(100, 0, 0), .5);
    expect(state.position.x).toBeLessThan(3.78);
    expect(state.position.x).toBeGreaterThan(3.7);
  });

  it('produces the same result at 30 and 60 input frames per second', () => {
    const w = world(), a = createWalker(w, new Vector3(2, .001, 2)), b = createWalker(w, new Vector3(2, .001, 2));
    travel(w, a, new Vector3(.8, 0, .6), 2, 1 / 30);
    travel(w, b, new Vector3(.8, 0, .6), 2, 1 / 60);
    expect(a.position.distanceTo(b.position)).toBeLessThan(1e-8);
  });

  it('blocks furniture footprints and never treats furniture as a stair', () => {
    const p = property(); p.rooms[0].placedItems.push({ instanceId: 'desk', productId: 'desk', x: 4, y: 4, rotation: 45 });
    const solids = buildingSolids(p, source, 'building', true);
    const box = solids.items[0], w = world(p), state = createWalker(w, new Vector3(4, .001, 2));
    travel(w, state, new Vector3(0, 0, 2), 2);
    expect(state.position.z).toBeLessThan(box.y0 - .22);
    expect(state.position.y).toBeCloseTo(0, 2);
  });

  it('collides with a centred freestanding wall at its actual saved height and thickness', () => {
    const p = property(); p.walls = [{ id: 'partition', a: { x: 4, y: 2 }, b: { x: 4, y: 6 }, thicknessM: .2 }];
    const w = world(p), state = createWalker(w, new Vector3(2, .001, 4));
    travel(w, state, new Vector3(3, 0, 0), 1);
    expect(state.position.x).toBeGreaterThan(3.65);
    expect(state.position.x).toBeLessThan(3.68);
    expect(pullInCamera(w, new Vector3(2, 1.4, 4), new Vector3(6, 1.4, 4)).x).toBeLessThan(3.73);
  });

  it('leaves doorways open while even a floor-height glazed window remains solid', () => {
    const p = property(); p.rooms[0].openings![0].kind = 'doorway';
    const open = world(p), state = createWalker(open, new Vector3(4, .001, 1));
    expect(open.doors).toEqual([]);
    travel(open, state, new Vector3(0, 0, -1), 1.2);
    expect(state.position.z).toBeLessThan(0);
    p.rooms[0].openings![0].kind = 'window'; p.rooms[0].openings![0].sillM = 0; p.rooms[0].openings![0].heightM = 2.2;
    const glazed = world(p), blocked = createWalker(glazed, new Vector3(4, .001, 1));
    travel(glazed, blocked, new Vector3(0, 0, -1), 1.2);
    expect(blocked.position.z).toBeGreaterThan(.22);
  });

  it.each([0, 90, 180, 270])('ascends and descends the actual risers at stair rotation %s', rotation => {
    const w = world(stairs(rotation));
    expect(w.stairs[0].riserM).toBeCloseTo(3.18 / 18);
    const angle = rotation * Math.PI / 180;
    const direction = new Vector3(-Math.sin(angle), 0, Math.cos(angle));
    const start = new Vector3(4, .001, 4).addScaledVector(direction, -2.95);
    const state = createWalker(w, start);
    travel(w, state, direction.clone().multiplyScalar(1.6), 3.8);
    expect(state.position.y).toBeCloseTo(3.18, 1);
    expect(state.position.clone().sub(new Vector3(4, 0, 4)).dot(direction)).toBeGreaterThan(2.5);
    travel(w, state, direction.clone().multiplyScalar(-1.6), 3.8);
    expect(state.position.y).toBeCloseTo(0, 1);
    expect(state.position.clone().sub(new Vector3(4, 0, 4)).dot(direction)).toBeLessThan(-2.5);
  });

  it('retains real slab holes only for valid stairs and never creates a roof shortcut', () => {
    const p = stairs(); p.stairs![0].x = 30;
    const w = world(p);
    expect(w.stairs).toEqual([]);
    expect(w.floors.find(f => f.levelId === 'first')?.holes).toEqual([]);
    expect(groundHeight(w, 4, 4, 3.4, .4)).toBeCloseTo(3.18);
    const state = createWalker(w, new Vector3(4, .001, 4));
    travel(w, state, new Vector3(0, 0, 1), 1);
    expect(state.position.y).toBeCloseTo(0, 2);
  });

  it('reaches a roof terrace through its valid flight and aperture, preserving the saved design', () => {
    const p = stairs(); p.stairs![0].x = 2;
    p.levels!.push({ id: 'roof', name: 'Roof', index: 2, kind: 'roof' });
    p.rooms.push({ id: 'roof-room', name: 'Roof', levelId: 'roof', kind: 'roof', polygon: rectangle(), placedItems: [] });
    p.stairs!.push({ id: 'roof-stair', fromLevelId: 'first', toLevelId: 'roof', x: 6, y: 4, widthM: 1.2, runM: 5, rotation: 0 });
    const before = JSON.stringify(p), w = world(p);
    const state = createWalker(w, new Vector3(2, .001, 1.05));
    travel(w, state, new Vector3(0, 0, 1.6), 3.8);
    expect(state.position.y).toBeCloseTo(3.18, 1);
    travel(w, state, new Vector3(1.6, 0, 0), 2.5);
    travel(w, state, new Vector3(1.6, 0, 0), .45);
    travel(w, state, new Vector3(0, 0, -1.6), 3.8);
    travel(w, state, new Vector3(-1.6, 0, 0), .45);
    travel(w, state, new Vector3(0, 0, 1.6), 3.8);
    expect(state.position.y).toBeCloseTo(6.36, 1);
    expect(w.floors.find(f => f.levelId === 'roof')!.holes).toHaveLength(1);
    expect(JSON.stringify(p)).toBe(before);
  });
});

describe('manual doors and camera', () => {
  it('keeps a closed door solid, opens on command, then permits passage', () => {
    const w = world(), state = createWalker(w, new Vector3(4, .001, 1.4));
    travel(w, state, new Vector3(0, 0, -2), 1);
    expect(state.position.z).toBeGreaterThan(.24);
    expect(w.doors[0].angle).toBe(0);
    state.position.set(4, .001, 1.5);
    expect(toggleDoor(w, 'entry', state)).toBe(true);
    travel(w, state, new Vector3(), .8);
    expect(w.doors[0].angle).toBeCloseTo(w.doors[0].openDelta);
    travel(w, state, new Vector3(0, 0, -2), .9);
    expect(state.position.z).toBeLessThan(0);
  });

  it('refuses a closing sweep through the player and leaves the door open', () => {
    const w = world(), state = createWalker(w, new Vector3(4, .001, 2));
    expect(toggleDoor(w, 'entry', state)).toBe(true);
    travel(w, state, new Vector3(), .8);
    state.position.set(4, .001, .45);
    const angle = w.doors[0].angle;
    expect(toggleDoor(w, 'entry', state)).toBe(false);
    expect(w.doors[0].angle).toBe(angle);
    expect(w.doors[0].targetAngle).toBe(angle);
  });

  it('deduplicates both sides of a shared door, using one canonical hinge and collider', () => {
    const p = property(4);
    p.rooms[0].openings = [{ id: 'shared-left', edgeIndex: 1, offsetM: 4, widthM: 1.1, kind: 'door', flipFacing: false, flipHand: false }];
    p.rooms.push({ id: 'right', name: 'Right', polygon: rectangle(4).map(v => ({ x: v.x + 4, y: v.y })), placedItems: [],
      openings: [{ id: 'shared-right', edgeIndex: 3, offsetM: 4, widthM: 1.1, kind: 'door', flipFacing: true, flipHand: true }] });
    const before = JSON.stringify(p), w = world(p), state = createWalker(w, new Vector3(2.5, .001, 4));
    expect(w.doors).toHaveLength(1);
    expect(w.doors[0].openingIds).toEqual(['shared-left', 'shared-right']);
    expect(w.doors[0].hinge.toArray()).toEqual([4, 0, 3.45]);
    expect(nearestDoor(w, new Vector3(2.5, 1.55, 4), new Vector3(1, 0, 0))?.id).toBe('shared-left');
    travel(w, state, new Vector3(2, 0, 0), 1);
    expect(state.position.x).toBeLessThan(3.78);
    state.position.set(2.5, .001, 4);
    expect(toggleDoor(w, w.doors[0].id, state)).toBe(true);
    travel(w, state, new Vector3(), .8);
    travel(w, state, new Vector3(2, 0, 0), 1.5);
    expect(state.position.x).toBeGreaterThan(5);
    expect(JSON.stringify(p)).toBe(before);
  });

  it.each([[false, false], [false, true], [true, false], [true, true]])('honours canonical facing=%s hand=%s', (flipFacing, flipHand) => {
    const p = property(); Object.assign(p.rooms[0].openings![0], { flipFacing, flipHand });
    const w = world(p), door = w.doors[0], state = createWalker(w, new Vector3(4, .001, 3));
    expect(door.hinge.x).toBeCloseTo(flipHand ? 4.55 : 3.45);
    expect(setDoorAngle(w, door.id, door.openDelta, state)).toBe(true);
    const tip = new Vector3(Math.cos(door.closedYaw + door.angle), 0, -Math.sin(door.closedYaw + door.angle)).multiplyScalar(door.width).add(door.hinge);
    expect(tip.z).toBeCloseTo(flipFacing ? -1.1 : 1.1);
  });

  it('preserves the arch in a curved door collider and marks its original leaf for replacement', () => {
    const p = property(); p.rooms[0].openings![0].shape = 'arch'; p.rooms[0].openings![0].heightM = 2.2;
    const w = world(p), door = w.doors[0];
    expect(door.bvh.raycastFirst(new Ray(new Vector3(.55, 2.1, 1), new Vector3(0, 0, -1)), DoubleSide)).not.toBeNull();
    expect(door.bvh.raycastFirst(new Ray(new Vector3(.02, 2.1, 1), new Vector3(0, 0, -1)), DoubleSide)).toBeNull();
    const solids = buildingSolids(p, source, 'building', true), wall = solids.walls.find(wall => wall.openings.some(o => o.id === 'entry'))!;
    const joinery = wallJoinery(wall.lengthM, wall.thicknessM, wall.heightM, wall.openings);
    const leaves: string[] = [];
    joinery.traverse(object => { if (object.userData.walkDoorLeaf) leaves.push(object.userData.openingId); });
    expect(leaves).toEqual(['entry']);
    joinery.traverse(object => { const mesh = object as import('three').Mesh; if (mesh.isMesh) mesh.geometry.dispose(); });
  });

  it('only selects a door in reach and in view, with solid geometry occluding the interaction', () => {
    const w = world();
    expect(nearestDoor(w, new Vector3(4, 1.5, 1), new Vector3(0, 0, -1))?.id).toBe('entry');
    expect(nearestDoor(w, new Vector3(4, 1.5, 3), new Vector3(0, 0, -1))).toBeNull();
    expect(nearestDoor(w, new Vector3(4, 1.5, 1), new Vector3(0, 0, 1))).toBeNull();
  });

  it('keeps the operated open door prompt after its leaf swings away from the aim ray, and closes it again', () => {
    const w = world(), state = createWalker(w, new Vector3(4, .001, 1.5));
    const eye = new Vector3(4, 1.55, 1.5), facing = new Vector3(0, 0, -1), door = w.doors[0];
    expect(nearestDoor(w, eye, facing)?.id).toBe(door.id);
    expect(toggleDoor(w, door.id, state)).toBe(true);
    travel(w, state, new Vector3(), 1);
    expect(nearestDoor(w, eye, facing)).toBeNull();
    expect(interactionDoor(w, eye, facing, door.id)?.id).toBe(door.id);
    expect(interactionDoor(w, eye, facing.clone().negate(), door.id)?.id).toBe(door.id);
    expect(toggleDoor(w, door.id, state)).toBe(true);
    travel(w, state, new Vector3(), 1);
    expect(door.angle).toBeCloseTo(0);
    expect(interactionDoor(w, eye, facing.clone().negate(), door.id)).toBeNull();
  });

  it('drops a retained open door beyond reach or behind a wall, without targeting an unoperated door', () => {
    const p = property();
    p.walls = [{ id: 'screen', a: { x: 2, y: 1.3 }, b: { x: 6, y: 1.3 }, thicknessM: .15 }];
    const w = world(p), state = createWalker(w, new Vector3(4, .001, 3)), door = w.doors[0];
    setDoorAngle(w, door.id, door.openDelta, state); door.targetAngle = door.openDelta;
    expect(interactionDoor(w, new Vector3(4, 1.55, 2), new Vector3(0, 0, 1), door.id)).toBeNull();
    expect(interactionDoor(w, new Vector3(4, 1.55, 5), new Vector3(0, 0, 1), door.id)).toBeNull();
    expect(interactionDoor(w, new Vector3(3.8, 1.55, .6), new Vector3(0, 0, 1), null)).toBeNull();
  });

  it('keeps a shortened tight-room follow camera above the actor and inside the wall while recovering smoothly', () => {
    const p = property(3), w = world(p), feet = new Vector3(1.5, .001, 7.65), forward = new Vector3(0, 0, -1);
    let view = followCamera(w, feet, forward, null, 1 / 60);
    expect(view.position.z).toBeLessThan(7.83);
    expect(view.position.y).toBeGreaterThan(feet.y + 1.7 + .18);
    expect(view.target.y).toBeCloseTo(view.position.y);
    const near = view.position.distanceTo(feet);
    feet.z = 5;
    const first = followCamera(w, feet, forward, view.position, 1 / 60);
    const final = followCamera(w, feet, forward, null, 1 / 60);
    expect(first.position.distanceTo(final.position)).toBeGreaterThan(.05);
    view = first;
    for (let i = 0; i < 120; i++) view = followCamera(w, feet, forward, view.position, 1 / 60);
    expect(view.position.distanceTo(final.position)).toBeLessThan(.001);
    expect(view.position.distanceTo(feet)).toBeGreaterThan(near);
    expect(view.position.distanceTo(feet.clone().add(new Vector3(0, 1.55, 0)))).toBeLessThan(2.5);
  });

  it('sweeps the interpolated shoulder camera at corners and raises it above the head on a stair step', () => {
    const w = world(), feet = new Vector3(.3, .18, .3), direction = new Vector3(0, .9, 1).normalize();
    const view = followCamera(w, feet, direction, new Vector3(-1, 1, -1), 1 / 60);
    expect(view.position.x).toBeGreaterThan(.17);
    expect(view.position.z).toBeGreaterThan(.17);
    expect(view.position.y).toBeGreaterThan(feet.y + 1.7 + .18);
  });

  it('uses a clear side camera under a low ceiling and first person only when no external sphere fits', () => {
    const lowRoom = (size: number) => {
      const p = property(size); p.rooms[0].polygon = rectangle(size, size); p.rooms[0].openings = [];
      const solids = buildingSolids(p, source, 'building', true);
      solids.floors.push({ ...solids.floors[0], key: 'low-ceiling', elevationM: 1.95 });
      const w = createWalkWorld(solids, p); worlds.push(w); return w;
    };
    const feet = new Vector3(1.5, .001, 2.7), w = lowRoom(3);
    expect(capsuleClear(w, createWalker(w, feet))).toBe(true);
    const side = followCamera(w, feet, new Vector3(0, 0, -1), null, 1 / 60);
    expect(side.firstPerson).toBe(false);
    expect(Math.hypot(side.position.x - feet.x, side.position.z - feet.z)).toBeGreaterThan(.4);
    expect(side.position.y + .18).toBeLessThan(1.81);
    const cramped = lowRoom(.55), centre = new Vector3(.275, .001, .275);
    expect(capsuleClear(cramped, createWalker(cramped, centre))).toBe(true);
    const fallback = followCamera(cramped, centre, new Vector3(0, 0, -1), null, 1 / 60);
    expect(fallback.firstPerson).toBe(true);
    expect(fallback.position.toArray()).toEqual([.275, 1.551, .275]);
  });

  it('pulls the camera sphere in before a wall, door, floor, and corner grazing the centre ray', () => {
    const w = world();
    expect(pullInCamera(w, new Vector3(4, 1.4, 4), new Vector3(10, 1.4, 4)).x).toBeLessThan(7.83);
    expect(pullInCamera(w, new Vector3(4, 1.4, 1), new Vector3(4, 1.4, -2)).z).toBeGreaterThan(.19);
    expect(pullInCamera(w, new Vector3(4, 1.4, 4), new Vector3(4, -1, 4)).y).toBeGreaterThan(.17);
    const clear = pullInCamera(w, new Vector3(4, 1.4, 4), new Vector3(4, 1.4, 6));
    expect(clear.z).toBe(6);
    const graze = pullInCamera(w, new Vector3(7.9, 1.4, 4), new Vector3(7.9, 1.4, 6));
    expect(graze.z).toBeLessThan(6);
    const shallow = pullInCamera(w, new Vector3(7.6, 1.4, 2), new Vector3(8.1, 1.4, 6));
    expect(shallow.x).toBeLessThanOrEqual(7.821);
  });
});

describe('safe ground spawn', () => {
  it('spawns inward from the ground entry and falls back when furniture blocks it', () => {
    const p = property(), w = world(p), spawn = findWalkSpawn(w, p)!;
    expect(spawn.position.x).toBeCloseTo(4);
    expect(spawn.position.z).toBeGreaterThan(.4);
    expect(spawn.position.z).toBeLessThan(1.2);
    p.rooms[0].placedItems.push({ instanceId: 'cabinet', productId: 'cabinet', x: 3.5, y: .3, rotation: 0 });
    const blocked = world(p), fallback = findWalkSpawn(blocked, p)!;
    expect(fallback.position.z).toBeGreaterThan(2);
  });

  it('refuses entry with no ground room or no capsule clearance', () => {
    const empty = { ...property(), rooms: [] };
    expect(findWalkSpawn(world(empty), empty)).toBeNull();
    const upper = stairs(); upper.rooms = upper.rooms.filter(r => r.levelId === 'first'); upper.stairs = [];
    expect(findWalkSpawn(world(upper), upper)).toBeNull();
    const low = property(); low.wallHeightM = 1;
    low.levels = [{ id: 'ground', index: 0, name: 'Ground', heightM: 1 }, { id: 'first', index: 1, name: 'First' }];
    low.rooms.push({ id: 'ceiling', name: 'Ceiling', levelId: 'first', polygon: rectangle(), placedItems: [] });
    const solids = buildingSolids(low, source, 'building', true);
    solids.floors.find(f => f.levelId === 'first')!.elevationM = 1.3;
    const lowWorld = createWalkWorld(solids, low); worlds.push(lowWorld);
    expect(findWalkSpawn(lowWorld, low)).toBeNull();
  });

  it('does not spawn inside a tall furniture volume even when no triangle touches the capsule', () => {
    const p = property(), solids = buildingSolids(p, source, 'building', true);
    solids.items.push({ key: 'huge', instanceId: 'huge', x0: -.1, y0: -.1, x1: 8.1, y1: 8.1, z0: 0, z1: 2.6,
      rotationDeg: 0, hex: '#999999', lengthM: 8.2, widthM: 8.2, heightM: 2.6 });
    const w = createWalkWorld(solids, p); worlds.push(w);
    expect(findWalkSpawn(w, p)).toBeNull();
  });

  it('starts the furnished home demo facing a clear walking route when its plan has no exterior door', () => {
    const p = buildHomeInterior(), before = JSON.stringify(p);
    const products = new Map(COURTS_PRODUCTS.map(product => [product.id, product]));
    const demoSource = (property: Property): SceneInput => ({ ...source(property), rooms: property.rooms.map(room => ({
      id: room.id, name: room.name, polygon: room.polygon, openings: room.openings,
      items: room.placedItems.map(item => {
        const product = products.get(item.productId)!;
        const elevation = placedItemElevationCm(item, product, room.placedItems, id => products.get(id), 2.7);
        return { ...item, lengthCm: product.dimensions_cm.length, widthCm: product.dimensions_cm.width, heightCm: product.dimensions_cm.height,
          placement: product.placement, mountHeightCm: product.placement === 'wall' ? elevation : product.mount_height_cm,
          baseHeightCm: product.placement === 'surface' ? elevation : undefined };
      }),
    })) });
    const w = createWalkWorld(buildingSolids(p, demoSource, 'building', true), p); worlds.push(w);
    // Reproducible camera comparison in the narrowest furnished room (office,
    // 3 × 4 m). The fixture is accepted only when this real capsule fits.
    const fixture = new Vector3(5.1, .001, 6.2);
    expect(capsuleClear(w, createWalker(w, fixture))).toBe(true);
    expect(groundHeight(w, fixture.x, fixture.z, .051, .1)).toBeCloseTo(0);
    const camera = followCamera(w, fixture, new Vector3(1, 0, 0), null, 1 / 60);
    expect(camera.position.y).toBeGreaterThan(fixture.y + 1.88);
    expect(camera.position.x).toBeGreaterThan(4.68);
    expect(w.doors.every(door => !door.exterior)).toBe(true);
    const spawn = findWalkSpawn(w, p)!;
    expect(spawn).not.toBeNull();
    const state = createWalker(w, spawn), beforeMove = state.position.clone();
    const forward = new Vector3(-Math.sin(spawn.yaw), 0, -Math.cos(spawn.yaw));
    travel(w, state, forward.multiplyScalar(1.45), 1);
    expect(state.position.distanceTo(beforeMove)).toBeGreaterThan(1);
    expect(JSON.stringify(p)).toBe(before);
  });
});
