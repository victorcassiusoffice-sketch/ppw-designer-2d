/**
 * Sims-Parity DT-09 — M9.B.1 add_product intent (capture-aware path).
 *
 * Consumes the accepted `CapturePacket` + minted `scaleLockId` from
 * `/capture/calibrate` (DT-04) and inserts a `products` row that
 * carries:
 *   • photo_front_url  ← packet.photoFront.blobUrl
 *   • photo_side_url   ← packet.photoSide?.blobUrl (optional)
 *   • photo_back_url   ← packet.photoBack?.blobUrl (optional)
 *   • dimensions_mm    ← widthMm / depthMm / heightMm columns
 *   • photo_alpha_clean ← packet.photoFront.alphaClean
 *   • capture_scale_lock_id ← FK to the freshly minted lock
 *
 * Also exposes `updateProductDimensions()` — VC-2 dim-edit guard.
 * Silently changing `dimensions_mm` on a product that already has a
 * scale-lock is refused; the merchant must either re-capture (mint
 * a fresh lock) or explicitly invalidate the existing one.
 */

import { z } from 'zod';
import { eq } from 'drizzle-orm';
import {
  CapturePacketSchema,
  type CapturePacket,
} from '../../../../src/lib/capture/types.js';
import { getDb } from '../../../db/client.js';
import {
  products,
  productCaptureScaleLocks,
} from '../../../db/schema.js';

export const AddMerchantProductInputSchema = z.object({
  merchantId: z.number().int().positive(),
  scaleLockId: z.string().uuid(),
  sku: z.string().min(1).max(80),
  name: z.string().min(2).max(200),
  category: z.string().min(1).max(80),
  description: z.string().max(2000).optional(),
  priceMinor: z.number().int().nonnegative(),
  currency: z.string().length(3),
  packet: CapturePacketSchema,
});
export type AddMerchantProductInput = z.infer<typeof AddMerchantProductInputSchema>;

export type AddMerchantProductError =
  | { ok: false; code: 'validation'; issues: unknown }
  | { ok: false; code: 'db_failure'; message: string };

export interface AddMerchantProductSuccess {
  ok: true;
  productId: number;
  scaleLockId: string;
  fields: {
    photo_front_url: string;
    photo_side_url: string | null;
    photo_back_url: string | null;
    photo_alpha_clean: boolean;
    capture_scale_lock_id: string;
    dimensions_mm: { width: number; depth: number; height: number };
  };
}

export interface AddMerchantProductDeps {
  /** Override for tests — defaults to drizzle round-trip. */
  insertProduct?: (row: ProductInsertRow) => Promise<{ id: number }>;
}

export interface ProductInsertRow {
  merchantId: number;
  sku: string;
  name: string;
  category: string;
  description: string | null;
  priceMinor: number;
  currency: string;
  imageUrl: string;
  widthMm: number;
  depthMm: number;
  heightMm: number;
  photoAlphaClean: boolean;
  captureScaleLockId: string;
}

export async function addMerchantProduct(
  input: unknown,
  deps: AddMerchantProductDeps = {},
): Promise<AddMerchantProductSuccess | AddMerchantProductError> {
  const parsed = AddMerchantProductInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, code: 'validation', issues: parsed.error.issues };
  }
  const v = parsed.data;
  const packet: CapturePacket = v.packet;

  const insertRow: ProductInsertRow = {
    merchantId: v.merchantId,
    sku: v.sku,
    name: v.name,
    category: v.category,
    description: v.description ?? null,
    priceMinor: v.priceMinor,
    currency: v.currency,
    imageUrl: packet.photoFront.blobUrl,
    widthMm: packet.dimensionsMm.width,
    depthMm: packet.dimensionsMm.depth,
    heightMm: packet.dimensionsMm.height,
    photoAlphaClean: packet.photoFront.alphaClean,
    captureScaleLockId: v.scaleLockId,
  };

  try {
    const result = deps.insertProduct
      ? await deps.insertProduct(insertRow)
      : await defaultInsertProduct(insertRow);
    return {
      ok: true,
      productId: result.id,
      scaleLockId: v.scaleLockId,
      fields: {
        photo_front_url: packet.photoFront.blobUrl,
        photo_side_url: packet.photoSide?.blobUrl ?? null,
        photo_back_url: packet.photoBack?.blobUrl ?? null,
        photo_alpha_clean: packet.photoFront.alphaClean,
        capture_scale_lock_id: v.scaleLockId,
        dimensions_mm: packet.dimensionsMm,
      },
    };
  } catch (err) {
    return {
      ok: false,
      code: 'db_failure',
      message: err instanceof Error ? err.message : 'insert failed',
    };
  }
}

async function defaultInsertProduct(row: ProductInsertRow): Promise<{ id: number }> {
  const db = getDb();
  const inserted = await db
    .insert(products)
    .values({
      merchantId: row.merchantId,
      sku: row.sku,
      name: row.name,
      category: row.category,
      description: row.description ?? undefined,
      priceMinor: row.priceMinor,
      currency: row.currency,
      imageUrl: row.imageUrl,
      widthMm: row.widthMm,
      depthMm: row.depthMm,
      heightMm: row.heightMm,
      photoAlphaClean: row.photoAlphaClean,
      captureScaleLockId: row.captureScaleLockId,
    })
    .returning({ id: products.id });
  const first = inserted[0];
  if (!first) throw new Error('insert returned zero rows');
  return { id: first.id };
}

