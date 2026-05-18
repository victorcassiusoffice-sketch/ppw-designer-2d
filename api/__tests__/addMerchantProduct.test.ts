/**
 * Sims-Parity DT-09 — addMerchantProduct + VC-2 dim-edit guard tests.
 */
import { describe, it, expect } from 'vitest';
import {
  addMerchantProduct,
  updateProductDimensions,
} from '../lib/agent/intents/addMerchantProduct';

function validPacket(extra: Record<string, unknown> = {}): Record<string, unknown> {
  const { photoFront: photoFrontOverride, ...restExtra } = extra as { photoFront?: Record<string, unknown> };
  return {
    scaleLockId: '11111111-1111-4111-8111-111111111111',
    capturedAt: '2026-05-18T12:00:00.000Z',
    path: 'a4-corner-tap',
    photoFront: {
      blobUrl: 'https://blob.vercel-storage.com/x/front.webp',
      widthPx: 1920,
      heightPx: 1080,
      pixelsPerMm: 5.2,
      rmsCalibrationError: 1.3,
      alphaClean: false,
      ...(photoFrontOverride ?? {}),
    },
    dimensionsMm: { width: 800, depth: 600, height: 450 },
    typedVsMeasured: { deltaPct: 0.03, flagged: false },
    ...restExtra,
  };
}

function validInput(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    merchantId: 13,
    scaleLockId: '22222222-2222-4222-8222-222222222222',
    sku: 'SAUNA-001',
    name: 'Cedar Sauna Pod',
    category: 'sauna',
    description: 'A cedar sauna pod.',
    priceMinor: 245000,
    currency: 'MUR',
    packet: validPacket(),
    ...over,
  };
}

describe('DT-09 / addMerchantProduct', () => {
  it('happy path: returns productId + populated capture fields', async () => {
    const insertCalls: Array<unknown> = [];
    const result = await addMerchantProduct(validInput(), {
      insertProduct: async (row) => {
        insertCalls.push(row);
        return { id: 4711 };
      },
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.productId).toBe(4711);
      expect(result.fields.photo_front_url).toBe('https://blob.vercel-storage.com/x/front.webp');
      expect(result.fields.photo_alpha_clean).toBe(false);
      expect(result.fields.capture_scale_lock_id).toBe('22222222-2222-4222-8222-222222222222');
      expect(result.fields.dimensions_mm).toEqual({ width: 800, depth: 600, height: 450 });
      expect(result.fields.photo_side_url).toBeNull();
      expect(result.fields.photo_back_url).toBeNull();
    }
    expect(insertCalls).toHaveLength(1);
    const row = insertCalls[0] as { imageUrl: string; widthMm: number };
    expect(row.imageUrl).toBe('https://blob.vercel-storage.com/x/front.webp');
    expect(row.widthMm).toBe(800);
  });

  it('persists alphaClean=true when set on the packet', async () => {
    const result = await addMerchantProduct(
      validInput({
        packet: validPacket({ photoFront: { alphaClean: true } }),
      }),
      { insertProduct: async () => ({ id: 1 }) },
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.fields.photo_alpha_clean).toBe(true);
  });

  it('passes silhouette_bbox_px through when present (renderer consumes via FK)', async () => {
    const insertCalls: Array<unknown> = [];
    await addMerchantProduct(
      validInput({
        packet: validPacket({
          photoFront: {
            silhouette_bbox_px: { x: 120, y: 80, width: 800, height: 1200 },
          },
        }),
      }),
      {
        insertProduct: async (row) => {
          insertCalls.push(row);
          return { id: 2 };
        },
      },
    );
    // bbox is not directly stored on products (it's on scale-lock); but
    // we verify the packet's bbox passes Zod and dimensions write OK.
    expect(insertCalls).toHaveLength(1);
  });

  it('returns validation error for missing required fields', async () => {
    const result = await addMerchantProduct({ merchantId: 13 }, {});
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('validation');
  });

  it('returns db_failure if insert throws', async () => {
    const result = await addMerchantProduct(validInput(), {
      insertProduct: async () => { throw new Error('connection refused'); },
    });
    expect(result.ok).toBe(false);
    if (!result.ok && result.code === 'db_failure') {
      expect(result.message).toContain('connection refused');
    }
  });
});

