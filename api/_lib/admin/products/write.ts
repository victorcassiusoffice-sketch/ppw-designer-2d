/**
 * Admin product write endpoint.
 *
 * POST   /api/admin/products  body=NewProduct        → 201 with row
 * PATCH  /api/admin/products?id=N  body=ProductUpdate → 200 with row
 * DELETE /api/admin/products?id=N                    → 200 with archived row
 *
 * DELETE is soft (sets status='archived'); we never hard-delete catalog
 * rows because order_items + supplier_products may reference them.
 *
 * Every mutation writes an audit_log row. Audit failure does NOT block
 * the mutation (matches Phase 2 semantics).
 */

import { drizzleMerchantStore } from '../../../_db/merchantStore.js';
import { authoriseAdminWithLive } from '../../adminAuth.js';
import { drizzleAuditWriter } from '../../auditLog.js';
import { getDb, schema } from '../../../_db/client.js';
import { eq } from 'drizzle-orm';

interface MinimalReq {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  query?: Record<string, string | string[] | undefined>;
  body?: unknown;
}
interface MinimalRes {
  setHeader(name: string, value: string): void;
  status(code: number): MinimalRes;
  end(payload?: string): void;
  json(body: unknown): void;
}

const PRODUCT_STATUSES = new Set(['draft', 'active', 'archived', 'out_of_stock']);

async function readJson(req: MinimalReq): Promise<unknown> {
  const b = req.body;
  if (b === undefined || b === null) return {};
  if (typeof b === 'object' && !Buffer.isBuffer(b)) return b;
  if (typeof b === 'string') {
    try {
      return JSON.parse(b);
    } catch {
      return null;
    }
  }
  if (Buffer.isBuffer(b)) {
    try {
      return JSON.parse(b.toString('utf8'));
    } catch {
      return null;
    }
  }
  return null;
}

export interface ProductCreatePayload {
  merchantId: number;
  sku: string;
  name: string;
  category: string;
  description?: string | null;
  widthMm?: number | null;
  depthMm?: number | null;
  heightMm?: number | null;
  weightG?: number | null;
  priceMinor: number;
  currency: string;
  imageUrl?: string | null;
  region?: string | null;
  status?: 'draft' | 'active' | 'archived' | 'out_of_stock';
}

export function validateCreate(
  payload: unknown,
): { ok: true; data: ProductCreatePayload } | { ok: false; error: string } {
  if (!payload || typeof payload !== 'object') return { ok: false, error: 'Invalid body.' };
  const p = payload as Partial<ProductCreatePayload>;
  if (typeof p.merchantId !== 'number' || !Number.isFinite(p.merchantId) || p.merchantId <= 0) {
    return { ok: false, error: 'merchantId must be a positive integer.' };
  }
  if (typeof p.sku !== 'string' || p.sku.length === 0 || p.sku.length > 80) {
    return { ok: false, error: 'sku must be a non-empty string ≤80 chars.' };
  }
  if (typeof p.name !== 'string' || p.name.length === 0 || p.name.length > 200) {
    return { ok: false, error: 'name must be a non-empty string ≤200 chars.' };
  }
  if (typeof p.category !== 'string' || p.category.length === 0) {
    return { ok: false, error: 'category required.' };
  }
  if (
    typeof p.priceMinor !== 'number' ||
    !Number.isFinite(p.priceMinor) ||
    p.priceMinor < 0 ||
    !Number.isInteger(p.priceMinor)
  ) {
    return { ok: false, error: 'priceMinor must be a non-negative integer.' };
  }
  if (typeof p.currency !== 'string' || p.currency.length !== 3) {
    return { ok: false, error: 'currency must be a 3-letter code.' };
  }
  if (p.status && !PRODUCT_STATUSES.has(p.status)) {
    return { ok: false, error: 'status invalid.' };
  }
  return {
    ok: true,
    data: {
      merchantId: p.merchantId,
      sku: p.sku.trim(),
      name: p.name.trim(),
      category: p.category.trim(),
      description: p.description ?? null,
      widthMm: typeof p.widthMm === 'number' ? Math.floor(p.widthMm) : null,
      depthMm: typeof p.depthMm === 'number' ? Math.floor(p.depthMm) : null,
      heightMm: typeof p.heightMm === 'number' ? Math.floor(p.heightMm) : null,
      weightG: typeof p.weightG === 'number' ? Math.floor(p.weightG) : null,
      priceMinor: Math.floor(p.priceMinor),
      currency: p.currency.toUpperCase(),
      imageUrl: p.imageUrl ?? null,
      region: p.region ?? null,
      status: p.status ?? 'draft',
    },
  };
}

export interface ProductUpdatePayload {
  name?: string;
  category?: string;
  description?: string | null;
  widthMm?: number | null;
  depthMm?: number | null;
  heightMm?: number | null;
  weightG?: number | null;
  priceMinor?: number;
  currency?: string;
  imageUrl?: string | null;
  region?: string | null;
  status?: 'draft' | 'active' | 'archived' | 'out_of_stock';
}

