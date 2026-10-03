// @vitest-environment node
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { contactShadow, cornerShades, lampsOnFactor, nightLight, CORNER_SHADE_VERTICAL_M } from '../dressing';
import { doorRuns } from '../joinery';
import { bareMineralSurface, cornerShadeTexture, softShadowTexture } from '../surfaces';
import type { ItemSolid, WallOpeningSolid, WallSolid } from '../../../designer/roomSolids';

const ITEM: ItemSolid = { key: 'i', instanceId: 'i1', x0: 1, y0: 2, x1: 3, y1: 2.8, z0: 0, z1: 1.4, rotationDeg: 0, hex: '#888', lengthM: 2, widthM: 0.8, heightM: 1.4 };

describe('dressing — contact shadows, lamps, door runs (3D Mode P3)', () => {
  it('keeps unfinished screed even and flat with only fine low-contrast mineral grain', () => {
    const surface = bareMineralSurface();
    expect(surface.normalScale).toBe(0);
    const pixels = (surface.map as THREE.DataTexture).image.data!;
    for (let i = 0; i < pixels.length; i += 4) {
      expect(pixels[i]).toBeGreaterThanOrEqual(249);
      expect(pixels[i]).toBeLessThanOrEqual(254);
      expect(pixels[i + 1]).toBe(pixels[i]);
      expect(pixels[i + 2]).toBe(pixels[i]);
    }
    expect(surface.map.repeat.toArray()).toEqual([2, 2]);
    expect(surface.map.colorSpace).toBe(THREE.SRGBColorSpace);
  });

  it('encodes contact opacity in green, which Three alphaMap actually reads, with a soft clear edge', () => {
    const texture = softShadowTexture() as THREE.DataTexture;
    const pixels = texture.image.data!;
    const width = texture.image.width;
    const middle = (Math.floor(width / 2) * width + Math.floor(width / 2)) * 4;
    expect(pixels[middle + 1]).toBeGreaterThan(250);
    expect(pixels[1]).toBe(0);
    expect(pixels[middle + 3]).toBe(255);
    expect(pixels[3]).toBe(255);
    expect(texture.colorSpace).toBe(THREE.NoColorSpace);
    const corner = cornerShadeTexture() as THREE.DataTexture;
    expect(corner.image.data![1]).toBe(255);
    expect(corner.image.data![corner.image.data!.length - 3]).toBe(0);
  });

  it('keeps vertical corner occlusion at the wall edges, never a horizontal stripe across its centre', () => {
    const wall: WallSolid = { key: 'wall-r-0', hit: { kind: 'edge', roomId: 'r', edgeIndex: 0 },
      a: { x: 0, y: 0 }, b: { x: 5, y: 0 }, inward: { x: 0, y: 1 }, lengthM: 5,
      thicknessM: 0.15, heightM: 2.7, stubHeightM: 0.25, centred: false, hex: '#808080', openings: [], shared: false, free: false };
    const shading = cornerShades(wall, wall.heightM, []);
    const strips = shading.children.slice(-2);
    for (const [index, strip] of strips.entries()) {
      const bounds = new THREE.Box3().setFromObject(strip);
      expect(bounds.getSize(new THREE.Vector3()).x).toBeCloseTo(CORNER_SHADE_VERTICAL_M, 5);
      expect(bounds.min.y).toBeCloseTo(0, 5);
      expect(bounds.max.y).toBeCloseTo(2.7, 5);
      if (index === 0) expect(bounds.min.x).toBeCloseTo(0, 5);
      else expect(bounds.max.x).toBeCloseTo(5, 5);
    }
  });

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
    const upstairs = contactShadow({ ...ITEM, floorElevationM: 2.88, z0: 2.88, z1: 4.28 });
    expect(upstairs?.position.y).toBeCloseTo(2.886);
    expect(contactShadow({ ...ITEM, floorElevationM: 2.88, z0: 3.78, z1: 4.08 })).toBeNull();
  });

  it('a night light sits at the lamp at its mount height, warm, no shadow; lamps fade in around sunset', () => {
    const { light, glow } = nightLight(ITEM, 2.3);
    expect(light.position.toArray()).toEqual([2, 2.3, 2.4]);
    expect(light.castShadow).toBe(false);
    expect(light.decay).toBe(2);
    expect(glow.position.equals(light.position)).toBe(true);
    // A spherical light's reach at floor level matches the plan radius.
    expect(light.distance).toBeCloseTo(Math.hypot(3.5, 2.3));
    const upstairs = nightLight({ ...ITEM, floorElevationM: 3, z0: 3 }, 5.3);
    expect(upstairs.light.distance).toBeCloseTo(light.distance);
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