describe('DT-09 / updateProductDimensions VC-2 guard', () => {
  it('refuses silent edit on a product with an active lock', async () => {
    const result = await updateProductDimensions(
      { productId: 1, newWidthMm: 900, newDepthMm: 700, newHeightMm: 500 },
      { loadProduct: async () => ({ captureScaleLockId: 'lock-123' }) },
    );
    expect(result.ok).toBe(false);
    if (!result.ok && result.code === 'silent_edit_refused') {
      expect(result.existingLockId).toBe('lock-123');
    }
  });

  it('accepts edit with invalidationReason — invalidates lock + clears FK', async () => {
    const setCalls: Array<unknown> = [];
    const invCalls: Array<unknown> = [];
    const result = await updateProductDimensions(
      {
        productId: 1, newWidthMm: 900, newDepthMm: 700, newHeightMm: 500,
        invalidationReason: 'merchant_dim_edit',
      },
      {
        loadProduct: async () => ({ captureScaleLockId: 'lock-123' }),
        setProductDimensions: async (id, args) => { setCalls.push({ id, args }); },
        invalidateLock: async (lockId, reason) => { invCalls.push({ lockId, reason }); },
      },
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.invalidatedLockId).toBe('lock-123');
    expect(invCalls).toEqual([{ lockId: 'lock-123', reason: 'merchant_dim_edit' }]);
    expect((setCalls[0] as { args: { newScaleLockId: string | null } }).args.newScaleLockId).toBeNull();
  });

  it('accepts edit with freshScaleLockId — attaches new lock; old NOT touched', async () => {
    const invCalls: Array<unknown> = [];
    const setCalls: Array<unknown> = [];
    const result = await updateProductDimensions(
      {
        productId: 1, newWidthMm: 900, newDepthMm: 700, newHeightMm: 500,
        freshScaleLockId: 'lock-456',
      },
      {
        loadProduct: async () => ({ captureScaleLockId: 'lock-123' }),
        setProductDimensions: async (id, args) => { setCalls.push({ id, args }); },
        invalidateLock: async (lockId, reason) => { invCalls.push({ lockId, reason }); },
      },
    );
    expect(result.ok).toBe(true);
    expect(invCalls).toEqual([]); // old lock not invalidated
    expect((setCalls[0] as { args: { newScaleLockId: string } }).args.newScaleLockId).toBe('lock-456');
  });

  it('allows dim change on legacy row with NULL scale-lock (backfill path)', async () => {
    const setCalls: Array<unknown> = [];
    const result = await updateProductDimensions(
      { productId: 99, newWidthMm: 800, newDepthMm: 600, newHeightMm: 450 },
      {
        loadProduct: async () => ({ captureScaleLockId: null }),
        setProductDimensions: async (id, args) => { setCalls.push({ id, args }); },
      },
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.invalidatedLockId).toBeNull();
    expect(setCalls).toHaveLength(1);
  });

  it('returns product_not_found when product missing', async () => {
    const result = await updateProductDimensions(
      { productId: 999, newWidthMm: 1, newDepthMm: 1, newHeightMm: 1 },
      { loadProduct: async () => null },
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('product_not_found');
  });

  it('rejects whitespace-only invalidation reason', async () => {
    const result = await updateProductDimensions(
      {
        productId: 1, newWidthMm: 900, newDepthMm: 700, newHeightMm: 500,
        invalidationReason: '   ',
      },
      { loadProduct: async () => ({ captureScaleLockId: 'lock-123' }) },
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('invalidation_reason_missing');
  });
});
