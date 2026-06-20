/**
 * Procedural 3D scene-graph builder (DESIGNER-EXPANSION P5). Pure — node env.
 *
 * Proves the P5 gate's "3D path builds a scene-graph node tree" condition.
 */
import { describe, it, expect } from 'vitest';
import { buildDomainScene } from '../scene3d';
import type { SceneNode } from '../scene3d';

function countNodes(n: SceneNode): number {
  return 1 + n.children.reduce((acc, c) => acc + countNodes(c), 0);
}

describe('buildDomainScene', () => {
  it('wellness-room has no 3D mirror (2D-only, unchanged)', () => {
    expect(buildDomainScene('wellness-room')).toBeNull();
  });

  it('car builds a turntable: body box + 4 wheel cylinders + orbit camera', () => {
    const scene = buildDomainScene('car');
    expect(scene).not.toBeNull();
    expect(scene!.mirror).toBe('turntable-3d');
    expect(scene!.camera.type).toBe('orbit');
    const wheels = scene!.root.children.filter((c) => c.kind === 'cylinder');
    expect(wheels).toHaveLength(4);
    expect(scene!.root.children.some((c) => c.kind === 'box')).toBe(true);
    expect(scene!.nodeCount).toBe(countNodes(scene!.root));
    expect(scene!.nodeCount).toBeGreaterThanOrEqual(6); // root + body + 4 wheels
  });

  it('airplane builds a cabin: fuselage tube + seat blocks + walk camera', () => {
    const scene = buildDomainScene('airplane');
    expect(scene).not.toBeNull();
    expect(scene!.mirror).toBe('cabin-3d');
    expect(scene!.camera.type).toBe('walk');
    expect(scene!.root.children.some((c) => c.kind === 'tube')).toBe(true);
    const seats = scene!.root.children.filter((c) => c.kind === 'box');
    expect(seats.length).toBeGreaterThan(0);
  });

  it('uses procedural primitives only (no imported mesh kinds)', () => {
    const allowed = new Set(['box', 'cylinder', 'tube', 'group']);
    for (const domain of ['car', 'airplane'] as const) {
      const scene = buildDomainScene(domain)!;
      const walk = (n: SceneNode): void => {
        expect(allowed.has(n.kind)).toBe(true);
        n.children.forEach(walk);
      };
      walk(scene.root);
    }
  });
});
