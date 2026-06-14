/**
 * Phase 6 — admin Pattern-C commission ledger (folded into admin-router).
 *
 *   GET  /api/admin/k1-commission                    → ledger lines + totals
 *   POST /api/admin/k1-commission/:refCode/reconcile → mark reconciled
 *
 * Clerk-admin gated; reconcile is audit-logged. No money moves — this is
 * the commission book Vic reconciles against the K1 order export.
 */

import { drizzleMerchantStore } from '../../../db/merchantStore.js';
import { authoriseAdminWithLive } from '../../adminAuth.js';
import { drizzleAuditWriter } from '../../auditLog.js';
import { fetchCommissionLedger, reconcileCommission } from '../../commission/ledger.js';

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

/** Resolve {refCode} from the segments past 'k1-commission' ([refCode, 'reconcile']). */
export function parseReconcile(rest: string[]): { refCode: string } | null {
  if (rest.length >= 2 && rest[1] === 'reconcile' && rest[0]) return { refCode: rest[0] };
  return null;
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

  const slugRaw = req.query?.['slug'];
  const segs = Array.isArray(slugRaw)
    ? slugRaw.filter((s): s is string => typeof s === 'string')
    : typeof slugRaw === 'string'
      ? [slugRaw]
      : [];
  const rest = segs[0] === 'k1-commission' ? segs.slice(1) : segs;

  // POST /api/admin/k1-commission/:refCode/reconcile
  if (rest.length >= 1) {
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST, OPTIONS');
      res.status(405).end();
      return;
    }
    const parsed = parseReconcile(rest);
    if (!parsed) {
      res.status(400);
      res.json({ error: 'expected /k1-commission/:refCode/reconcile' });
      return;
    }
    const body = readJson(req);
    const note = body && typeof body === 'object' ? ((body as { note?: unknown }).note as string | undefined) ?? null : null;
    const r = await reconcileCommission(parsed.refCode, note ?? null);
    if (r.ok) {
      try {
        await drizzleAuditWriter().record({
          actorEmail: auth.admin.email,
          action: 'commission.reconcile',
          targetType: 'designer_referral',
          targetId: parsed.refCode,
          payload: { reconciledAt: r.reconciledAt },
        });
      } catch { /* audit failure never blocks */ }
    }
    res.status(r.status);
    res.json(r.ok ? { refCode: r.refCode, reconciledAt: r.reconciledAt } : { error: r.error });
    return;
  }

  // GET /api/admin/k1-commission
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET, POST, OPTIONS');
    res.status(405).end();
    return;
  }
  const r = await fetchCommissionLedger({ merchantSlug: pickStr(req.query ?? {}, 'merchant') });
  if (r.schemaMissing) res.setHeader('X-Schema-Missing', 'commission_ledger');
  res.status(200);
  res.json({
    admin: { email: auth.admin.email, role: auth.admin.role },
    lines: r.lines,
    totals: r.totals,
  });
}
