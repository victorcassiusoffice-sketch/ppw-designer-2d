/**
 * Phase 6 (BACKEND-RUN-ORDER-2026-06-11) — coupon/promo engine.
 *
 * Pure validate + apply (unit-tested, no DB) folded into cart-quote;
 * admin CRUD via injectable-db wrappers. Redemption is incremented ONLY
 * by a completed order — kept OUT of the quote path so validating never
 * consumes a redemption (idempotent). The live K1 code is Vic-issued at
 * GATE-2; incrementRedemption stays dark (built + tested, not wired to a
 * live payment path — that wiring is GATE-2, gate G-6).
 */

import { z } from 'zod';
import { and, desc, eq, sql } from 'drizzle-orm';
import { getDb, schema, type Db, type Coupon } from '../../db/client.js';
import type { CartSplitResult } from '../cart/split.js';

// ─────────────────────────────────────────────────────────────────────
// PURE
// ─────────────────────────────────────────────────────────────────────

export const COUPON_TYPES = ['percent', 'fixed'] as const;
export type CouponKind = (typeof COUPON_TYPES)[number];

export const couponCreateSchema = z
  .object({
    code: z
      .string()
      .trim()
      .min(2)
      .max(60)
      .regex(/^[A-Za-z0-9._-]+$/, 'code must be alphanumeric (._- allowed)')
      .transform((s) => s.toUpperCase()),
    merchantId: z.number().int().positive().optional().nullable(),
    type: z.enum(COUPON_TYPES),
    value: z.number().int().positive(),
    currency: z
      .string()
      .trim()
      .length(3)
      .transform((s) => s.toUpperCase())
      .optional()
      .nullable(),
    minSubtotal: z.number().int().nonnegative().optional().nullable(),
    startsAt: z.string().datetime().optional().nullable(),
    expiresAt: z.string().datetime().optional().nullable(),
    maxRedemptions: z.number().int().positive().optional().nullable(),
    active: z.boolean().optional(),
  })
  .strict()
  .superRefine((c, ctx) => {
    if (c.type === 'percent' && c.value > 100) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['value'], message: 'percent value must be 1-100' });
    }
    if (c.type === 'fixed' && !c.currency) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['currency'], message: 'fixed coupons require a currency' });
    }
  });

export type CouponCreatePayload = z.infer<typeof couponCreateSchema>;

/** A coupon as validated/applied (subset of the DB row that pure code needs). */
export interface CouponView {
  code: string;
  merchantId: number | null;
  type: CouponKind;
  value: number;
  currency: string | null;
  minSubtotal: number | null;
  startsAt: Date | string | null;
  expiresAt: Date | string | null;
  maxRedemptions: number | null;
  redemptions: number;
  active: boolean;
}

export function toCouponView(row: Coupon): CouponView {
  return {
    code: row.code,
    merchantId: row.merchantId ?? null,
    type: row.type as CouponKind,
    value: row.value,
    currency: row.currency ?? null,
    minSubtotal: row.minSubtotal ?? null,
    startsAt: row.startsAt ?? null,
    expiresAt: row.expiresAt ?? null,
    maxRedemptions: row.maxRedemptions ?? null,
    redemptions: row.redemptions ?? 0,
    active: row.active,
  };
}

export type CouponValidation = { ok: true } | { ok: false; error: string };

/**
 * Validate a coupon against the applicable subtotal + currency at `now`.
 * Pure: every reason a coupon is rejected is a legible error string,
 * never a silent no-op.
 */
export function validateCoupon(
  c: CouponView,
  ctx: { applicableMinor: number; currency: string; now: Date },
): CouponValidation {
  if (!c.active) return { ok: false, error: 'coupon_inactive' };
  const now = ctx.now.getTime();
  if (c.startsAt && new Date(c.startsAt).getTime() > now) return { ok: false, error: 'coupon_not_started' };
  if (c.expiresAt && new Date(c.expiresAt).getTime() < now) return { ok: false, error: 'coupon_expired' };
  if (c.maxRedemptions !== null && c.redemptions >= c.maxRedemptions) {
    return { ok: false, error: 'coupon_max_redemptions_reached' };
  }
  if (c.type === 'fixed' && c.currency && c.currency !== ctx.currency) {
    return { ok: false, error: 'coupon_currency_mismatch' };
  }
  if (ctx.applicableMinor <= 0) return { ok: false, error: 'coupon_not_applicable_to_cart' };
  if (c.minSubtotal !== null && ctx.applicableMinor < c.minSubtotal) {
    return { ok: false, error: 'coupon_below_min_subtotal' };
  }
  return { ok: true };
}

export interface AppliedCoupon {
  ok: true;
  code: string;
  type: CouponKind;
  value: number;
  applicableMinor: number;
  discountMinor: number;
  totalAfterDiscountMinor: number;
  perMerchant: Array<{ merchantId: number; discountMinor: number }>;
}
export type ApplyCouponResult = AppliedCoupon | { ok: false; error: string };

/**
 * Apply a coupon to a split-quote. Platform-wide coupons (merchantId
 * null) discount the whole cart; merchant-scoped coupons discount only
 * that merchant's subtotal. Distributes the discount across applicable
 * merchants so the per-merchant amounts sum exactly to the total.
 */
