import { describe, expect, it, vi } from 'vitest';
import { DirectionalLight, Fog, Mesh, PerspectiveCamera, Scene, Vector3 } from 'three';
import type { WallOpeningSolid } from '../../designer/roomSolids';
import type { ThreeStageSurface } from '../../components/three/ThreeStage';
import { wallJoinery } from '../../components/three/joinery';
import { hideStaticDoorLeaves, renderWalkSurface } from '../stageSurface';

describe('deferred Walk stage surface', () => {
  it('uses the current camera, light, sky and bounds without changing camera, bounds or renderer quality', () => {
    const scene = new Scene(); scene.fog = new Fog('#ccddee', 1, 2);
    const view = new PerspectiveCamera(); view.position.set(3, 5, 7);
    const fill = new DirectionalLight(), sky = new Mesh(), centre = new Vector3(1, 2, 3);
    const render = vi.fn(), renderer = { render, toneMapping: 0, outputColorSpace: 'srgb', shadowMap: { enabled: true, type: 1 } };
    const surface = { scene, renderer, fill: { current: fill }, sky: { current: sky }, bounds: { current: { centre, radius: 9 } }, fogClearance: 3, release: vi.fn() } as unknown as ThreeStageSurface;
    const cameraBefore = view.toJSON(), centreBefore = centre.toArray();
    renderWalkSurface(surface, view);
    expect(fill.position.toArray()).toEqual([3, 9, 7]);
    expect(fill.target.position.toArray()).toEqual([3, 5, 7]);
    expect(sky.position.toArray()).toEqual([3, 0, 7]);
    expect(scene.fog.near).toBeCloseTo(view.position.distanceTo(centre) + 12);
    expect(scene.fog.far - scene.fog.near).toBeCloseTo(72);
    expect(render).toHaveBeenCalledWith(scene, view);
    expect(view.toJSON()).toEqual(cameraBefore); expect(centre.toArray()).toEqual(centreBefore);
    expect(renderer).toMatchObject({ toneMapping: 0, outputColorSpace: 'srgb', shadowMap: { enabled: true, type: 1 } });
    const replacementFill = new DirectionalLight(), replacementSky = new Mesh();
    Object.assign(surface.fill, { current: replacementFill }); Object.assign(surface.sky, { current: replacementSky });
    Object.assign(surface.bounds, { current: { centre: new Vector3(), radius: 4 } });
    view.position.set(9, 2, 4); renderWalkSurface(surface, view);
    expect(replacementFill.position.toArray()).toEqual([9, 6, 4]);
    expect(replacementSky.position.toArray()).toEqual([9, 0, 4]);
    expect(fill.position.toArray()).toEqual([3, 9, 7]);
    expect(scene.fog.near).toBeCloseTo(view.position.length() + 7);
    expect(scene.fog.far - scene.fog.near).toBeCloseTo(60);
    expect(surface.release).not.toHaveBeenCalled();
  });

  it('hides only existing door leaves/panels/handles, preserves shaped trim and windows, and restores only acquired visibility', () => {
    const openings = [
      { id: 'normal', kind: 'door', t0M: 1, t1M: 2, bottomM: 0, topM: 2.2 },
      { id: 'arch', kind: 'door', t0M: 3, t1M: 4, bottomM: 0, topM: 2.2, shape: 'arch', profile: [{ x: 3, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 1.8 }, { x: 3.5, y: 2.2 }, { x: 3, y: 1.8 }] },
      { id: 'window', kind: 'window', t0M: 5, t1M: 6, bottomM: .8, topM: 2 },
    ] as WallOpeningSolid[];
    const scene = new Scene(), joinery = wallJoinery(7, .15, 2.7, openings); scene.add(joinery);
    const normal = joinery.children.find(object => object.userData.joinery === 'door')!;
    const originalHidden = normal.children[7]; originalHidden.visible = false;
    const before: Array<{ object: import('three').Object3D; visible: boolean; data: string }> = [];
    const geometryDisposals: Array<ReturnType<typeof vi.fn>> = [], materialDisposals: Array<ReturnType<typeof vi.fn>> = [];
    const geometries = new Set<import('three').BufferGeometry>(), materials = new Set<import('three').Material>();
    scene.traverse(object => {
      before.push({ object, visible: object.visible, data: JSON.stringify(object.userData) });
      const mesh = object as Mesh;
      if (!mesh.isMesh) return;
      geometries.add(mesh.geometry);
      for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) materials.add(material);
    });
    for (const geometry of geometries) { const spy = vi.fn(); geometry.addEventListener('dispose', spy); geometryDisposals.push(spy); }
    for (const material of materials) { const spy = vi.fn(); material.addEventListener('dispose', spy); materialDisposals.push(spy); }
    const hidden = hideStaticDoorLeaves(scene);
    expect(hidden).not.toContain(originalHidden);
    expect(normal.children.slice(0, 6).every(object => object.visible)).toBe(true);
    expect(normal.children.slice(6).every(object => !object.visible)).toBe(true);
    const shaped = hidden.filter(object => object.parent === joinery);
    expect(shaped).toHaveLength(1); expect((shaped[0] as Mesh).geometry.type).toBe('ExtrudeGeometry');
    const window = joinery.children.find(object => object.userData.joinery === 'window')!;
    expect(window.visible && window.children.every(object => object.visible)).toBe(true);
    expect(joinery.children.filter(object => object !== shaped[0]).every(object => object.visible)).toBe(true);
    expect(hideStaticDoorLeaves(scene)).toEqual([]);
    hidden.forEach(object => { object.visible = true; });
    for (const item of before) { expect(item.object.visible).toBe(item.visible); expect(JSON.stringify(item.object.userData)).toBe(item.data); }
    expect([...geometryDisposals, ...materialDisposals].every(spy => spy.mock.calls.length === 0)).toBe(true);
    for (const geometry of geometries) geometry.dispose();
  });
});
