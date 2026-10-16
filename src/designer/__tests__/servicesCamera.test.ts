import { describe, expect, it } from 'vitest';
import { servicesFovForResize } from '../servicesCamera';

describe('services camera resize', () => {
  it('preserves projected pixel scale as a phone inspector opens and closes', () => {
    const initial = 42,
      fullHeight = 515,
      insetHeight = 243;
    const inset = servicesFovForResize(initial, fullHeight, insetHeight);
    const pixelsPerUnit = (height: number, fov: number) => height / Math.tan((fov * Math.PI) / 360);
    expect(pixelsPerUnit(insetHeight, inset)).toBeCloseTo(pixelsPerUnit(fullHeight, initial), 10);
    expect(servicesFovForResize(inset, insetHeight, fullHeight)).toBeCloseTo(initial, 10);
  });
  it('does not create an invalid projection on first measure, hidden canvas or invalid input', () => {
    for (const bad of [0, -1, NaN, Infinity]) {
      expect(servicesFovForResize(42, bad, 400)).toBe(42);
      expect(servicesFovForResize(42, 400, bad)).toBe(42);
    }
    expect(servicesFovForResize(NaN, 400, 400)).toBe(42);
  });
  it('bounds extreme projections while leaving identical sizes unchanged', () => {
    expect(servicesFovForResize(42, 10000, 1)).toBe(5);
    expect(servicesFovForResize(42, 1, 10000)).toBe(120);
    expect(servicesFovForResize(42, 400, 400)).toBeCloseTo(42);
  });
});