export function applyCouponToSplit(c: CouponView, split: CartSplitResult, now: Date): ApplyCouponResult {
  const applicable = split.merchantBreakdown.filter(
    (m) => c.merchantId === null || Number(m.merchantId) === Number(c.merchantId),
  );
  const applicableMinor = applicable.reduce((s, m) => s + m.subtotalMinor, 0);

  const v = validateCoupon(c, { applicableMinor, currency: split.currency, now });
  if (!v.ok) return v;

  const totalDiscount =
    c.type === 'percent'
      ? Math.min(applicableMinor, Math.round((applicableMinor * c.value) / 100))
      : Math.min(c.value, applicableMinor);

  // Distribute proportionally; the last applicable merchant absorbs the
  // rounding remainder so per-merchant amounts sum to totalDiscount.
  const perMerchant: Array<{ merchantId: number; discountMinor: number }> = [];
  let assigned = 0;
  applicable.forEach((m, i) => {
    let d: number;
    if (i === applicable.length - 1) {
      d = totalDiscount - assigned;
    } else {
      d = applicableMinor > 0 ? Math.round((totalDiscount * m.subtotalMinor) / applicableMinor) : 0;
      assigned += d;
    }
    perMerchant.push({ merchantId: Number(m.merchantId), discountMinor: d });
  });

  return {
    ok: true,
    code: c.code,
    type: c.type,
    value: c.value,
    applicableMinor,
    discountMinor: totalDiscount,
    totalAfterDiscountMinor: split.totalMinor - totalDiscount,
    perMerchant,
  };
}

// ─────────────────────────────────────────────────────────────────────
// DB wrappers (injectable db for tests)
// ─────────────────────────────────────────────────────────────────────

const SCHEMA_MISSING_RE =
  /relation .*coupons.* does not exist|column .* does not exist|42P01|42703|undefined_table/i;

/** Fetch one coupon by code (case-insensitive — codes are stored upper). */
export async function fetchCouponByCode(code: string, db: Db = getDb()): Promise<Coupon | null> {
  const rows = await db
    .select()
    .from(schema.coupons)
    .where(eq(schema.coupons.code, code.trim().toUpperCase()))
    .limit(1);
  return rows[0] ?? null;
}

export interface CouponMutationResult {
  ok: boolean;
  status: number;
  error?: string;
  coupon?: Coupon;
}

export async function createCoupon(rawBody: unknown, db: Db = getDb()): Promise<CouponMutationResult> {
  const parsed = couponCreateSchema.safeParse(rawBody);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => `${i.path.join('.') || 'body'}: ${i.message}`).join('; ');
    return { ok: false, status: 400, error: msg };
  }
  const f = parsed.data;
  try {
    const inserted = await db
      .insert(schema.coupons)
      .values({
        code: f.code,
        merchantId: f.merchantId ?? null,
        type: f.type,
        value: f.value,
        currency: f.currency ?? null,
        minSubtotal: f.minSubtotal ?? null,
        startsAt: f.startsAt ? new Date(f.startsAt) : null,
        expiresAt: f.expiresAt ? new Date(f.expiresAt) : null,
        maxRedemptions: f.maxRedemptions ?? null,
        active: f.active ?? true,
      })
      .returning();
    const row = inserted[0];
    if (!row) return { ok: false, status: 500, error: 'insert_returned_no_row' };
    return { ok: true, status: 201, coupon: row };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/duplicate key value|coupons_code|23505/i.test(msg)) return { ok: false, status: 409, error: 'code_conflict' };
    if (SCHEMA_MISSING_RE.test(msg)) return { ok: false, status: 503, error: 'schema_missing' };
    throw err;
  }
}

export async function listCoupons(
  opts: { activeOnly?: boolean } = {},
  db: Db = getDb(),
): Promise<{ items: Coupon[]; schemaMissing: boolean }> {
  try {
    const rows = opts.activeOnly
      ? await db.select().from(schema.coupons).where(eq(schema.coupons.active, true)).orderBy(desc(schema.coupons.createdAt))
      : await db.select().from(schema.coupons).orderBy(desc(schema.coupons.createdAt));
    return { items: rows, schemaMissing: false };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (SCHEMA_MISSING_RE.test(msg)) return { items: [], schemaMissing: true };
    throw err;
  }
}

export async function deactivateCoupon(code: string, db: Db = getDb()): Promise<CouponMutationResult> {
  if (!code) return { ok: false, status: 400, error: 'code required' };
  try {
    const updated = await db
      .update(schema.coupons)
      .set({ active: false })
      .where(eq(schema.coupons.code, code.trim().toUpperCase()))
      .returning();
    const row = updated[0];
    if (!row) return { ok: false, status: 404, error: 'coupon_not_found' };
    return { ok: true, status: 200, coupon: row };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (SCHEMA_MISSING_RE.test(msg)) return { ok: false, status: 503, error: 'schema_missing' };
    throw err;
  }
}

/**
 * Increment a coupon's redemption count. DARK (gate G-6): built + tested
 * but intentionally NOT wired to a live payment/capture path — wiring it
 * to order completion is GATE-2. Atomic guard against over-redemption.
 */
export async function incrementRedemption(
  code: string,
  db: Db = getDb(),
): Promise<{ ok: boolean; status: number; error?: string }> {
  try {
    const updated = await db
      .update(schema.coupons)
      .set({ redemptions: sql`${schema.coupons.redemptions} + 1` })
      .where(
        and(
          eq(schema.coupons.code, code.trim().toUpperCase()),
          sql`(${schema.coupons.maxRedemptions} IS NULL OR ${schema.coupons.redemptions} < ${schema.coupons.maxRedemptions})`,
        ),
      )
      .returning({ id: schema.coupons.id });
    if (!updated[0]) return { ok: false, status: 409, error: 'not_incremented' };
    return { ok: true, status: 200 };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (SCHEMA_MISSING_RE.test(msg)) return { ok: false, status: 503, error: 'schema_missing' };
    throw err;
  }
}
