/**
 * Phase 6 — admin coupon CRUD (folded into admin-router).
 *
 *   GET    /api/admin/coupons            → list (?active=1 for active only)
 *   POST   /api/admin/coupons            → create
 *   DELETE /api/admin/coupons/:code      → deactivate
 *
 * Clerk-admin gated; every mutation is audit-logged (failure never blocks
 * the mutation). Issuing the real K1 code = Vic at GATE-2.
 */

import { drizzleMerchantStore } from '../../../db/merchantStore.js';
import { authoriseAdminWithLive } from '../../adminAuth.js';
import { drizzleAuditWriter } from '../../auditLog.js';
import { createCoupon, listCoupons, deactivateCoupon } from '../../coupons/coupons.js';

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

function readJson(req: MinimalReq): unknown {
  const b = req.body;
  if (b === undefined || b === null) return {};
  if (typeof b === 'object' && !Buffer.isBuffer(b)) return b;
  if (typeof b === 'string') {
    try { return JSON.parse(b || '{}'); } catch { return null; }
  }
  if (Buffer.isBuffer(b)) {
    try { return JSON.parse(b.toString('utf8') || '{}'); } catch { return null; }
  }
  return null;
}

function pickStr(q: Record<string, string | string[] | undefined>, key: string): string | null {
  const v = q[key];
  if (Array.isArray(v)) return v[0] ?? null;
  return typeof v === 'string' && v.trim() ? v.trim() : null;
}

export async function handler(req: MinimalReq, res: MinimalRes): Promise<void> {
  if (req.method === 'OPTIONS') {
    res.status(204).end();
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

  // rest-segments past 'coupons' are injected via query.slug by the router.
  const slugRaw = req.query?.['slug'];
  const segs = Array.isArray(slugRaw)
    ? slugRaw.filter((s): s is string => typeof s === 'string')
    : typeof slugRaw === 'string'
      ? [slugRaw]
      : [];
  const rest = segs[0] === 'coupons' ? segs.slice(1) : segs;

  if (req.method === 'GET') {
    const r = await listCoupons({ activeOnly: pickStr(req.query ?? {}, 'active') === '1' });
    if (r.schemaMissing) res.setHeader('X-Schema-Missing', 'coupons');
    res.status(200);
    res.json({ admin: { email: auth.admin.email, role: auth.admin.role }, items: r.items });
    return;
  }

  if (req.method === 'POST') {
    const body = readJson(req);
    if (body === null) {
      res.status(400);
      res.json({ error: 'invalid JSON body' });
      return;
    }
    const r = await createCoupon(body);
    if (r.ok) {
      try {
        await drizzleAuditWriter().record({
          actorEmail: auth.admin.email,
          action: 'coupons.create',
          targetType: 'coupon',
          targetId: r.coupon ? String(r.coupon.code) : '(unknown)',
          payload: { type: r.coupon?.type, value: r.coupon?.value, merchantId: r.coupon?.merchantId ?? null },
        });
      } catch { /* audit failure never blocks */ }
    }
    res.status(r.status);
    res.json(r.ok ? { coupon: r.coupon } : { error: r.error });
    return;
  }

  if (req.method === 'DELETE') {
    const code = rest[0];
    if (!code) {
      res.status(400);
      res.json({ error: 'coupon code required: /api/admin/coupons/:code' });
      return;
    }
    const r = await deactivateCoupon(code);
    if (r.ok) {
      try {
        await drizzleAuditWriter().record({
          actorEmail: auth.admin.email,
          action: 'coupons.deactivate',
          targetType: 'coupon',
          targetId: code,
          payload: null,
        });
      } catch { /* audit failure never blocks */ }
    }
    res.status(r.status);
    res.json(r.ok ? { coupon: r.coupon } : { error: r.error });
    return;
  }

  res.setHeader('Allow', 'GET, POST, DELETE, OPTIONS');
  res.status(405).end();
}