// ─────────────────────────────────────────────────────────────────────
// VC-2 dim-edit guard
// ─────────────────────────────────────────────────────────────────────

export type UpdateProductDimensionsError =
  | { ok: false; code: 'product_not_found' }
  | { ok: false; code: 'silent_edit_refused'; existingLockId: string }
  | { ok: false; code: 'invalidation_reason_missing' };

export interface UpdateProductDimensionsArgs {
  productId: number;
  newWidthMm: number;
  newDepthMm: number;
  newHeightMm: number;
  /** REQUIRED when overriding an existing scale-lock — sets invalidated_at + reason. */
  invalidationReason?: string;
  /** Optional: if provided, attaches a fresh lock instead of invalidating. */
  freshScaleLockId?: string;
}

export interface UpdateProductDimensionsDeps {
  loadProduct?: (productId: number) => Promise<{ captureScaleLockId: string | null } | null>;
  setProductDimensions?: (
    productId: number,
    args: {
      widthMm: number;
      depthMm: number;
      heightMm: number;
      newScaleLockId?: string | null;
    },
  ) => Promise<void>;
  invalidateLock?: (lockId: string, reason: string) => Promise<void>;
}

/**
 * Pure VC-2 dim-edit guard core. Refuses silent dim changes that
 * would orphan the scale-lock; mandates either a fresh lock or an
 * explicit invalidation reason.
 */
export async function updateProductDimensions(
  args: UpdateProductDimensionsArgs,
  deps: UpdateProductDimensionsDeps = {},
): Promise<{ ok: true; invalidatedLockId: string | null } | UpdateProductDimensionsError> {
  const load = deps.loadProduct ?? defaultLoadProduct;
  const current = await load(args.productId);
  if (!current) {
    return { ok: false, code: 'product_not_found' };
  }
  const existingLockId = current.captureScaleLockId;

  // No lock on the product → free to set dims (legacy backfill path).
  if (!existingLockId) {
    const setDims = deps.setProductDimensions ?? defaultSetProductDimensions;
    await setDims(args.productId, {
      widthMm: args.newWidthMm,
      depthMm: args.newDepthMm,
      heightMm: args.newHeightMm,
      newScaleLockId: args.freshScaleLockId ?? null,
    });
    return { ok: true, invalidatedLockId: null };
  }

  // Has lock + fresh lock minted → attach the new one; old stays untouched.
  if (args.freshScaleLockId) {
    const setDims = deps.setProductDimensions ?? defaultSetProductDimensions;
    await setDims(args.productId, {
      widthMm: args.newWidthMm,
      depthMm: args.newDepthMm,
      heightMm: args.newHeightMm,
      newScaleLockId: args.freshScaleLockId,
    });
    return { ok: true, invalidatedLockId: null };
  }

  // Has lock + invalidation reason → invalidate the old + set dims.
  if (args.invalidationReason) {
    if (args.invalidationReason.trim().length === 0) {
      return { ok: false, code: 'invalidation_reason_missing' };
    }
    const inv = deps.invalidateLock ?? defaultInvalidateLock;
    const setDims = deps.setProductDimensions ?? defaultSetProductDimensions;
    await inv(existingLockId, args.invalidationReason.trim());
    await setDims(args.productId, {
      widthMm: args.newWidthMm,
      depthMm: args.newDepthMm,
      heightMm: args.newHeightMm,
      newScaleLockId: null, // cleared until re-capture
    });
    return { ok: true, invalidatedLockId: existingLockId };
  }

  // Silent edit attempt — refuse.
  return { ok: false, code: 'silent_edit_refused', existingLockId };
}

async function defaultLoadProduct(productId: number): Promise<{ captureScaleLockId: string | null } | null> {
  const db = getDb();
  const rows = await db
    .select({ captureScaleLockId: products.captureScaleLockId })
    .from(products)
    .where(eq(products.id, productId))
    .limit(1);
  if (rows.length === 0) return null;
  return { captureScaleLockId: rows[0].captureScaleLockId };
}

async function defaultSetProductDimensions(
  productId: number,
  args: { widthMm: number; depthMm: number; heightMm: number; newScaleLockId?: string | null },
): Promise<void> {
  const db = getDb();
  await db
    .update(products)
    .set({
      widthMm: args.widthMm,
      depthMm: args.depthMm,
      heightMm: args.heightMm,
      captureScaleLockId: args.newScaleLockId ?? null,
      updatedAt: new Date(),
    })
    .where(eq(products.id, productId));
}

async function defaultInvalidateLock(lockId: string, reason: string): Promise<void> {
  const db = getDb();
  await db
    .update(productCaptureScaleLocks)
    .set({ invalidatedAt: new Date(), invalidationReason: reason })
    .where(eq(productCaptureScaleLocks.scaleLockId, lockId));
}
