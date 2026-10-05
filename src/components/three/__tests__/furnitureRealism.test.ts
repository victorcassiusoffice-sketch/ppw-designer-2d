// @vitest-environment node
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { cushionGeometry, curvedBackGeometry, drapedClothGeometry, furnitureAlbedo, furnitureSurface, physicalFurnitureUVs } from '../furnitureSurface';
import { furnitureOcclusion } from '../furnitureOcclusion';
import { applyProductSurfaceLighting } from '../productSurfaceLighting';
import { architecturalBackdrop } from '../renderPresentation';

describe('product surface realism without changing dimensions or colour', () => {
  it('drapes bedding over the mattress with bounded height and visible cloth folds', () => {
    const geometry = drapedClothGeometry(1.6, 1.3, 0.15);
    const positions = geometry.getAttribute('position');
    const normals = geometry.getAttribute('normal');
    const heights = new Set<number>();
    for (let i = 0; i < positions.count; i++) {
      expect(Math.abs(positions.getX(i))).toBeLessThanOrEqual(0.8 + 1e-7);
      expect(Math.abs(positions.getZ(i))).toBeLessThanOrEqual(0.65 + 1e-7);
      expect(positions.getY(i)).toBeGreaterThanOrEqual(-0.15 - 1e-7);
      expect(positions.getY(i)).toBeLessThanOrEqual(0.014 + 1e-7);
      expect(Number.isFinite(normals.getX(i) + normals.getY(i) + normals.getZ(i))).toBe(true);
      heights.add(Number(positions.getY(i).toFixed(4)));
    }
    expect(heights.size).toBeGreaterThan(100);
    expect(positions.count).toBeLessThan(1600);
    expect(geometry.boundingBox!.min.y).toBeCloseTo(-0.15);
    geometry.dispose();
  });

  it('uses visible deterministic wood/textile/stone grain with metre-based UVs', () => {
    for (const kind of ['fabric', 'wood', 'weave', 'stone'] as const) {
      const first = furnitureAlbedo(kind), second = furnitureAlbedo(kind);
      expect(first.image.width).toBe(256);
      expect(first.image.data).toEqual(second.image.data);
      expect(first.colorSpace).toBe(THREE.SRGBColorSpace);
      expect(new Set(first.image.data).size).toBeGreaterThan(12);
      expect(first.generateMipmaps).toBe(true);
      first.dispose(); second.dispose();
    }
    const geometry = new THREE.BoxGeometry(2, 0.8, 1);
    const original = geometry.getAttribute('position').array.slice();
    physicalFurnitureUVs(geometry);
    const uv = geometry.getAttribute('uv');
    expect(Math.max(...Array.from({ length: uv.count }, (_, i) => uv.getX(i)))).toBe(1);
    expect(Math.min(...Array.from({ length: uv.count }, (_, i) => uv.getX(i)))).toBe(-1);
    expect(geometry.getAttribute('position').array).toEqual(original);
    geometry.dispose();
  });

  it('bakes bounded furniture contact shading only near an adjacent part', () => {
    const geometry = new THREE.BoxGeometry(1, 0.1, 1, 4, 1, 4);
    geometry.computeBoundingBox();
    const owner = geometry.boundingBox!;
    const adjacent = new THREE.Box3(new THREE.Vector3(-0.5, 0.051, -0.5), new THREE.Vector3(0.5, 0.3, -0.4));
    const original = geometry.getAttribute('position').array.slice();
    furnitureOcclusion(geometry, owner, [owner, adjacent]);
    const colours = geometry.getAttribute('color').array;
    expect(Math.min(...colours)).toBeGreaterThanOrEqual(0.71);
    expect(Math.min(...colours)).toBeLessThan(0.95);
    expect(Math.max(...colours)).toBe(1);
    expect(geometry.getAttribute('position').array).toEqual(original);
    furnitureOcclusion(geometry, owner, [owner]);
    expect(new Set(geometry.getAttribute('color').array)).toEqual(new Set([1]));
    geometry.dispose();
  });

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
      expect(vertices.count).toBeLessThan(700);
      expect(geometry.index!.count / 3).toBeLessThan(1100);
      // More than two heights: actual soft curvature, not a renamed cuboid.
      const heights = new Set(Array.from({ length: vertices.count }, (_, i) => vertices.getY(i).toFixed(5)));
      expect(heights.size).toBeGreaterThan(10);
      geometry.dispose();
    }
  });

  it('curves chair backs into a closed shell without inflating the footprint', () => {
    for (const [w, h, d] of [[0.4, 0.25, 0.06], [0.55, 0.65, 0.12]]) {
      const geometry = curvedBackGeometry(w, h, d);
      const positions = geometry.getAttribute('position');
      const normal = geometry.getAttribute('normal');
      const backDepths = new Set<number>();
      for (let i = 0; i < positions.count; i++) {
        expect(Math.abs(positions.getX(i))).toBeLessThanOrEqual(w / 2 + 1e-7);
        expect(Math.abs(positions.getY(i))).toBeLessThanOrEqual(h / 2 + 1e-7);
        expect(Math.abs(positions.getZ(i))).toBeLessThanOrEqual(d / 2 + 1e-7);
        expect(Number.isFinite(normal.getX(i) + normal.getY(i) + normal.getZ(i))).toBe(true);
        backDepths.add(Number(positions.getZ(i).toFixed(5)));
      }
      // A flat box has two depths. The curved surface has many, and still
      // stays under 500 vertices per chair for six-seat dining products.
      expect(backDepths.size).toBeGreaterThan(8);
      expect(positions.count).toBeLessThan(500);
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
    expect(day.horizon).toEqual([192, 206, 200]);
    expect(day.top).toEqual([169, 187, 180]);
    expect(night.top.every((channel, i) => channel < day.top[i])).toBe(true);
    expect(architecturalBackdrop(NaN)).toEqual(day);
    expect(architecturalBackdrop(2)).toEqual(day);
    expect(architecturalBackdrop(-1)).toEqual(night);
  });
});
