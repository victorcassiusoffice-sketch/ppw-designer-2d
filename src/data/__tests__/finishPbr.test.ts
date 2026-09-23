import { describe, expect, it } from 'vitest';
import { FINISH_PBR, paintPbrOf } from '../wallPaints';

describe('paint finish PBR', () => {
  it('keeps the finish order the stage and the TintEX pitch rely on', () => {
    expect(FINISH_PBR.matt.sheen).toBe(0);
    expect(FINISH_PBR.silk.sheen).toBeGreaterThan(FINISH_PBR.matt.sheen);
    expect(FINISH_PBR.satin.sheen).toBeGreaterThan(FINISH_PBR.silk.sheen);
    expect(FINISH_PBR.gloss.sheen).toBeGreaterThan(FINISH_PBR.satin.sheen);
    expect(FINISH_PBR.matt.roughness).toBeGreaterThanOrEqual(0.9);
    expect(FINISH_PBR.satin.roughness).toBeLessThan(0.8);
    expect(FINISH_PBR.satin.roughness).toBeLessThan(FINISH_PBR.matt.roughness);
    expect(FINISH_PBR.gloss.roughness).toBeLessThan(FINISH_PBR.satin.roughness);
  });

  it('puts a clear film on sheened paint and none on matt or textured emulsion', () => {
    expect(FINISH_PBR.matt.clearcoat).toBe(0);
    expect(FINISH_PBR.textured.clearcoat).toBe(0);
    expect(FINISH_PBR.gloss.clearcoat).toBeGreaterThan(FINISH_PBR.satin.clearcoat);
    expect(FINISH_PBR.satin.clearcoat).toBeGreaterThan(FINISH_PBR.silk.clearcoat);
    expect(FINISH_PBR.silk.clearcoat).toBeGreaterThan(0);
    expect(FINISH_PBR.gloss.clearcoatRoughness).toBeLessThan(FINISH_PBR.satin.clearcoatRoughness);
    expect(FINISH_PBR.satin.clearcoatRoughness).toBeLessThan(FINISH_PBR.silk.clearcoatRoughness);
  });

  it('treats every finish as paint, not metal, and bare plaster as an unpainted wall', () => {
    expect(paintPbrOf('matt').metalness).toBe(0);
    for (const fin of Object.values(FINISH_PBR)) {
      expect(fin.stipple).toBeGreaterThan(0);
      expect(fin.roughness).toBeGreaterThan(0);
      expect(fin.roughness).toBeLessThanOrEqual(1);
    }
    expect(paintPbrOf(undefined)).toMatchObject({ metalness: 0, sheen: 0, clearcoat: 0, stipple: 0, roughness: 0.96 });
    expect(paintPbrOf('satin').metalness).toBe(0);
    expect(paintPbrOf('gloss').clearcoat).toBe(FINISH_PBR.gloss.clearcoat);
  });
});
