/**
 * Admin supplier write endpoint.
 *
 * POST   /api/admin/suppliers  body=NewSupplier        → 201
 * PATCH  /api/admin/suppliers?id=N  body=SupplierUpdate → 200
 * DELETE /api/admin/suppliers?id=N                     → 200 (suspended)
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

const SUPPLIER_STATUSES = new Set(['pending', 'active', 'suspended']);

async function readJson(req: MinimalReq): Promise<unknown> {
  const b = req.body;
  if (b === undefined || b === null) return {};
  if (typeof b === 'object' && !Buffer.isBuffer(b)) return b;
  if (typeof b === 'string') {
    try { return JSON.parse(b); } catch { return null; }
  }
  if (Buffer.isBuffer(b)) {
    try { return JSON.parse(b.toString('utf8')); } catch { return null; }
  }
  return null;
}

export interface SupplierCreatePayload {
  merchantId: number;
  name: string;
  contactEmail: string;
  contactPhone?: string | null;
  country: string;
  status?: 'pending' | 'active' | 'suspended';
  notes?: string | null;
}

export function validateCreate(
  payload: unknown,
): { ok: true; data: SupplierCreatePayload } | { ok: false; error: string } {
  if (!payload || typeof payload !== 'object') return { ok: false, error: 'Invalid body.' };
  const p = payload as Partial<SupplierCreatePayload>;
  if (typeof p.merchantId !== 'number' || !Number.isFinite(p.merchantId) || p.merchantId <= 0) {
    return { ok: false, error: 'merchantId must be a positive integer.' };
  }
  if (typeof p.name !== 'string' || !p.name.length || p.name.length > 200) {
    return { ok: false, error: 'name must be a non-empty string ≤200 chars.' };
  }
  if (typeof p.contactEmail !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.contactEmail)) {
    return { ok: false, error: 'contactEmail invalid.' };
  }
  if (typeof p.country !== 'string' || p.country.length !== 2) {
    return { ok: false, error: 'country must be a 2-letter ISO code.' };
  }
  if (p.status && !SUPPLIER_STATUSES.has(p.status)) {
    return { ok: false, error: 'status invalid.' };
  }
  return {
    ok: true,
    data: {
      merchantId: p.merchantId,
      name: p.name.trim(),
      contactEmail: p.contactEmail.trim().toLowerCase(),
      contactPhone: p.contactPhone ?? null,
      country: p.country.toUpperCase(),
      status: p.status ?? 'pending',
      notes: p.notes ?? null,
    },
  };
}

export interface SupplierUpdatePayload {
  name?: string;
  contactEmail?: string;
  contactPhone?: string | null;
  country?: string;
  status?: 'pending' | 'active' | 'suspended';
  notes?: string | null;
}

export function validateUpdate(
  payload: unknown,
): { ok: true; data: SupplierUpdatePayload } | { ok: false; error: string } {
  if (!payload || typeof payload !== 'object') return { ok: false, error: 'Invalid body.' };
  const p = payload as Partial<SupplierCreatePayload>;
  const out: SupplierUpdatePayload = {};
  if (p.name !== undefined) {
    if (typeof p.name !== 'string' || !p.name.length) return { ok: false, error: 'name invalid.' };
    out.name = p.name.trim();
  }
  if (p.contactEmail !== undefined) {
    if (typeof p.contactEmail !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.contactEmail)) {
      return { ok: false, error: 'contactEmail invalid.' };
    }
    out.contactEmail = p.contactEmail.trim().toLowerCase();
  }
  if (p.contactPhone !== undefined) out.contactPhone = p.contactPhone ?? null;
  if (p.country !== undefined) {
    if (typeof p.country !== 'string' || p.country.length !== 2) return { ok: false, error: 'country invalid.' };
    out.country = p.country.toUpperCase();
  }
  if (p.status !== undefined) {
    if (!SUPPLIER_STATUSES.has(p.status as string)) return { ok: false, error: 'status invalid.' };
    out.status = p.status as SupplierUpdatePayload['status'];
  }
  if (p.notes !== undefined) out.notes = p.notes ?? null;
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
      const rows = await db.insert(schema.suppliers).values(v.data).returning();
      const row = rows[0];
      await audit.record({
        actorEmail: auth.admin.email,
        action: 'suppliers.create',
        targetType: 'supplier',
        targetId: String(row.id),
        payload: { name: row.name, merchantId: row.merchantId },
      });
      res.status(201);
      res.json({ supplier: row });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'insert failed';
      const code = /duplicate key|unique constraint/i.test(msg) ? 409 : 500;
      res.status(code);
      res.json({ error: code === 409 ? 'A supplier with that name already exists for this merchant.' : msg });
    }
    return;
  }

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
        .update(schema.suppliers)
        .set({ ...v.data, updatedAt: new Date() })
        .where(eq(schema.suppliers.id, id))
        .returning();
      if (!rows.length) {
        res.status(404);
        res.json({ error: 'Supplier not found.' });
        return;
      }
      await audit.record({
        actorEmail: auth.admin.email,
        action: 'suppliers.update',
        targetType: 'supplier',
        targetId: String(id),
        payload: v.data as Record<string, unknown>,
      });
      res.status(200);
      res.json({ supplier: rows[0] });
    } catch (err) {
      res.status(500);
      res.json({ error: err instanceof Error ? err.message : 'update failed' });
    }
    return;
  }

  if (req.method === 'DELETE') {
    try {
      const rows = await db
        .update(schema.suppliers)
        .set({ status: 'suspended', updatedAt: new Date() })
        .where(eq(schema.suppliers.id, id))
        .returning();
      if (!rows.length) {
        res.status(404);
        res.json({ error: 'Supplier not found.' });
        return;
      }
      await audit.record({
        actorEmail: auth.admin.email,
        action: 'suppliers.suspend',
        targetType: 'supplier',
        targetId: String(id),
        payload: null,
      });
      res.status(200);
      res.json({ supplier: rows[0], note: 'suspended (soft-delete)' });
    } catch (err) {
      res.status(500);
      res.json({ error: err instanceof Error ? err.message : 'suspend failed' });
    }
    return;
  }

  res.setHeader('Allow', 'POST, PATCH, DELETE, OPTIONS');
  res.status(405).end();
}
