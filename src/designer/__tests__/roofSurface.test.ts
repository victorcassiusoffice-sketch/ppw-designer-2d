import { describe, expect, it } from 'vitest';
import { createRoofSurface, roofHeightAt, roofItemMount, roofMaximumHeight } from '../roofSurface';
import type { RoofConfig } from '../building';

const polygon = [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 8 }, { x: 0, y: 8 }];
const config: RoofConfig = { style: 'gable', material: 'felt', pitchDeg: 30, overhangM: 0.2 };
describe('shared roof surface', () => {
  it('includes actual covering thickness, overhang and pitch without changing the plan', () => {
    const before = JSON.stringify(polygon);
    const surface = createRoofSurface(polygon, 6, config)!;
    expect(surface.axis).toBe('x');
    expect(roofHeightAt(surface, { x: 2, y: 3 })).toBeCloseTo(6.08 + 2.2 * Math.tan(Math.PI / 6));
    expect(roofHeightAt(surface, { x: -0.2, y: 3 })).toBeCloseTo(6.08);
    expect(roofMaximumHeight(surface)).toBeCloseTo(roofHeightAt(surface, { x: 2, y: 1 }));
    expect(JSON.stringify(polygon)).toBe(before);
  });
  it('tilts opposite faces in opposite directions and raises a ridge-spanning rigid panel', () => {
    const surface = createRoofSurface(polygon, 6, config)!;
    expect(roofItemMount(surface, { x0: 0.2, x1: 1.8, y0: 1, y1: 2 }).slopeX).toBeGreaterThan(0);
    expect(roofItemMount(surface, { x0: 2.2, x1: 3.8, y0: 1, y1: 2 }).slopeX).toBeLessThan(0);
    const ridge = roofItemMount(surface, { x0: 1.2, x1: 2.8, y0: 1, y1: 2 });
    expect(ridge).toMatchObject({ bridgesRidge: true, slopeX: 0, slopeY: 0 });
    expect(ridge.elevationM).toBeGreaterThan(roofMaximumHeight(surface));
  });
  it('supports the other pitch axis, shed roofs and flat felt', () => {
    const turned = polygon.map(({ x, y }) => ({ x: y, y: x }));
    const shed = createRoofSurface(turned, 3, { ...config, style: 'shed' })!;
    expect(shed.axis).toBe('y');
    expect(roofItemMount(shed, { x0: 1, x1: 3, y0: 1, y1: 2 })).toMatchObject({ slopeX: 0, bridgesRidge: false });
    expect(roofHeightAt(shed, { x: 2, y: 3 })).toBeGreaterThan(roofHeightAt(shed, { x: 2, y: 1 }));
    const flat = createRoofSurface(polygon, 3, { ...config, style: 'flat' })!;
    expect(roofMaximumHeight(flat)).toBeCloseTo(3.08);
    expect(roofItemMount(flat, { x0: 1, x1: 3, y0: 1, y1: 2 })).toMatchObject({ slopeX: 0, slopeY: 0, bridgesRidge: false });
  });
});
