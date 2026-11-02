import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { shadeMeshes } from '../shadeMeshes';
import type { ShadeModel } from '../../../designer/shade';

const model: ShadeModel = {
  version: 1, enabled: true, sails: [{
    id: 'sail', name: 'Terrace sail', fabric: 'hdpe-knit', cornerGapM: 0.3, edgeCurvePct: 7, colour: '#e9e3d4',
    anchors: [
      { id: 'a', x: 0, y: 0, heightM: 3.2, support: 'post' }, { id: 'b', x: 4, y: 0, heightM: 2.4, support: 'post' },
      { id: 'c', x: 4, y: 4, heightM: 3.2, support: 'wall' }, { id: 'd', x: 0, y: 4, heightM: 2.4, support: 'post' },
    ],
  }],
};

describe('shade sail meshes', () => {
  it('builds a membrane inside the fixing points at the fixing heights, with posts on the ground and a bracket on the wall point', () => {
    const group = shadeMeshes(model, 0.5);
    const sail = group.getObjectByName('shade-sail-sail')!;
    expect(sail).toBeTruthy();
    const membrane = sail.getObjectByName('shade-membrane-sail') as THREE.Mesh;
    const bounds = new THREE.Box3().setFromObject(membrane);
    expect(bounds.min.x).toBeGreaterThan(0); expect(bounds.max.x).toBeLessThan(4);
    expect(bounds.min.z).toBeGreaterThan(0); expect(bounds.max.z).toBeLessThan(4);
    expect(bounds.min.y).toBeGreaterThanOrEqual(2.4 + 0.5 - 1e-6); expect(bounds.max.y).toBeLessThanOrEqual(3.2 + 0.5 + 1e-6);
    const position = membrane.geometry.getAttribute('position');
    for (let i = 0; i < position.count; i++) expect(Number.isFinite(position.getY(i))).toBe(true);
    expect(membrane.geometry.getAttribute('normal')).toBeTruthy();
    const posts = ['a', 'b', 'd'].map(id => sail.getObjectByName(`shade-post-${id}`) as THREE.Mesh);
    expect(posts.every(Boolean)).toBe(true);
    const postBounds = new THREE.Box3().setFromObject(posts[0]);
    expect(postBounds.min.y).toBeCloseTo(0.5, 1);
    expect(postBounds.max.y).toBeGreaterThan(3.2 + 0.5);
    expect(sail.getObjectByName('shade-post-c')).toBeUndefined();
    expect(sail.getObjectByName('shade-bracket-c')).toBeTruthy();
    expect(sail.getObjectByName('shade-cable-sail')).toBeTruthy();
    expect(['a', 'b', 'c', 'd'].every(id => sail.getObjectByName(`shade-turnbuckle-${id}`))).toBe(true);
  });
  it('draws nothing for a disabled, empty or invalid model', () => {
    expect(shadeMeshes({ ...model, enabled: false }).children).toHaveLength(0);
    expect(shadeMeshes({ version: 1, enabled: true, sails: [] }).children).toHaveLength(0);
    expect(shadeMeshes({ ...model, sails: [{ ...model.sails[0], anchors: model.sails[0].anchors.slice(0, 2) }] }).children).toHaveLength(0);
    expect(shadeMeshes(undefined).children).toHaveLength(0);
  });
  it('leans every post away from the sail centre', () => {
    const group = shadeMeshes(model);
    const post = group.getObjectByName('shade-post-a') as THREE.Mesh;
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(post.quaternion);
    // Point a sits at the (0,0) corner: the post top must lean toward negative x and z.
    expect(up.x).toBeLessThan(0); expect(up.z).toBeLessThan(0); expect(up.y).toBeGreaterThan(0.98);
  });
});
