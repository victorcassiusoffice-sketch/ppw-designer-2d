/**
 * V4 W0.D.9 — supplier_rating incremental backfill cron handler.
 *
 * Selects products whose supplier_rating watermark is stale (NULL or older
 * than 7 days), JOINs merchants for the rating signal, recomputes the
 * rating from `merchants.status`, and UPDATEs in rating-grouped batches
 * to keep the per-tick wall-clock under the 60s Vercel Hobby budget.
 *
 * Folds into the existing cron-router (no new Vercel function). Once
 * W0.D.8 lands the unified daily dispatcher, this handler will run at
 * 05:10 UTC inside the single `0 5 * * *` invocation. Until then it's
 * callable manually via `GET /api/cron/refresh-supplier-rating?key=<CRON_SECRET>`.
 *
 * Algorithm v1: deterministic mapping from `merchants.status` →
 * supplier_rating (1-5 or NULL). The richer signal (order_items
 * completion rate per merchant) needs >=10 paid orders per merchant
 * to be statistically meaningful — that volume is months away; v1
 * baseline gives the catalog filter index something to sort on now.
 */

import { and, eq, inArray, isNull, lt, or, sql } from 'drizzle-orm';

import { getDb, schema } from '../../db/client.js';

export const BACKFILL_LIMIT = 1000;
export const REFRESH_INTERVAL_DAYS = 7;

export type MerchantStatus = typeof schema.merchantStatusEnum.enumValues[number];

/**
 * v1 deterministic rating from merchant lifecycle state.
 *
 *   approved                 → 3 (mid-bar baseline; meets KYC + Vic-Y)
 *   kyc_complete             → 2 (KYC done, awaiting Vic-Y)
 *   pending_admin_approval   → 2 (webhook flipped; same signal as kyc_complete)
 *   awaiting_kyc             → 1 (account opened, KYC pending)
 *   pending_signup / rejected / suspended → NULL (no positive signal)
 *
 * Returns NULL for any unknown enum value (future-proofs against
 * status additions that haven't yet been classified).
 */
export function computeRatingForMerchantStatus(status: MerchantStatus): number | null {
  switch (status) {
    case 'approved':
      return 3;
    case 'kyc_complete':
    case 'pending_admin_approval':
      return 2;
    case 'awaiting_kyc':
      return 1;
    case 'pending_signup':
    case 'rejected':
    case 'suspended':
      return null;
    default:
      return null;
  }
}

export interface BackfillResult {
  scanned: number;
  updated: number;
  errors: number;
  /** Sample of the first 5 product IDs that updated (for audit forensics). */
  sampleProductIds: number[];
}

export async function refreshSupplierRatingBatch(): Promise<BackfillResult> {
  const db = getDb();

  const stale = await db
    .select({
      productId: schema.products.id,
      merchantStatus: schema.merchants.status,
    })
    .from(schema.products)
    .innerJoin(schema.merchants, eq(schema.products.merchantId, schema.merchants.id))
    .where(
      and(
        isNull(schema.products.retiredAt),
        or(
          isNull(schema.products.supplierRatingRefreshedAt),
          lt(
            schema.products.supplierRatingRefreshedAt,
            sql`now() - interval '${sql.raw(String(REFRESH_INTERVAL_DAYS))} days'`,
          ),
        ),
      ),
    )
    .orderBy(sql`supplier_rating_refreshed_at NULLS FIRST`)
    .limit(BACKFILL_LIMIT);

  if (stale.length === 0) {
    return { scanned: 0, updated: 0, errors: 0, sampleProductIds: [] };
  }

  // Group product IDs by computed rating so we issue ONE UPDATE per
  // distinct rating value (typically 4: 3 / 2 / 1 / NULL). Cuts the
  // round-trip count from N (per-row) to ~4 regardless of batch size.
  const byRating = new Map<number | null, number[]>();
  for (const row of stale) {
    const rating = computeRatingForMerchantStatus(row.merchantStatus);
    const arr = byRating.get(rating) ?? [];
    arr.push(Number(row.productId));
    byRating.set(rating, arr);
  }

  let updated = 0;
  let errors = 0;
  const sample: number[] = [];
  const now = new Date();
  for (const [rating, ids] of byRating.entries()) {
    if (ids.length === 0) continue;
    try {
      await db
        .update(schema.products)
        .set({ supplierRating: rating, supplierRatingRefreshedAt: now })
        .where(inArray(schema.products.id, ids));
      updated += ids.length;
      for (const id of ids) {
        if (sample.length < 5) sample.push(id);
        else break;
      }
    } catch {
      errors += ids.length;
    }
  }

  return { scanned: stale.length, updated, errors, sampleProductIds: sample };
}
