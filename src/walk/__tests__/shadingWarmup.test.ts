import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { createNaturalSceneRenderer } from '../../components/three/naturalSceneRenderer';

describe('Walk preserves upstream optional scene shading preparation', () => {
  it('restores scene materials and the previous target before waiting for normal and AO preparation', async () => {
    const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera();
    const material = new THREE.MeshPhysicalMaterial(), geometry = new THREE.BoxGeometry();
    const arrayMaterials = [new THREE.MeshStandardMaterial(), new THREE.MeshBasicMaterial()];
    const mesh = new THREE.Mesh(geometry, material), arrayMesh = new THREE.Mesh(geometry, arrayMaterials);
    const spriteMaterial = new THREE.SpriteMaterial(), lineMaterial = new THREE.LineBasicMaterial();
    const sprite = new THREE.Sprite(spriteMaterial), line = new THREE.Line(geometry, lineMaterial);
    scene.add(mesh, arrayMesh, sprite, line);
    const originals = [material, ...arrayMaterials, spriteMaterial, lineMaterial];
    const originalDisposals = originals.map(original => vi.spyOn(original, 'dispose'));
    const oldTarget = new THREE.WebGLRenderTarget(); let active: THREE.WebGLRenderTarget | null = oldTarget;
    let resolveAo!: () => void, resolveNormal!: () => void;
    const ao = new Promise<void>(resolve => { resolveAo = resolve; });
    const normal = new Promise<void>(resolve => { resolveNormal = resolve; });
    const compilations: { scene: THREE.Scene; target: THREE.WebGLRenderTarget | null }[] = [];
    const renderer = { extensions: { has: () => true }, capabilities: { maxSamples: 2 }, getPixelRatio: () => 1,
      getRenderTarget: () => active, setRenderTarget: (target: THREE.WebGLRenderTarget | null) => { active = target; },
      compileAsync: vi.fn((target: THREE.Scene) => {
        compilations.push({ scene: target, target: active });
        if (target === scene) {
          expect((mesh.material as THREE.Material).type).toBe('MeshNormalMaterial');
          expect(arrayMesh.material).toBe(mesh.material);
          expect(sprite.material).toBe(spriteMaterial); expect(line.material).toBe(lineMaterial);
          return normal;
        }
        expect(mesh.material).toBe(material); expect(arrayMesh.material).toBe(arrayMaterials);
        return ao;
      }) };
    const effect = createNaturalSceneRenderer(renderer as unknown as THREE.WebGLRenderer, scene, camera)!;
    let prepared = false;
    const preparation = effect.prepare();
    const pending = preparation.then(() => { prepared = true; });
    expect(mesh.material).toBe(material); expect(arrayMesh.material).toBe(arrayMaterials);
    expect(sprite.material).toBe(spriteMaterial); expect(line.material).toBe(lineMaterial);
    expect(active).toBe(oldTarget);
    expect(compilations).toHaveLength(2);
    expect(compilations[0].scene).not.toBe(scene);
    expect(compilations[0].target).not.toBe(oldTarget);
    expect(compilations[0].target?.texture.type).toBe(THREE.HalfFloatType);
    expect(compilations[1].scene).toBe(scene);
    expect(compilations[1].target).not.toBe(compilations[0].target);
    resolveAo(); await Promise.resolve(); expect(prepared).toBe(false);
    resolveNormal(); await pending; expect(prepared).toBe(true);
    expect(effect.prepare()).toBe(preparation);
    expect(renderer.compileAsync).toHaveBeenCalledTimes(2);
    effect.dispose();
    originalDisposals.forEach(disposed => expect(disposed).not.toHaveBeenCalled());
    originals.forEach(original => original.dispose()); geometry.dispose(); oldTarget.dispose();
  });

  it('restores every original material and target when normal compilation throws synchronously', async () => {
    const scene = new THREE.Scene(), material = new THREE.MeshStandardMaterial(), geometry = new THREE.BoxGeometry();
    const arrayMaterials = [new THREE.MeshPhysicalMaterial(), new THREE.MeshBasicMaterial()];
    const mesh = new THREE.Mesh(geometry, material), arrayMesh = new THREE.Mesh(geometry, arrayMaterials);
    scene.add(mesh, arrayMesh);
    const originals = [material, ...arrayMaterials];
    const originalDisposals = originals.map(original => vi.spyOn(original, 'dispose'));
    const oldTarget = new THREE.WebGLRenderTarget(); let active: THREE.WebGLRenderTarget | null = oldTarget;
    const quadDisposed = vi.fn();
    const renderer = { extensions: { has: () => true }, capabilities: { maxSamples: 2 }, getPixelRatio: () => 1,
      getRenderTarget: () => active, setRenderTarget: (target: THREE.WebGLRenderTarget | null) => { active = target; },
      compileAsync: vi.fn((target: THREE.Scene) => {
        if (target === scene) {
          expect((mesh.material as THREE.Material).type).toBe('MeshNormalMaterial');
          expect(arrayMesh.material).toBe(mesh.material);
          throw new Error('context lost');
        }
        (target.children[0] as THREE.Mesh).geometry.addEventListener('dispose', quadDisposed);
        return Promise.resolve();
      }) };
    const effect = createNaturalSceneRenderer(renderer as unknown as THREE.WebGLRenderer, scene, new THREE.PerspectiveCamera())!;
    const pending = effect.prepare();
    expect(mesh.material).toBe(material); expect(arrayMesh.material).toBe(arrayMaterials);
    expect(active).toBe(oldTarget);
    await expect(pending).rejects.toThrow('context lost');
    expect(quadDisposed).toHaveBeenCalledOnce();
    expect(renderer.compileAsync).toHaveBeenCalledTimes(2);
    effect.dispose();
    originalDisposals.forEach(disposed => expect(disposed).not.toHaveBeenCalled());
    originals.forEach(original => original.dispose()); geometry.dispose(); oldTarget.dispose();
  });
});
