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
  it('prepares the actual first-frame variants without leaving temporary materials installed while awaiting shaders', async () => {
    const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera();
    const original = new THREE.MeshPhysicalMaterial({ color: '#508479' });
    const materials = [original, original];
    const visible = new THREE.Mesh(new THREE.BoxGeometry(), materials);
    const hidden = new THREE.Mesh(new THREE.BoxGeometry(), original);
    hidden.visible = false; scene.add(visible, hidden);
    let finish!: (value: THREE.Scene) => void;
    const compiling = new Promise<THREE.Scene>(resolve => { finish = resolve; });
    let prepared!: THREE.Material;
    const renderer = { compileAsync: vi.fn((target: THREE.Object3D, viewpoint: THREE.Camera) => {
      expect(target).toBe(scene); expect(viewpoint).toBe(camera);
      prepared = visible.material[0];
      expect(prepared).toBeInstanceOf(THREE.MeshLambertMaterial);
      // Three.compile traverses hidden cutaway meshes too. They must not
      // introduce original PBR programs into the first-picture warm-up.
      expect(hidden.material).toBe(prepared);
      expect(hidden.visible).toBe(false);
      return compiling;
    }) };
    const preview = createFirstPictureMaterials();
    const pending = preview.prepare(renderer, scene, camera);
    expect(visible.material).toBe(materials); expect(hidden.material).toBe(original);
    preview.draw(scene, () => expect(visible.material[0]).toBe(prepared));
    finish(scene); await pending;
    expect(visible.material).toBe(materials); expect(hidden.material).toBe(original);
    preview.dispose();
  });
  it('restores original materials when shader preparation fails synchronously or asynchronously', async () => {
    const scene = new THREE.Scene(), original = new THREE.MeshPhysicalMaterial();
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(), original); scene.add(mesh);
    const preview = createFirstPictureMaterials(), camera = new THREE.PerspectiveCamera();
    expect(() => preview.prepare({ compileAsync: () => { throw new Error('context lost'); } }, scene, camera)).toThrow('context lost');
    expect(mesh.material).toBe(original);
    const pending = preview.prepare({ compileAsync: () => Promise.reject(new Error('link failed')) }, scene, camera);
    expect(mesh.material).toBe(original);
    await expect(pending).rejects.toThrow('link failed');
    expect(mesh.material).toBe(original); preview.dispose();
  });
});
