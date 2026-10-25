import { describe, expect, it } from 'vitest';
import { optionalShadingReady } from '../firstPicture';

describe('first picture before optional GPU work', () => {
  it('cannot start an AO trial while the first house picture is loading', () => {
    expect(optionalShadingReady(null, 20000, 0)).toBe(false);
    expect(optionalShadingReady(1000, 1499, 0)).toBe(false);
    expect(optionalShadingReady(1000, 1500, 0)).toBe(true);
  });
  it('waits for loaded product bodies, with a bound for failed downloads', () => {
    expect(optionalShadingReady(1000, 3000, 2)).toBe(false);
    expect(optionalShadingReady(1000, 3000, 0)).toBe(true);
    expect(optionalShadingReady(1000, 6000, 2)).toBe(true);
    expect(optionalShadingReady(1000, NaN, 0)).toBe(false);
  });
});
