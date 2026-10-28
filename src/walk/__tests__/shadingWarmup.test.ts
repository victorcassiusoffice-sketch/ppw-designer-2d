import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { createNaturalSceneRenderer } from '../../components/three/naturalSceneRenderer';

describe('Walk launcher remains responsive during optional scene shading', () => {
  it('waits for the beauty shader variant on the compositor target before permitting its first draw', async () => {
    const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera();
    const material = new THREE.MeshPhysicalMaterial(), geometry = new THREE.BoxGeometry();
    const mesh = new THREE.Mesh(geometry, material); scene.add(mesh);
    const spriteMaterial = new THREE.SpriteMaterial(), lineMaterial = new THREE.LineBasicMaterial();
    const sprite = new THREE.Sprite(spriteMaterial), line = new THREE.Line(geometry, lineMaterial); scene.add(sprite, line);
    const oldTarget = new THREE.WebGLRenderTarget(); let active: THREE.WebGLRenderTarget | null = oldTarget;
    let resolveBeauty!: () => void;
    const beauty = new Promise<void>(resolve => { resolveBeauty = resolve; });
    const compilations: { target: THREE.WebGLRenderTarget | null; material: THREE.Material | THREE.Material[] }[] = [];
    const renderer = { extensions: { has: () => true }, capabilities: { maxSamples: 2 }, getPixelRatio: () => 1,
      getRenderTarget: () => active, setRenderTarget: (target: THREE.WebGLRenderTarget | null) => { active = target; },
      compileAsync: vi.fn((target: THREE.Scene) => {
        if (target === scene) {
          compilations.push({ target: active, material: mesh.material });
          if ((mesh.material as THREE.Material).type === 'MeshPhysicalMaterial') {
            expect(sprite.material).not.toBe(spriteMaterial); expect(line.material).not.toBe(lineMaterial);
            return beauty;
          }
        }
        return Promise.resolve();
      }) };
    const effect = createNaturalSceneRenderer(renderer as unknown as THREE.WebGLRenderer, scene, camera)!;
    let prepared = false;
    const pending = effect.prepare().then(() => { prepared = true; });
    expect(mesh.material).toBe(material); expect(active).toBe(oldTarget);
    expect(sprite.material).toBe(spriteMaterial); expect(line.material).toBe(lineMaterial);
    expect(compilations).toHaveLength(2);
    const warm = compilations[0].material as THREE.Material;
    expect(warm).not.toBe(material); expect(warm.type).toBe(material.type);
    expect(warm.onBeforeCompile).toBe(material.onBeforeCompile);
    expect(warm.customProgramCacheKey).toBe(material.customProgramCacheKey);
    const disposeWarm = vi.spyOn(warm, 'dispose');
    expect(compilations[0].target).not.toBe(oldTarget);
    expect(compilations[0].target?.texture.type).toBe(THREE.HalfFloatType);
    expect(compilations[1].target).not.toBe(compilations[0].target);
    expect((compilations[1].material as THREE.Material).type).toBe('MeshNormalMaterial');
    await Promise.resolve(); expect(prepared).toBe(false);
    resolveBeauty(); await pending; expect(prepared).toBe(true);
    expect(disposeWarm).not.toHaveBeenCalled();
    await effect.prepare(); expect(renderer.compileAsync).toHaveBeenCalledTimes(3);
    effect.dispose(); expect(disposeWarm).toHaveBeenCalledOnce();
    material.dispose(); spriteMaterial.dispose(); lineMaterial.dispose(); geometry.dispose(); oldTarget.dispose();
  });

  it('restores materials and the previous target on synchronous compile failure and releases temporary copies on teardown', async () => {
    const scene = new THREE.Scene(), material = new THREE.MeshStandardMaterial(), geometry = new THREE.BoxGeometry();
    const mesh = new THREE.Mesh(geometry, material); scene.add(mesh);
    const oldTarget = new THREE.WebGLRenderTarget(); let active: THREE.WebGLRenderTarget | null = oldTarget;
    let temporary: THREE.Material | undefined;
    const renderer = { extensions: { has: () => true }, capabilities: { maxSamples: 2 }, getPixelRatio: () => 1,
      getRenderTarget: () => active, setRenderTarget: (target: THREE.WebGLRenderTarget | null) => { active = target; },
      compileAsync: () => { temporary = mesh.material; throw new Error('context lost'); } };
    const effect = createNaturalSceneRenderer(renderer as unknown as THREE.WebGLRenderer, scene, new THREE.PerspectiveCamera())!;
    const pending = effect.prepare();
    expect(mesh.material).toBe(material); expect(active).toBe(oldTarget);
    await expect(pending).rejects.toThrow('context lost');
    const disposed = vi.spyOn(temporary!, 'dispose'); effect.dispose();
    expect(disposed).toHaveBeenCalledOnce(); material.dispose(); geometry.dispose(); oldTarget.dispose();
  });
});
