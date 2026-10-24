import { describe, expect, it } from 'vitest';
import { normaliseRenderQuality, renderQualityProfile } from '../renderQuality';

describe('device-aware rendering preferences never select phone AO', () => {
  it('keeps Auto balanced instead of assuming CPU cores guarantee a high-end GPU', () => {
    expect(renderQualityProfile('auto', {width:1280,pixelRatio:2,logicalCores:16,memoryGb:16})).toEqual({
      level:'medium',phone:false,pixelRatio:1.5,shadowSize:2048,ambientOcclusion:false,anisotropy:4,
    });
  });
  it('limits a 390px phone even when High is manually selected and handles touch tablets', () => {
    const high = renderQualityProfile('high', {width:390,pixelRatio:3});
    expect(high).toMatchObject({level:'high',phone:true,shadowSize:1024,ambientOcclusion:false,pixelRatio:2});
    expect(renderQualityProfile('high', {width:900,pixelRatio:2,coarsePointer:true}).ambientOcclusion).toBe(false);
    expect(renderQualityProfile('high', {width:1280,pixelRatio:1}).ambientOcclusion).toBe(true);
  });
  it('uses a lighter auto profile for known low-memory/core devices and sanitises saved choices', () => {
    expect(renderQualityProfile('auto', {width:1280,pixelRatio:3,memoryGb:2}).level).toBe('low');
    expect(renderQualityProfile('auto', {width:1280,pixelRatio:3,logicalCores:2}).pixelRatio).toBe(1);
    expect(renderQualityProfile('medium', {width:NaN,pixelRatio:NaN})).toMatchObject({phone:true,pixelRatio:1});
    expect(normaliseRenderQuality('ultra')).toBe('auto');
    expect(normaliseRenderQuality(null)).toBe('auto');
    expect(normaliseRenderQuality('high')).toBe('high');
  });
});
