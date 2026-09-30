import { describe, expect, it } from 'vitest';
import { lampSceneFactor, lightPreviewProfile, lightRadiusM, lampsOnFactor, planLightGradientStops } from '../lighting';
import { sunAt } from '../sunPosition';

const lamp = { name: 'Table lamp', category: 'lighting' as const, light_radius_m: 1.8 };

describe('shared Plan / 3D lighting preview calibration', () => {
  it('matches horizontal floor reach even when a pendant source is above the floor', () => {
    for (const height of [0.3, 1.5, 2.7, 5]) {
      const profile = lightPreviewProfile(lamp, height);
      expect(Math.sqrt(profile.rangeM ** 2 - height ** 2)).toBeCloseTo(lightRadiusM(lamp), 8);
      expect(profile.decay).toBe(2);
      expect(profile.colorHex).toBe('#ffd9a3');
    }
  });

  it('preserves paint in daylight and matches the same sunset transition in both views', () => {
    expect(lampSceneFactor(null)).toBe(0);
    expect(lampSceneFactor(Number.NaN)).toBe(0);
    expect(lampSceneFactor(12, 180)).toBe(0);
    expect(lampSceneFactor(0, 180)).toBe(1);
    for (const hour of [6, 7, 17, 18, 19]) {
      expect(lampSceneFactor(hour, 180)).toBe(lampsOnFactor(sunAt(hour, 180).elevationDeg));
    }
    expect(planLightGradientStops()).toEqual([0, 'rgba(255,217,163,0.42)', 0.55, 'rgba(255,217,163,0.22)', 1, 'rgba(255,217,163,0)']);
  });

  it('does not propagate incomplete supplier dimensions into NaN lights', () => {
    const invalid = { ...lamp, light_radius_m: undefined,
      dimensions_cm: { length: Number.NaN, width: -10, height: 20 } };
    expect(lightRadiusM(invalid)).toBe(1.2);
    expect(Number.isFinite(lightPreviewProfile(invalid, Number.NaN).rangeM)).toBe(true);
  });
});
