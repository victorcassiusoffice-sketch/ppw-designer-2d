import { describe, expect, it } from 'vitest';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { furnitureBox } from '../furnitureBox';
import { physicalFurnitureUVs } from '../furnitureSurface';
describe('measured furniture bevels', () => {
  it.each([1, 2] as const)(
    'matches all original positions, normals and measured UVs at detail %i',
    (segments) => {
      for (const [width, height, depth, radius] of [
        [0.025, 0.84, 0.06, 0.006],
        [1.5, 0.8, 0.72, 0.025],
        [0.02, 0.02, 0.02, 0.01],
      ]) {
        const original = new RoundedBoxGeometry(width, height, depth, segments, radius);
        physicalFurnitureUVs(original);
        const actual = furnitureBox(width, height, depth, segments, radius);
        for (const attr of ['position', 'normal', 'uv']) {
          const a = actual.getAttribute(attr).array,
            b = original.getAttribute(attr).array;
          expect(a.length).toBe(b.length);
          let difference = 0;
          for (let i = 0; i < a.length; i++)
            difference = Math.max(difference, Math.abs(a[i] - b[i]));
          expect(difference).toBeLessThan(0.000001);
        }
        actual.dispose();
        original.dispose();
      }
    },
  );
});
