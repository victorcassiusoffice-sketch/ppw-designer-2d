import { describe, expect, it } from 'vitest';
import { fitArchitecturalCamera } from '../architecturalCamera';
import { fitCamera, projectScene } from '../roomView3d';

describe('architectural first-entry fit', () => {
  it.each([{ width: 320, height: 740 }, { width: 390, height: 400 }, { width: 1440, height: 700 }, { width: 2400, height: 900 }])('fits every outer corner on a $width×$height viewport', (viewport) => {
    for (const height of [2.7, 6, 12]) {
      const bounds = { minX: -2, minY: -3, maxX: 12, maxY: 9 };
      const camera = fitArchitecturalCamera(bounds, height, viewport.width / viewport.height);
      const corners = [bounds.minX - 0.2, bounds.maxX + 0.2].flatMap(x => [bounds.minY - 0.2, bounds.maxY + 0.2].flatMap(y => [-0.18, height + 0.12].map(z => ({ x, y, z }))));
      const projected = projectScene([{ key: 'bounds', kind: 'item', pts: corners, fill: '#fff' }], camera, viewport)[0];
      expect(projected.pts).toHaveLength(8);
      for (const point of projected.pts) {
        expect(point.x).toBeGreaterThanOrEqual(viewport.width * 0.055);
        expect(point.x).toBeLessThanOrEqual(viewport.width * 0.945);
        expect(point.y).toBeGreaterThanOrEqual(viewport.height * 0.045);
        expect(point.y).toBeLessThanOrEqual(viewport.height * 0.955);
      }
      // At least one axis is used effectively; no floating postage-stamp house.
      const x = projected.pts.map(point => point.x), y = projected.pts.map(point => point.y);
      const coverage = Math.max((Math.max(...x) - Math.min(...x)) / viewport.width, (Math.max(...y) - Math.min(...y)) / viewport.height);
      expect(coverage).toBeGreaterThan(0.69);
    }
  });

  it('moves closer than the old sphere fit on desktop and reveals more of the interior', () => {
    const bounds = { minX: 0, minY: 0, maxX: 11.5, maxY: 8.5 };
    const old = fitCamera(bounds, 2.7, 1.8), current = fitArchitecturalCamera(bounds, 2.7, 1.8);
    expect(current.distanceM).toBeLessThan(old.distanceM * 0.92);
    expect(current.elevationRad).toBeGreaterThan(old.elevationRad);
    expect(current.target.x).toBe(old.target.x);
    expect(current.target.y).toBe(old.target.y);
    expect(current.target.z).toBeGreaterThanOrEqual(0);
    expect(current.target.z).toBeLessThanOrEqual(2.7);
    expect(current.fovRad).toBe(old.fovRad);
  });
});
