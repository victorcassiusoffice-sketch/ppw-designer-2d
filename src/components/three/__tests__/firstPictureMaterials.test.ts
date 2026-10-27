import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { createFirstPictureMaterials } from '../firstPictureMaterials';

describe('progressive first picture uses the actual building', () => {
  it('preserves actual geometry, dimensions, maps, transparency and original material after drawing', () => {
    const scene = new THREE.Scene(), texture = new THREE.Texture();
    const original = new THREE.MeshPhysicalMaterial({ color:'#405f70', map:texture, transparent:true, opacity:.6, alphaTest:.15 });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(2, 3, .2), original);
    mesh.position.set(4, 1.5, 8); mesh.rotation.y = .5; scene.add(mesh);
    const geometry = mesh.geometry, bounds = new THREE.Box3().setFromObject(scene);
    const preview = createFirstPictureMaterials(); let temporary!: THREE.Material;
    preview.draw(scene, () => {
      temporary = mesh.material;
      expect(mesh.geometry).toBe(geometry);
      expect(new THREE.Box3().setFromObject(scene).equals(bounds)).toBe(true);
      expect(mesh.material).toBeInstanceOf(THREE.MeshLambertMaterial);
      expect(mesh.material.map).toBe(texture);
      expect(mesh.material.color.equals(original.color)).toBe(true);
      expect(mesh.material.opacity).toBe(.6); expect(mesh.material.alphaTest).toBe(.15);
    });
    expect(mesh.material).toBe(original);
    const nextMap = new THREE.Texture();
    original.map = nextMap; original.transparent = false; original.opacity = 1; original.alphaTest = .3;
    preview.draw(scene, () => {
      expect(mesh.material.map).toBe(nextMap);
      expect(mesh.material.transparent).toBe(false);
      expect(mesh.material.opacity).toBe(1); expect(mesh.material.alphaTest).toBe(.3);
    });
    expect(mesh.material).toBe(original);
    const dispose = vi.fn(); temporary.addEventListener('dispose', dispose);
    preview.dispose(); expect(dispose).toHaveBeenCalledOnce();
  });
  it('restores shared material arrays even if the first GPU draw fails', () => {
    const scene = new THREE.Scene(), original = new THREE.MeshStandardMaterial();
    const materials = [original, original], mesh = new THREE.Mesh(new THREE.BoxGeometry(), materials);
    scene.add(mesh); const preview = createFirstPictureMaterials();
    expect(() => preview.draw(scene, () => { throw new Error('context lost'); })).toThrow('context lost');
    expect(mesh.material).toBe(materials); preview.dispose();
  });
});
