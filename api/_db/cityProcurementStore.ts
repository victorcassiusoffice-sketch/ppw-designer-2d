import { and, eq } from 'drizzle-orm';
import { getDb } from './client.js';
import { cityProcurementPlans, merchants } from './schema.js';
import type { CityProcurementPlan } from '../../src/designer/cityProcurement.js';

export interface StoredCityProcurement {
  document: unknown; revision: number; lastRequestId: string; lastRequestHash: string; updatedAt: Date;
}
export interface CityProcurementStore {
  merchant(slug: string): Promise<{ id: number; status: string; contactEmail: string } | null>;
  get(merchantId: number, id: string): Promise<StoredCityProcurement | null>;
  compareAndSave(input: { merchantId: number; plan: CityProcurementPlan; expectedRevision: number; requestId: string; hash: string; actor: string }): Promise<StoredCityProcurement | null>;
}
export function drizzleCityProcurementStore(): CityProcurementStore {
  const db = getDb();
  return {
    async merchant(slug) {
      const rows = await db.select({ id: merchants.id, status: merchants.status, contactEmail: merchants.contactEmail }).from(merchants).where(eq(merchants.slug, slug)).limit(1);
      return rows[0] ?? null;
    },
    async get(merchantId, id) {
      const rows = await db.select().from(cityProcurementPlans).where(and(eq(cityProcurementPlans.merchantId, merchantId), eq(cityProcurementPlans.publicId, id))).limit(1);
      return rows[0] ?? null;
    },
    async compareAndSave({ merchantId, plan, expectedRevision, requestId, hash, actor }) {
      const values = { merchantId, publicId: plan.id, projectId: plan.projectId, document: plan, revision: expectedRevision + 1, lastRequestId: requestId, lastRequestHash: hash, updatedBy: actor, updatedAt: new Date() };
      // Each operation is a single atomic SQL statement. Never read-modify-write without a revision predicate.
      const rows = expectedRevision === 0
        ? await db.insert(cityProcurementPlans).values(values).onConflictDoNothing({ target: [cityProcurementPlans.merchantId, cityProcurementPlans.publicId] }).returning()
        : await db.update(cityProcurementPlans).set(values).where(and(eq(cityProcurementPlans.merchantId, merchantId), eq(cityProcurementPlans.publicId, plan.id), eq(cityProcurementPlans.revision, expectedRevision))).returning();
      return rows[0] ?? null;
    },
  };
}
