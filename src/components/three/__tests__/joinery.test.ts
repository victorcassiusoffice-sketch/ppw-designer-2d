// @vitest-environment node
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { doorObject, SKIRTING_HEIGHT_M, skirtingObject, wallJoinery, windowObject } from '../joinery';
import { floorKindOf } from '../surfaces';
import type { WallOpeningSolid } from '../../../designer/roomSolids';

const DOOR: WallOpeningSolid = { t0M: 1.0, t1M: 1.84, bottomM: 0, topM: 2.05, kind: 'door' };
const DOORWAY: WallOpeningSolid = { t0M: 3.0, t1M: 3.9, bottomM: 0, topM: 2.05, kind: 'doorway' };
const WINDOW: WallOpeningSolid = { t0M: 0.5, t1M: 1.7, bottomM: 0.9, topM: 2.1, kind: 'window' };

function meshes(g: THREE.Object3D): THREE.Mesh[] {
  const out: THREE.Mesh[] = [];
  g.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) out.push(o as THREE.Mesh);
  });
  return out;
}

describe('joinery — skirting, doors, windows in the wall frame (3D Mode P3)', () => {
  it('skirting runs the wall but stops at doors and doorways, never at windows', () => {
    const plain = skirtingObject(5, 0.14, [], 2.7)!;
    expect(meshes(plain)).toHaveLength(1);
    const withDoor = skirtingObject(5, 0.14, [DOOR, DOORWAY], 2.7)!;
    expect(meshes(withDoor)).toHaveLength(3); // 0–1.0, 1.84–3.0, 3.9–5
    const spans = meshes(withDoor).map((m) => (m.geometry as THREE.BoxGeometry).parameters.width).sort((a, b) => a - b);
    expect(spans[0]).toBeCloseTo(1.0, 5);
    expect(spans[1]).toBeCloseTo(1.1, 5);
    expect(spans[2]).toBeCloseTo(1.16, 5);
    const withWindow = skirtingObject(5, 0.14, [WINDOW], 2.7)!;
    expect(meshes(withWindow)).toHaveLength(1);
    // Proud of the INNER face (z = thickness), into the room, at floor level.
    const m = meshes(plain)[0];
    expect(m.position.z).toBeGreaterThan(0.14);
    expect(m.position.y).toBeCloseTo(SKIRTING_HEIGHT_M / 2, 5);
    // A stub wall too low for a board gets none.
    expect(skirtingObject(5, 0.14, [], 0.1)).toBeNull();
  });

  it('a door gets an architrave, a lining, a panelled leaf and handles; a doorway gets no leaf', () => {
    const door = doorObject(DOOR, 0.14, 2.7);
    const doorway = doorObject(DOORWAY, 0.14, 2.7);
    expect(meshes(door).length).toBeGreaterThan(meshes(doorway).length + 10);
    expect(meshes(doorway)).toHaveLength(6); // 3 architrave + 3 lining
    // The leaf sits inside the opening, centred on the wall's thickness, below the head.
    const leaf = meshes(door).find((m) => (m.geometry as THREE.BoxGeometry).parameters?.depth === 0.04)!;
    expect(leaf.position.x).toBeCloseTo((DOOR.t0M + DOOR.t1M) / 2, 5);
    expect(leaf.position.z).toBeCloseTo(0.07, 5);
    expect(leaf.position.y).toBeLessThan(DOOR.topM / 2 + 0.02);
    expect(leaf.castShadow).toBe(true);
  });

  it('a window gets a four-sided frame, a mullion when wide, and a sill on the room side', () => {
    const wide = windowObject(WINDOW, 0.14, 2.7);
    expect(meshes(wide)).toHaveLength(6); // 4 frame + mullion + sill
    const narrow = windowObject({ ...WINDOW, t1M: 1.2 }, 0.14, 2.7);
    expect(meshes(narrow)).toHaveLength(5);
    const sill = meshes(wide).find((m) => m.position.y < WINDOW.bottomM)!;
    expect(sill.position.z).toBeGreaterThan(0.07); // room side of the pane
    expect((sill.geometry as THREE.BoxGeometry).parameters.width).toBeCloseTo(1.2 + 0.08, 5);
  });

  it('wallJoinery assembles skirting + every opening and skips openings above a stub', () => {
    const full = wallJoinery(5, 0.14, 2.7, [DOOR, WINDOW]);
    expect(full.children.map((c) => c.userData.joinery).sort()).toEqual(['door', 'skirting', 'window']);
    const stub = wallJoinery(5, 0.14, 0.32, [DOOR, WINDOW]);
    // The stub keeps its skirting and the door's foot; the window (sill 0.9 m) is above it.
    expect(stub.children.map((c) => c.userData.joinery).sort()).toEqual(['door', 'skirting']);
  });

  it('floorKindOf reads the laid product, defaulting to the rubber tile and to bare screed when nothing is laid', () => {
    expect(floorKindOf(null)).toBe('screed');
    expect(floorKindOf({ id: 'k1-floor-eva-combat', name: 'EVA Combat Sport Mat 1×1m × 2.5 cm' })).toBe('eva-mat');
    expect(floorKindOf({ id: 'k1-floor-epdm-roll', name: 'EPDM Rubber Roll 6 mm — Grey' })).toBe('epdm-roll');
    expect(floorKindOf({ id: 'k1-floor-ifit-vinyl', name: 'iFIT Vinyl Equipment Mat 36"×72"' })).toBe('vinyl-mat');
    expect(floorKindOf({ id: 'k1-floor-rubber-interlock', name: 'Interlock Composite Rubber Tile 50×50×1.5 cm' })).toBe('interlock');
    expect(floorKindOf({ id: 'k1-floor-outdoor-rubber-1m', name: 'Outdoor Rubber Tile 1×1m × 5 cm — Red' })).toBe('rubber-tile');
    expect(floorKindOf({ name: 'Oak laminate plank' })).toBe('wood');
    expect(floorKindOf({ name: 'Porcelain tile 60×60' })).toBe('ceramic');
    expect(floorKindOf({ name: 'Something else' })).toBe('rubber-tile');
  });
});
