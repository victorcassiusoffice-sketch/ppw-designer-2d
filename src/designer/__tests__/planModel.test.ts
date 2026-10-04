import { describe, expect, it } from 'vitest';
import type { Product } from '../../data/products.schema';
import { canRenderPlanModel, planModelKey, planModelRasterSize, planModelSolid, planPhotoLightBalance, planModelShadowFrame, planModelShadowKey } from '../planModel';

const product = { id: 'courts-marco-sofa-corner', sku: 'SOFA', dimensions_cm: { length: 260, width: 102, height: 110 }, front_edge: 'left' } as Product;

describe('orthographic product presentation preserves catalog truth', () => {
  it('keeps an asymmetric product at its exact unrotated metre envelope', () => {
    const before = JSON.stringify(product);
    const solid = planModelSolid(product);
    expect([solid.x0, solid.y0, solid.z0, solid.x1, solid.y1, solid.z1]).toEqual([0, 0, 0, 2.6, 1.02, 1.1]);
    expect([solid.lengthM, solid.widthM, solid.heightM, solid.rotationDeg, solid.frontEdge]).toEqual([2.6, 1.02, 1.1, 0, 'left']);
    expect(JSON.stringify(product)).toBe(before);
  });
  it('invalidates stale images after a merchant corrects a size or front edge', () => {
    expect(planModelKey(product)).not.toBe(planModelKey({ ...product, dimensions_cm: { ...product.dimensions_cm, width: 110 } }));
    expect(planModelKey(product)).not.toBe(planModelKey({ ...product, front_edge: 'bottom' }));
  });
  it('uses authoritative top-down art before any dimensional preview', () => {
    expect(canRenderPlanModel(product)).toBe(true);
    expect(canRenderPlanModel({ ...product, topdown_image_url: '/verified-sofa.png' })).toBe(false);
    expect(canRenderPlanModel({ ...product, id: 'unknown-product' })).toBe(false);
    expect(canRenderPlanModel({ ...product, dimensions_cm: { ...product.dimensions_cm, length: NaN } })).toBe(false);
  });
  it('preserves landscape and portrait resolution ratios without changing physical size', () => {
    expect(planModelRasterSize(2, 1)).toEqual({ width: 512, height: 256 });
    expect(planModelRasterSize(1, 2)).toEqual({ width: 256, height: 512 });
  });
  it('adds shape-defining direction without altering upward-facing colour exposure', () => {
    const rig = { hemi: 0.72, sun: 0.25, fill: 0.25 };
    const direction = [-0.45, 1, -0.55] as const;
    const balanced = planPhotoLightBalance(rig, direction);
    const incidence = direction[1] / Math.hypot(...direction);
    expect(balanced.hemi + balanced.sun * incidence).toBeCloseTo(rig.hemi + rig.sun * incidence, 12);
    expect(balanced.hemi).toBeLessThan(rig.hemi);
    expect(balanced.fill).toBe(rig.fill);
    expect(planPhotoLightBalance(rig, [0, 0, 0])).toEqual(rig);
  });
  it('frames a rotated product shadow independently of the measured item envelope', () => {
    const before = JSON.stringify(product);
    const direction = { x: -0.45, y: 0.55 };
    const frame = planModelShadowFrame(product, 90, direction);
    expect(frame.itemWidthM).toBeCloseTo(1.02);
    expect(frame.itemDepthM).toBeCloseTo(2.6);
    expect(frame.xM).toBeCloseTo(-1.1 * 0.45 - 0.08);
    expect(frame.yM).toBeCloseTo(-0.08);
    expect(frame.xM + frame.widthM).toBeCloseTo(frame.itemWidthM + 0.08);
    expect(frame.yM + frame.depthM).toBeCloseTo(frame.itemDepthM + 1.1 * 0.55 + 0.08);
    expect(JSON.stringify(product)).toBe(before);
  });
  it('shares equivalent orientation shadows but invalidates when direction or orientation changes', () => {
    const direction = { x: 0.45, y: 0.55 };
    expect(planModelShadowKey(product, -90, direction)).toBe(planModelShadowKey(product, 270, direction));
    expect(planModelShadowKey(product, 0, direction)).not.toBe(planModelShadowKey(product, 90, direction));
    expect(planModelShadowKey(product, 0, direction)).not.toBe(planModelShadowKey(product, 0, { x: -0.45, y: 0.55 }));
  });
});
