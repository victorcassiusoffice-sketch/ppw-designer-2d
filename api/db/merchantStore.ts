/**
 * Merchant store — the data-access layer for OMS Phase 1.
 *
 * Endpoints (signup, webhook, admin approve/reject) call methods on a
 * `MerchantStore` instead of touching Drizzle directly. This keeps the
 * business logic testable: production uses `drizzleMerchantStore()`
 * which goes through Neon; tests inject `createInMemoryMerchantStore()`.
 *
 * Phase 2 will extend this with merchant_endpoints + products tables.
 */

import { and, eq, inArray } from 'drizzle-orm';
import { getDb, type Db } from './client';
import { merchants, type Merchant, type MerchantStatus, type NewMerchant } from './schema';

export interface MerchantStore {
  insert(input: NewMerchant): Promise<Merchant>;
  findById(id: number): Promise<Merchant | null>;
  findBySlug(slug: string): Promise<Merchant | null>;
  findByContactEmail(email: string): Promise<Merchant | null>;
  findByStripeAccountId(id: string): Promise<Merchant | null>;
  listByStatus(statuses: MerchantStatus[]): Promise<Merchant[]>;
  updateStatus(
    id: number,
    status: MerchantStatus,
    extras?: Partial<Pick<Merchant, 'approvedAt' | 'approvedBy' | 'rejectedAt' | 'rejectedReason' | 'notes'>>,
  ): Promise<Merchant | null>;
  attachStripeAccount(id: number, stripeAccountId: string): Promise<Merchant | null>;
}

/**
 * Drizzle-backed implementation. Talks to Neon via @neondatabase/serverless.
 */
export function drizzleMerchantStore(db: Db = getDb()): MerchantStore {
  return {
    async insert(input) {
      const rows = await db.insert(merchants).values(input).returning();
      const row = rows[0];
      if (!row) throw new Error('merchant insert returned no row');
      return row;
    },
    async findById(id) {
      const rows = await db.select().from(merchants).where(eq(merchants.id, id)).limit(1);
      return rows[0] ?? null;
    },
    async findBySlug(slug) {
      const rows = await db.select().from(merchants).where(eq(merchants.slug, slug)).limit(1);
      return rows[0] ?? null;
    },
    async findByContactEmail(email) {
      const rows = await db
        .select()
        .from(merchants)
        .where(eq(merchants.contactEmail, email))
        .limit(1);
      return rows[0] ?? null;
    },
    async findByStripeAccountId(id) {
      const rows = await db
        .select()
        .from(merchants)
        .where(eq(merchants.stripeConnectAccountId, id))
        .limit(1);
      return rows[0] ?? null;
    },
    async listByStatus(statuses) {
      if (statuses.length === 0) return [];
      const rows = await db
        .select()
        .from(merchants)
        .where(inArray(merchants.status, statuses));
      return rows;
    },
    async updateStatus(id, status, extras) {
      const rows = await db
        .update(merchants)
        .set({ status, ...(extras ?? {}) })
        .where(eq(merchants.id, id))
        .returning();
      return rows[0] ?? null;
    },
    async attachStripeAccount(id, stripeAccountId) {
      const rows = await db
        .update(merchants)
        .set({ stripeConnectAccountId: stripeAccountId })
        .where(and(eq(merchants.id, id)))
        .returning();
      return rows[0] ?? null;
    },
  };
}

/**
 * In-memory store for unit tests. Mirrors the public contract; does
 * NOT enforce DB-level constraints (no slug uniqueness, no FK cascade
 * — tests assert business logic, not Postgres semantics).
 */
export function createInMemoryMerchantStore(): MerchantStore & {
  __dump(): Merchant[];
  __reset(): void;
} {
  let nextId = 1;
  let rows: Merchant[] = [];

  function clone(m: Merchant): Merchant {
    return { ...m };
  }

  return {
    async insert(input) {
      const now = new Date();
      const m: Merchant = {
        id: nextId++,
        slug: input.slug,
        businessName: input.businessName,
        brandName: input.brandName,
        contactName: input.contactName,
        contactEmail: input.contactEmail,
        contactPhone: input.contactPhone,
        country: input.country ?? 'MU',
        website: input.website ?? null,
        productCategories: input.productCategories,
        estimatedMonthlyVolume: input.estimatedMonthlyVolume ?? null,
        referralNotes: input.referralNotes ?? null,
        stripeConnectAccountId: input.stripeConnectAccountId ?? null,
        status: input.status ?? 'pending_signup',
        notes: input.notes ?? null,
        createdAt: now,
        updatedAt: now,
        approvedAt: input.approvedAt ?? null,
        approvedBy: input.approvedBy ?? null,
        rejectedAt: input.rejectedAt ?? null,
        rejectedReason: input.rejectedReason ?? null,
      };
      rows.push(m);
      return clone(m);
    },
    async findById(id) {
      const m = rows.find((r) => r.id === id);
      return m ? clone(m) : null;
    },
    async findBySlug(slug) {
      const m = rows.find((r) => r.slug === slug);
      return m ? clone(m) : null;
    },
    async findByContactEmail(email) {
      const m = rows.find((r) => r.contactEmail.toLowerCase() === email.toLowerCase());
      return m ? clone(m) : null;
    },
    async findByStripeAccountId(id) {
      const m = rows.find((r) => r.stripeConnectAccountId === id);
      return m ? clone(m) : null;
    },
    async listByStatus(statuses) {
      return rows.filter((r) => statuses.includes(r.status)).map(clone);
    },
    async updateStatus(id, status, extras) {
      const idx = rows.findIndex((r) => r.id === id);
      if (idx < 0) return null;
      rows[idx] = { ...rows[idx], status, ...(extras ?? {}), updatedAt: new Date() };
      return clone(rows[idx]);
    },
    async attachStripeAccount(id, stripeAccountId) {
      const idx = rows.findIndex((r) => r.id === id);
      if (idx < 0) return null;
      rows[idx] = { ...rows[idx], stripeConnectAccountId: stripeAccountId, updatedAt: new Date() };
      return clone(rows[idx]);
    },
    __dump() {
      return rows.map(clone);
    },
    __reset() {
      rows = [];
      nextId = 1;
    },
  };
}
