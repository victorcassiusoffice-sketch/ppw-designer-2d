import { describe, expect, it } from 'vitest';
import { architecturalMineralVariation, ARCHITECTURAL_MINERAL_REPEAT_M } from '../architecturalSurface';
import { planSurfacePatternScale } from '../planSurfaceTexture';

describe('unpriced architectural mineral presentation', () => {
  it('is seamless at the repeat boundaries, bounded and deterministic', () => {
    const values = new Set<number>();
    for (let y = 0; y <= 1; y += 0.05) {
      expect(architecturalMineralVariation(0, y)).toBeCloseTo(architecturalMineralVariation(1, y), 10);
      expect(architecturalMineralVariation(y, 0)).toBeCloseTo(architecturalMineralVariation(y, 1), 10);
      for (let x = 0; x <= 1; x += 0.05) {
        const value = architecturalMineralVariation(x, y);
        expect(value).toBe(architecturalMineralVariation(x, y));
        expect(Math.abs(value)).toBeLessThanOrEqual(1);
        values.add(value);
      }
    }
    expect(values.size).toBeGreaterThan(300);
  });
  it('uses a four-metre broad mineral repeat without changing paid floor texture scale', () => {
    expect(planSurfacePatternScale(100) * 512).toBe(100 * ARCHITECTURAL_MINERAL_REPEAT_M);
    expect(planSurfacePatternScale(100, 'rubber-tile') * 256).toBe(100);
    expect(planSurfacePatternScale(100, 'wood') * 256).toBe(100);
  });
});
