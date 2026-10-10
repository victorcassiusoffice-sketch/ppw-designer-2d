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

  it('supersamples low-density desktop wall edges without raising phone render costs', () => {
    expect(naturalRenderResolution(1440, 700, 1)).toEqual({ beautyWidth: 1800, beautyHeight: 875, aoWidth: 900, aoHeight: 437 });
    expect(naturalRenderResolution(320, 580, 1)).toEqual({ beautyWidth: 320, beautyHeight: 580, aoWidth: 160, aoHeight: 290 });
    expect(naturalRenderResolution(320, 580, 3)).toEqual({ beautyWidth: 480, beautyHeight: 870, aoWidth: 240, aoHeight: 435 });
    const large = naturalRenderResolution(3840, 2160, 1);
    expect(large.beautyWidth * large.beautyHeight).toBeLessThanOrEqual(2_000_000);
    expect(large.aoWidth * large.aoHeight).toBeLessThanOrEqual(500_000);
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
  it('excludes depth annotation sprites from occlusion without changing beauty visibility or pose', () => {
    const scene = new THREE.Scene();
    const annotation = new THREE.Sprite(new THREE.SpriteMaterial({ depthTest: false }));
    annotation.position.set(2, 0.45, -1);
    annotation.scale.set(3.2, 0.8, 1);
    const hiddenAnnotation = annotation.clone();
    hiddenAnnotation.visible = false;
    const wall = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial());
    scene.add(annotation, hiddenAnnotation, wall);
    const position = annotation.position.clone(), scale = annotation.scale.clone();
    withOpaqueOccluders(scene, () => {
      expect(annotation.visible).toBe(false);
      expect(hiddenAnnotation.visible).toBe(false);
      expect(wall.visible).toBe(true);
    });
    expect(annotation.visible).toBe(true);
    expect(hiddenAnnotation.visible).toBe(false);
    expect(annotation.position.equals(position)).toBe(true);
    expect(annotation.scale.equals(scale)).toBe(true);
  });
});
