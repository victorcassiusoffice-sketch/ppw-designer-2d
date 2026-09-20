// @vitest-environment node
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { contactShadow, lampsOnFactor, nightLight } from '../dressing';
import { doorRuns } from '../joinery';
import type { ItemSolid, WallOpeningSolid } from '../../../designer/roomSolids';

const ITEM: ItemSolid = { key: 'i', instanceId: 'i1', x0: 1, y0: 2, x1: 3, y1: 2.8, z0: 0, z1: 1.4, rotationDeg: 0, hex: '#888', lengthM: 2, widthM: 0.8, heightM: 1.4 };

describe('dressing — contact shadows, lamps, door runs (3D Mode P3)', () => {
  it('a floor item gets a contact shadow sized to its footprint plus a margin; wall / ceiling / raised items none', () => {
    const s = contactShadow(ITEM)!;
    const p = (s.geometry as THREE.PlaneGeometry).parameters;
    expect(p.width).toBeCloseTo(2.2, 5);
    expect(p.height).toBeCloseTo(1.0, 5);
    expect(s.position.x).toBeCloseTo(2, 5);
    expect(s.position.z).toBeCloseTo(2.4, 5);
    expect(s.position.y).toBeGreaterThan(0);
    expect((s.material as THREE.MeshBasicMaterial).transparent).toBe(true);
    expect(contactShadow({ ...ITEM, placement: 'wall' })).toBeNull();
    expect(contactShadow({ ...ITEM, placement: 'ceiling' })).toBeNull();
    expect(contactShadow({ ...ITEM, z0: 0.9, z1: 1.2 })).toBeNull();
  });

  it('a night light sits at the lamp at its mount height, warm, no shadow; lamps fade in around sunset', () => {
    const { light, glow } = nightLight(ITEM, 2.3);
    expect(light.position.toArray()).toEqual([2, 2.3, 2.4]);
    expect(light.castShadow).toBe(false);
    expect(light.decay).toBe(2);
    expect(glow.position.equals(light.position)).toBe(true);
    expect(lampsOnFactor(30)).toBe(0);
    expect(lampsOnFactor(8)).toBe(0);
    expect(lampsOnFactor(3)).toBeCloseTo(0.5, 5);
    expect(lampsOnFactor(-5)).toBe(1);
  });

  it('door runs leave doors and doorways clear and keep windows', () => {
    const door: WallOpeningSolid = { t0M: 1, t1M: 1.84, bottomM: 0, topM: 2.05, kind: 'door' };
    const win: WallOpeningSolid = { t0M: 3, t1M: 4, bottomM: 0.9, topM: 2.1, kind: 'window' };
    expect(doorRuns(5, [])).toEqual([[0, 5]]);
    expect(doorRuns(5, [win])).toEqual([[0, 5]]);
    expect(doorRuns(5, [door, win])).toEqual([
      [0, 1],
      [1.84, 5],
    ]);
    // A door at the very start leaves no stub before it.
    expect(doorRuns(5, [{ ...door, t0M: 0, t1M: 0.9 }])).toEqual([[0.9, 5]]);
  });
});
