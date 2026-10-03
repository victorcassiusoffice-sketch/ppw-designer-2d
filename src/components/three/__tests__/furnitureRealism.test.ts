// @vitest-environment node
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { cushionGeometry, furnitureSurface } from '../furnitureSurface';
import { applyProductSurfaceLighting } from '../productSurfaceLighting';
import { architecturalBackdrop } from '../renderPresentation';

describe('product surface realism without changing dimensions or colour', () => {
  it('keeps soft furnishings within their centimetre envelope with bounded geometry', () => {
    for (const dimensions of [[0.5, 0.12, 0.5], [1.6, 0.06, 1.2], [0.8, 0.45, 0.15]]) {
      const [w, h, d] = dimensions;
      const geometry = cushionGeometry(w, h, d);
      const vertices = geometry.getAttribute('position');
      const normals = geometry.getAttribute('normal');
      for (let i = 0; i < vertices.count; i++) {
        expect(Math.abs(vertices.getX(i))).toBeLessThanOrEqual(w / 2 + 1e-7);
        expect(Math.abs(vertices.getY(i))).toBeLessThanOrEqual(h / 2 + 1e-7);
        expect(Math.abs(vertices.getZ(i))).toBeLessThanOrEqual(d / 2 + 1e-7);
        expect(Number.isFinite(normals.getX(i) + normals.getY(i) + normals.getZ(i))).toBe(true);
      }
      expect(vertices.count).toBeLessThan(400);
      expect(geometry.index!.count / 3).toBeLessThan(600);
      // More than two heights: actual soft curvature, not a renamed cuboid.
      const heights = new Set(Array.from({ length: vertices.count }, (_, i) => vertices.getY(i).toFixed(5)));
      expect(heights.size).toBeGreaterThan(10);
      geometry.dispose();
    }
  });

  it('provides small deterministic packed bump / roughness maps without albedo or network assets', () => {
    for (const kind of ['wood', 'stone', 'fabric', 'weave'] as const) {
      const a = furnitureSurface(kind), b = furnitureSurface(kind);
      expect(a).not.toBe(b);
      expect(a.image.width).toBe(128);
      expect(a.image.height).toBe(128);
      expect(a.image.data).toEqual(b.image.data);
      expect(a.colorSpace).toBe(THREE.NoColorSpace);
      expect(a.generateMipmaps).toBe(true);
      expect(a.wrapS).toBe(THREE.RepeatWrapping);
      const values = a.image.data!;
      const heights = new Set<number>(), roughness = new Set<number>();
      for (let i = 0; i < values.length; i += 4) {
        heights.add(Number(values[i]));
        roughness.add(Number(values[i + 1]));
      }
      expect(heights.size).toBeGreaterThan(20);
      expect(roughness.size).toBeGreaterThan(4);
      a.dispose(); b.dispose();
    }
  });

  it('lights dimensional previews and loaded models consistently without touching their original colour, texture, roughness or bounds', () => {
    const texture = new THREE.Texture();
    const material = new THREE.MeshPhysicalMaterial({ color: '#797264', bumpMap: texture, roughness: 0.88, metalness: 0.65 });
    const root = new THREE.Group();
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(2, 0.7, 0.9), material);
    root.add(mesh);
    root.position.set(4, 3, 7);
    root.rotation.y = 0.7;
    const originalBounds = new THREE.Box3().setFromObject(root);
    const environment = new THREE.Texture();
    applyProductSurfaceLighting(root, environment, 16);
    expect(material.envMap).toBe(environment);
    expect(material.envMapIntensity).toBe(0.35);
    expect(material.color.getHexString()).toBe('797264');
    expect(material.roughness).toBe(0.88);
    expect(material.metalness).toBe(0.65);
    expect(material.bumpMap).toBe(texture);
    expect(texture.anisotropy).toBe(4);
    expect(new THREE.Box3().setFromObject(root).equals(originalBounds)).toBe(true);
    applyProductSurfaceLighting(root, null, NaN);
    expect(material.envMap).toBeNull();
    expect(material.envMapIntensity).toBe(0);
    expect(texture.anisotropy).toBe(1);
  });

  it('keeps the unpriced ivory / sage backdrop dark at night and bounded for invalid inputs', () => {
    const day = architecturalBackdrop(1), night = architecturalBackdrop(0);
    expect(day.horizon).toEqual([222, 219, 210]);
    expect(day.top).toEqual([216, 221, 213]);
    expect(night.top.every((channel, i) => channel < day.top[i])).toBe(true);
    expect(architecturalBackdrop(NaN)).toEqual(day);
    expect(architecturalBackdrop(2)).toEqual(day);
    expect(architecturalBackdrop(-1)).toEqual(night);
  });
});
