/**
 * Sims-Parity DT-01 — Zod fixture-parse tests.
 *
 * Exit criterion (MASTER-BUILD-PLAN.md §2 DT-01):
 *   • Zod parses fixture packet (with + without bbox).
 *   • ProductSchema accepts photo_alpha_clean + capture_scale_lock_id.
 *
 * Bound checks on pixelsPerMm / rmsCalibrationError live server-side in
 * DT-04 (calibrate handler); Zod-only invariants here are presence +
 * shape + UUID format.
 */
import { describe, it, expect } from 'vitest';
import {
  CapturePacketSchema,
  SilhouetteBboxPxSchema,
  type CapturePacket,
} from '../types';
import { ProductSchema } from '../../types/product';

const baseFront = {
  blobUrl: 'https://blob.vercel-storage.com/capture/front.webp',
  widthPx: 1920,
  heightPx: 1080,
  pixelsPerMm: 5.2,
  rmsCalibrationError: 1.3,
  alphaClean: false,
};

function fixture(opts: { withBbox: boolean }): unknown {
  return {
    scaleLockId: '11111111-1111-4111-8111-111111111111',
    capturedAt: '2026-05-18T12:34:56.000Z',
    path: 'a4-corner-tap' as const,
    photoFront: opts.withBbox
      ? {
          ...baseFront,
          silhouette_bbox_px: { x: 120, y: 80, width: 800, height: 1200 },
        }
      : { ...baseFront },
    dimensionsMm: { width: 800, depth: 600, height: 450 },
    typedVsMeasured: { deltaPct: 0.03, flagged: false },
  };
}

describe('DT-01 / CapturePacketSchema', () => {
  it('parses a fixture with silhouette_bbox_px present (v2 path)', () => {
    const parsed = CapturePacketSchema.parse(fixture({ withBbox: true }));
    expect(parsed.photoFront.silhouette_bbox_px).toEqual({
      x: 120,
      y: 80,
      width: 800,
      height: 1200,
    });
  });

  it('parses a fixture without silhouette_bbox_px (v1 corner-tap fallback)', () => {
    const parsed = CapturePacketSchema.parse(fixture({ withBbox: false }));
    expect(parsed.photoFront.silhouette_bbox_px).toBeUndefined();
    // alphaClean default is false; v1 corner-tap always emits false.
    expect(parsed.photoFront.alphaClean).toBe(false);
  });

  it('defaults alphaClean to false when omitted', () => {
    const fx = fixture({ withBbox: false }) as Record<string, unknown>;
    const front = { ...baseFront } as Record<string, unknown>;
    delete front.alphaClean;
    (fx.photoFront as unknown) = front;
    const parsed = CapturePacketSchema.parse(fx);
    expect(parsed.photoFront.alphaClean).toBe(false);
  });

  it('rejects a packet with non-UUID scaleLockId', () => {
    const fx = fixture({ withBbox: false }) as Record<string, unknown>;
    fx.scaleLockId = 'not-a-uuid';
    expect(() => CapturePacketSchema.parse(fx)).toThrow();
  });

  it('rejects a packet with negative bbox.x', () => {
    expect(() =>
      SilhouetteBboxPxSchema.parse({ x: -1, y: 0, width: 10, height: 10 }),
    ).toThrow();
  });

  it('rejects a packet with dimensions_mm.width > 5000', () => {
    const fx = fixture({ withBbox: false }) as { dimensionsMm: { width: number } };
    fx.dimensionsMm.width = 6000;
    expect(() => CapturePacketSchema.parse(fx)).toThrow();
  });

  it('accepts the three valid path enum values', () => {
    for (const path of ['a4-corner-tap', 'aruco', 'webxr-plane'] as const) {
      const fx = fixture({ withBbox: false }) as CapturePacket;
      fx.path = path;
      expect(() => CapturePacketSchema.parse(fx)).not.toThrow();
    }
  });
});

describe('DT-01 / ProductSchema', () => {
  const baseProduct = {
    id: '22222222-2222-4222-8222-222222222222',
    merchant_id: '33333333-3333-4333-8333-333333333333',
    slug: 'massage-table-pro',
    name: 'Massage Table Pro',
    description: 'A professional massage table.',
    price_mur: 12500,
    category: 'massage' as const,
    photo_front_url: 'https://blob.vercel-storage.com/products/massage/front.webp',
    dimensions_mm: { width: 1850, depth: 700, height: 750 },
    photo_alpha_clean: true,
    capture_scale_lock_id: '44444444-4444-4444-8444-444444444444',
    variants: [],
    created_at: '2026-05-18T00:00:00.000Z',
    updated_at: '2026-05-18T00:00:00.000Z',
  };

  it('accepts a product carrying photo_alpha_clean=true + capture_scale_lock_id', () => {
    const parsed = ProductSchema.parse(baseProduct);
    expect(parsed.photo_alpha_clean).toBe(true);
    expect(parsed.capture_scale_lock_id).toBe(
      '44444444-4444-4444-8444-444444444444',
    );
  });

  it('defaults photo_alpha_clean to false when omitted (legacy row)', () => {
    const fx = { ...baseProduct } as Partial<typeof baseProduct>;
    delete fx.photo_alpha_clean;
    delete fx.capture_scale_lock_id;
    const parsed = ProductSchema.parse(fx);
    expect(parsed.photo_alpha_clean).toBe(false);
    expect(parsed.capture_scale_lock_id).toBeUndefined();
  });

  it('rejects a product with non-UUID capture_scale_lock_id', () => {
    const fx = { ...baseProduct, capture_scale_lock_id: 'not-a-uuid' };
    expect(() => ProductSchema.parse(fx)).toThrow();
  });
});
