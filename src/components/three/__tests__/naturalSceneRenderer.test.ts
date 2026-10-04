// @vitest-environment node
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { naturalRenderResolution, withOpaqueOccluders } from '../naturalSceneRenderer';

describe('bounded natural-light scene shading', () => {
  it.each([[390, 844, 3], [1440, 900, 2], [3840, 2160, 2], [7680, 4320, 4], [1, 1, 1]])('bounds render and AO costs for a %s×%s viewport', (width, height, dpr) => {
    const resolution = naturalRenderResolution(width, height, dpr);
    expect(resolution.beautyWidth * resolution.beautyHeight).toBeLessThanOrEqual(2_000_000);
    expect(resolution.aoWidth * resolution.aoHeight).toBeLessThanOrEqual(500_000);
    expect(resolution.aoWidth).toBeGreaterThan(0);
    expect(resolution.aoHeight).toBeGreaterThan(0);
    expect(Math.abs(resolution.beautyWidth / resolution.beautyHeight - width / height)).toBeLessThan(0.01);
  });

  it('keeps geometry, materials and original visibility intact after the occlusion pass, even if it fails', () => {
    const scene = new THREE.Scene();
    const wall = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial());
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(), new THREE.MeshPhysicalMaterial({ transparent: true, opacity: 0.3 }));
    const decal = new THREE.Mesh(new THREE.PlaneGeometry(), new THREE.MeshBasicMaterial({ depthWrite: false }));
    const hidden = glass.clone();
    hidden.visible = false;
    scene.add(wall, glass, decal, hidden);
    const originalBounds = new THREE.Box3().setFromObject(scene);
    const material = glass.material;
    expect(() => withOpaqueOccluders(scene, () => {
      expect(wall.visible).toBe(true);
      expect(glass.visible).toBe(false);
      expect(decal.visible).toBe(false);
      expect(hidden.visible).toBe(false);
      throw new Error('GPU unavailable');
    })).toThrow('GPU unavailable');
    expect(wall.visible).toBe(true);
    expect(glass.visible).toBe(true);
    expect(decal.visible).toBe(true);
    expect(hidden.visible).toBe(false);
    expect(glass.material).toBe(material);
    expect(new THREE.Box3().setFromObject(scene).equals(originalBounds)).toBe(true);
  });
});
