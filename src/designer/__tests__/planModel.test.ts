import { describe, expect, it } from 'vitest';
import type { Product } from '../../data/products.schema';
import { canRenderPlanModel, planModelKey, planModelRasterSize, planModelSolid } from '../planModel';

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
});