export function validateUpdate(
  payload: unknown,
): { ok: true; data: ProductUpdatePayload } | { ok: false; error: string } {
  if (!payload || typeof payload !== 'object') return { ok: false, error: 'Invalid body.' };
  const p = payload as Partial<ProductCreatePayload>;
  const out: ProductUpdatePayload = {};

  if (p.name !== undefined) {
    if (typeof p.name !== 'string' || !p.name.length) return { ok: false, error: 'name invalid.' };
    out.name = p.name.trim();
  }
  if (p.category !== undefined) {
    if (typeof p.category !== 'string' || !p.category.length)
      return { ok: false, error: 'category invalid.' };
    out.category = p.category.trim();
  }
  if (p.description !== undefined) out.description = p.description ?? null;
  if (p.widthMm !== undefined) out.widthMm = typeof p.widthMm === 'number' ? Math.floor(p.widthMm) : null;
  if (p.depthMm !== undefined) out.depthMm = typeof p.depthMm === 'number' ? Math.floor(p.depthMm) : null;
  if (p.heightMm !== undefined) out.heightMm = typeof p.heightMm === 'number' ? Math.floor(p.heightMm) : null;
  if (p.weightG !== undefined) out.weightG = typeof p.weightG === 'number' ? Math.floor(p.weightG) : null;
  if (p.priceMinor !== undefined) {
    if (typeof p.priceMinor !== 'number' || p.priceMinor < 0 || !Number.isInteger(p.priceMinor)) {
      return { ok: false, error: 'priceMinor invalid.' };
    }
    out.priceMinor = Math.floor(p.priceMinor);
  }
  if (p.currency !== undefined) {
    if (typeof p.currency !== 'string' || p.currency.length !== 3)
      return { ok: false, error: 'currency invalid.' };
    out.currency = p.currency.toUpperCase();
  }
  if (p.imageUrl !== undefined) out.imageUrl = p.imageUrl ?? null;
  if (p.region !== undefined) out.region = p.region ?? null;
  if (p.status !== undefined) {
    if (!PRODUCT_STATUSES.has(p.status as string)) return { ok: false, error: 'status invalid.' };
    out.status = p.status as ProductUpdatePayload['status'];
  }

  if (Object.keys(out).length === 0) return { ok: false, error: 'no fields to update.' };
  return { ok: true, data: out };
}

export async function handler(req: MinimalReq, res: MinimalRes): Promise<void> {
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  if (req.method !== 'POST' && req.method !== 'PATCH' && req.method !== 'DELETE') {
    res.setHeader('Allow', 'POST, PATCH, DELETE, OPTIONS');
    res.status(405).end();
    return;
  }

  let store;
  try {
    store = drizzleMerchantStore();
  } catch {
    res.status(500);
    res.json({ error: 'Database unavailable.' });
    return;
  }

  const auth = await authoriseAdminWithLive(req.headers, store);
  if (!auth.ok) {
    res.status(auth.status);
    res.json({ error: auth.error });
    return;
  }

  const audit = drizzleAuditWriter();
  const db = getDb();

  if (req.method === 'POST') {
    const body = await readJson(req);
    const v = validateCreate(body);
    if (!v.ok) {
      res.status(400);
      res.json({ error: v.error });
      return;
    }
    try {
      const rows = await db.insert(schema.products).values(v.data).returning();
      const row = rows[0];
      await audit.record({
        actorEmail: auth.admin.email,
        action: 'products.create',
        targetType: 'product',
        targetId: String(row.id),
        payload: { sku: row.sku, merchantId: row.merchantId, status: row.status },
      });
      res.status(201);
      res.json({ product: row });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'insert failed';
      const code = /duplicate key|unique constraint/i.test(msg) ? 409 : 500;
      res.status(code);
      res.json({ error: code === 409 ? 'A product with that SKU already exists for this merchant.' : msg });
    }
    return;
  }

  // PATCH or DELETE both need ?id=
  const idRaw = req.query?.id;
  const idStr = Array.isArray(idRaw) ? idRaw[0] : idRaw;
  if (!idStr || !/^\d+$/.test(String(idStr))) {
    res.status(400);
    res.json({ error: 'Missing or invalid id query param.' });
    return;
  }
  const id = Number(idStr);

  if (req.method === 'PATCH') {
    const body = await readJson(req);
    const v = validateUpdate(body);
    if (!v.ok) {
      res.status(400);
      res.json({ error: v.error });
      return;
    }
    try {
      const rows = await db
        .update(schema.products)
        .set({ ...v.data, updatedAt: new Date() })
        .where(eq(schema.products.id, id))
        .returning();
      if (!rows.length) {
        res.status(404);
        res.json({ error: 'Product not found.' });
        return;
      }
      await audit.record({
        actorEmail: auth.admin.email,
        action: 'products.update',
        targetType: 'product',
        targetId: String(id),
        payload: v.data as Record<string, unknown>,
      });
      res.status(200);
      res.json({ product: rows[0] });
    } catch (err) {
      res.status(500);
      res.json({ error: err instanceof Error ? err.message : 'update failed' });
    }
    return;
  }

  if (req.method === 'DELETE') {
    try {
      const rows = await db
        .update(schema.products)
        .set({ status: 'archived', updatedAt: new Date() })
        .where(eq(schema.products.id, id))
        .returning();
      if (!rows.length) {
        res.status(404);
        res.json({ error: 'Product not found.' });
        return;
      }
      await audit.record({
        actorEmail: auth.admin.email,
        action: 'products.archive',
        targetType: 'product',
        targetId: String(id),
        payload: null,
      });
      res.status(200);
      res.json({ product: rows[0], note: 'archived (soft-delete)' });
    } catch (err) {
      res.status(500);
      res.json({ error: err instanceof Error ? err.message : 'archive failed' });
    }
    return;
  }

  res.setHeader('Allow', 'POST, PATCH, DELETE, OPTIONS');
  res.status(405).end();
}
