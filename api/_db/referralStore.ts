/**
 * M7 — designer_referrals data-access layer (RELENTLESS_GOAL 2026-05-19).
 *
 * Mirrors the merchantStore.ts pattern: interface + drizzle-backed
 * impl + in-memory test impl. The handlers in `api/orders.ts` call
 * methods on the interface so unit tests inject `createInMemory…`
 * without touching Neon.
 *
 * ref_code generator is exported separately as a pure fn so its
 * collision / shape guarantees are unit-testable.
 */

import { and, between, desc, eq, gte, lte } from 'drizzle-orm';
import { randomBytes } from 'node:crypto';
import { getDb, type Db } from './client.js';
import {
  designerReferrals,
  type DesignerReferral,
  type NewDesignerReferral,
} from './schema.js';

export const REF_CODE_HEX_BYTES = 4; // → 8 hex chars
const REF_CODE_PREFIX_DEFAULT = 'PPW';

export interface MintRefCodeArgs {
  merchantSlug: string;
  /** Optional design id — if absent, falls back to 'NEW'. */
  designId?: string | null;
  /** Optional override for the unique suffix — used in tests. */
  randomHex?: string;
}

/**
 * Build a ref code of the shape `PPW-<MERCHANT>-<DESIGN>-<HEX>`.
 * Per `06-CODE-DRIVER-INTEGRATION-SPEC.md` DT-K1-00 — the K1
 * acceptance flow needs this exact shape ("PPW-K1-{room_id}-{8-char-hash}").
 *
 * Idempotency hash is 8 random hex chars (~ 4.3 billion outcomes) →
 * birthday-collision probability is negligible at our pilot volume.
 * Uniqueness is also enforced at the DB layer by `ref_code` UNIQUE.
 */
export function mintRefCode(args: MintRefCodeArgs): string {
  const merchantToken = args.merchantSlug
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 12) || 'MERCHANT';
  const designToken =
    args.designId && args.designId.length
      ? args.designId
          .trim()
          .toUpperCase()
          .replace(/[^A-Z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '')
          .slice(0, 16) || 'NEW'
      : 'NEW';
  const hex = (args.randomHex ?? randomBytes(REF_CODE_HEX_BYTES).toString('hex'))
    .toUpperCase()
    .replace(/[^A-F0-9]/g, '')
    .slice(0, REF_CODE_HEX_BYTES * 2);
  return `${REF_CODE_PREFIX_DEFAULT}-${merchantToken}-${designToken}-${hex}`;
}

export interface ListReferralsFilter {
  merchantSlug?: string;
  /** ISO date string YYYY-MM-DD inclusive (UTC midnight). */
  fromDate?: string;
  /** ISO date string YYYY-MM-DD inclusive (UTC end-of-day). */
  toDate?: string;
  /** Hard cap to avoid pulling unbounded result sets. */
  limit?: number;
}

export interface ReferralStore {
  insert(input: NewDesignerReferral): Promise<DesignerReferral>;
  findByRefCode(refCode: string): Promise<DesignerReferral | null>;
  list(filter: ListReferralsFilter): Promise<DesignerReferral[]>;
}

const MAX_LIST_LIMIT = 10_000;

export function drizzleReferralStore(db: Db = getDb()): ReferralStore {
  return {
    async insert(input) {
      const rows = await db.insert(designerReferrals).values(input).returning();
      const row = rows[0];
      if (!row) throw new Error('designer_referrals insert returned no row');
      return row;
    },
    async findByRefCode(refCode) {
      const rows = await db
        .select()
        .from(designerReferrals)
        .where(eq(designerReferrals.refCode, refCode))
        .limit(1);
      return rows[0] ?? null;
    },
    async list(filter) {
      const conditions = [] as ReturnType<typeof eq>[];
      if (filter.merchantSlug) {
        conditions.push(eq(designerReferrals.merchantSlug, filter.merchantSlug));
      }
      if (filter.fromDate) {
        conditions.push(gte(designerReferrals.createdAt, new Date(`${filter.fromDate}T00:00:00.000Z`)));
      }
      if (filter.toDate) {
        conditions.push(lte(designerReferrals.createdAt, new Date(`${filter.toDate}T23:59:59.999Z`)));
      }
      const limit = Math.min(filter.limit ?? 1000, MAX_LIST_LIMIT);
      const where = conditions.length === 0
        ? undefined
        : conditions.length === 1
          ? conditions[0]
          : and(...conditions);
      const query = db
        .select()
        .from(designerReferrals)
        .orderBy(desc(designerReferrals.createdAt))
        .limit(limit);
      const rows = where ? await query.where(where) : await query;
      void between; // Imported for future date-range fast-paths; silenced for now.
      return rows;
    },
  };
}

/**
 * Test-only in-memory implementation. Mirrors the drizzle behaviour
 * closely enough to unit-test the handler logic above without touching
 * the network.
 */
export function createInMemoryReferralStore(seed: DesignerReferral[] = []): ReferralStore {
  let rows: DesignerReferral[] = [...seed];
  let nextId = (seed.reduce((m, r) => Math.max(m, r.id), 0)) + 1;
  return {
    async insert(input) {
      const row: DesignerReferral = {
        id: nextId++,
        refCode: input.refCode,
        designId: input.designId ?? null,
        sessionId: input.sessionId ?? null,
        merchantSlug: input.merchantSlug,
        productId: input.productId ?? null,
        productSku: input.productSku ?? null,
        productName: input.productName ?? null,
        productPriceMinor: input.productPriceMinor ?? null,
        productCurrency: input.productCurrency ?? null,
        outboundUrl: input.outboundUrl,
        ipHash: input.ipHash ?? null,
        userAgent: input.userAgent ?? null,
        utmSource: input.utmSource ?? null,
        utmMedium: input.utmMedium ?? null,
        utmCampaign: input.utmCampaign ?? null,
        createdAt: new Date(),
      };
      rows.push(row);
      return row;
    },
    async findByRefCode(refCode) {
      return rows.find((r) => r.refCode === refCode) ?? null;
    },
    async list(filter) {
      let out = rows;
      if (filter.merchantSlug) out = out.filter((r) => r.merchantSlug === filter.merchantSlug);
      if (filter.fromDate) {
        const from = new Date(`${filter.fromDate}T00:00:00.000Z`).getTime();
        out = out.filter((r) => r.createdAt.getTime() >= from);
      }
      if (filter.toDate) {
        const to = new Date(`${filter.toDate}T23:59:59.999Z`).getTime();
        out = out.filter((r) => r.createdAt.getTime() <= to);
      }
      const limit = Math.min(filter.limit ?? 1000, MAX_LIST_LIMIT);
      return out
        .slice()
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .slice(0, limit);
    },
  };
}
