import { describe, expect, it } from 'vitest';
import { architecturalWallCap, architecturalWallShadow } from '../architecturalPlan';
import { constructionHex } from '../wallConstruction';
import { BUILD_SKINS } from '../../store/buildSkinStore';

describe('architectural presentation preserves real specification scale', () => {
  it('keeps explicit construction colours when the display skin changes', () => {
    for (const skin of BUILD_SKINS) for (const material of ['brick', 'concrete', 'glass', 'plastered-brick'] as const) {
      expect(architecturalWallCap(material, skin)).toBe(constructionHex(material));
    }
  });
  it('keeps soft shadow sizes in metres across plan pixel densities', () => {
    const normal = architecturalWallShadow(100), doubled = architecturalWallShadow(200);
    expect(doubled.blur).toBe(normal.blur * 2);
    expect(doubled.offsetX).toBe(normal.offsetX * 2);
    expect(doubled.offsetY).toBe(normal.offsetY * 2);
    expect(doubled.opacity).toBe(normal.opacity);
    expect(architecturalWallShadow(100, true).opacity).toBeLessThan(normal.opacity);
    expect(architecturalWallShadow(NaN)).toEqual(normal);
  });
});
