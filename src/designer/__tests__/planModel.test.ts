import { describe, expect, it, vi } from 'vitest';
import type { Product } from '../../data/products.schema';
import * as models from '../../data/productModels';
import { canRenderPlanModel, hasRasterPlanAsset, planModelKey, planModelRasterSize, planModelSolid, planPhotoLightBalance, planModelShadowFrame, planModelShadowKey } from '../planModel';

const product = { id: 'courts-marco-sofa-corner', sku: 'SOFA', dimensions_cm: { length: 260, width: 102, height: 110 }, front_edge: 'left' } as Product;

describe('orthographic product presentation preserves catalog truth', () => {
  it('distinguishes a wall basin overhead from a wall mirror photo or schematic', () => {
    expect(hasRasterPlanAsset({ topdown_image_url: '/products/topdown/espace-durastyle-washbasin-800.png' })).toBe(true);
    expect(hasRasterPlanAsset({ topdown_image_url: 'https://supplier.example/basin-overhead?id=42' })).toBe(true);
    expect(hasRasterPlanAsset({ topdown_image_url: 'data:image/webp;base64,AAAA' })).toBe(true);
    expect(hasRasterPlanAsset({ topdown_image_url: '/mirror-symbol.svg?revision=1' })).toBe(false);
    expect(hasRasterPlanAsset({ topdown_image_url: 'data:image/svg+xml;utf8,%3Csvg%3E' })).toBe(false);
    expect(hasRasterPlanAsset({ topdown_image_url: '   ' })).toBe(false);
    const mirror = { ...product, photo_image_url: '/products/photos/mirror-front.jpg' };
    expect(hasRasterPlanAsset(mirror)).toBe(false);
  });
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
    expect(canRenderPlanModel({ ...product, topdown_image_url: 'https://supplier.example/overhead?id=42' })).toBe(false);
    expect(canRenderPlanModel({ ...product, topdown_image_url: 'data:image/png;base64,AAAA' })).toBe(false);
    expect(canRenderPlanModel({ ...product, topdown_image_url: '/legacy-sofa.svg?v=2' })).toBe(true);
    expect(canRenderPlanModel({ ...product, topdown_image_url: 'data:image/svg+xml;utf8,%3Csvg%3E' })).toBe(true);
    expect(canRenderPlanModel({ ...product, id: 'unknown-product' })).toBe(false);
    expect(canRenderPlanModel({ ...product, dimensions_cm: { ...product.dimensions_cm, length: NaN } })).toBe(false);
  });
  it('fits imported meshes to the same catalogue envelope and preserves their axis metadata', () => {
    const entry: models.ProductModelEntry = { url: '/models/reviewed-basin.glb', modelFront: '-x', lengthAxis: 'z', modelUp: '-z', preferMesh: true };
    const model = vi.spyOn(models, 'productModelFor').mockReturnValue(entry);
    try {
      const basin = { ...product, id: 'supplier-basin', dimensions_cm: { length: 80, width: 47, height: 17 } };
      expect(canRenderPlanModel(basin)).toBe(true);
      const solid = planModelSolid(basin);
      expect([solid.x0, solid.y0, solid.z0, solid.x1, solid.y1, solid.z1]).toEqual([0, 0, 0, .8, .47, .17]);
      expect(solid).toMatchObject({ meshUrl: entry.url, modelFront: '-x', lengthAxis: 'z', modelUp: '-z', preferMesh: true, rotationDeg: 0 });
      const first = planModelKey(basin);
      for (const change of [{ url: '/models/reviewed-basin-v2.glb' }, { modelFront: '+z' as const }, { lengthAxis: 'x' as const }, { modelUp: '+y' as const }, { preferMesh: false }]) {
        model.mockReturnValue({ ...entry, ...change });
        expect(planModelKey(basin)).not.toBe(first);
      }
      model.mockReturnValue(entry);
      expect(planModelKey({ ...basin, topdown_image_url: '/verified-basin-topdown.webp' })).not.toBe(first);
      expect(canRenderPlanModel({ ...basin, topdown_image_url: '/verified-basin-topdown.webp' })).toBe(false);
    } finally { model.mockRestore(); }
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
