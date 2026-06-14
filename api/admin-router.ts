/**
 * Catch-all admin router — single Vercel function for /api/admin/*.
 *
 * Vercel Hobby tier caps at 12 serverless functions per deployment.
 * Phase 1+1B+1.5+2+3 generates 19 functions if every endpoint is its
 * own file. This dispatcher consolidates 10 admin endpoints into one.
 *
 * Routes handled (forwarded to handlers in api/lib/admin/*):
 *   GET    /api/admin/merchants                → merchants/list
 *   GET    /api/admin/merchants/:slug          → merchants/detail
 *   POST   /api/admin/merchants/:slug/approve  → merchants/approve
 *   POST   /api/admin/merchants/:slug/reject   → merchants/reject
 *   GET    /api/admin/orders                   → orders/list
 *   GET    /api/admin/payouts                  → payouts/list
 *   GET    /api/admin/products                 → products/list
 *   POST/PATCH/DELETE /api/admin/products      → products/write
 *   POST   /api/admin/products/import-csv      → products/importCsv (M3.A.1)
 *   GET    /api/admin/suppliers                → suppliers/list
 *   POST/PATCH/DELETE /api/admin/suppliers     → suppliers/write
 */

import { handler as merchantsList } from './lib/admin/merchants/list.js';
import { withSentry } from "./lib/sentry.js";
import { handler as merchantsDetail } from './lib/admin/merchants/detail.js';
import { handler as merchantsApprove } from './lib/admin/merchants/approve.js';
import { handler as merchantsReject } from './lib/admin/merchants/reject.js';
import { handler as ordersList } from './lib/admin/orders/list.js';
import { handler as payoutsList } from './lib/admin/payouts/list.js';
import { handler as productsList } from './lib/admin/products/list.js';
import { handler as productsWrite } from './lib/admin/products/write.js';
import { handler as productsImportCsv } from './lib/admin/products/importCsv.js';
import { handler as suppliersList } from './lib/admin/suppliers/list.js';
import { handler as suppliersWrite } from './lib/admin/suppliers/write.js';
import { handler as statsHandler } from './lib/admin/stats.js';
import { handler as auditLogHandler } from './lib/admin/auditLogList.js';
import { handler as reviewsHandler } from './lib/admin/reviews/list.js';
import { handler as couponsHandler } from './lib/admin/coupons/handler.js';
import { handler as commissionHandler } from './lib/admin/commission/handler.js';

interface MinimalReq {
  method?: string;
  url?: string;
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

function getSlugSegments(req: MinimalReq): string[] {
  const q = req.query ?? {};
  const raw = q['slug'];
  if (Array.isArray(raw)) return raw.filter((s): s is string => typeof s === 'string');
  if (typeof raw === 'string') return [raw];
  // Fallback: parse url
  if (req.url) {
    const path = req.url.split('?')[0] ?? '';
    const parts = path.split('/').filter(Boolean);
    // expect ['api','admin', ...rest]
    return parts.slice(2);
  }
  return [];
}

async function handler(req: MinimalReq, res: MinimalRes): Promise<void> {
  const segments = getSlugSegments(req);
  const [resource, ...rest] = segments;

  // Inject the merchant slug into req.query for the merchants/detail
  // handler (which expects req.query.slug), and similarly for approve/reject.
  if (resource === 'merchants') {
    if (rest.length === 0) {
      return merchantsList(req as never, res as never);
    }
    const merchantSlug = rest[0];
    req.query = { ...(req.query ?? {}), slug: merchantSlug };
    if (rest.length === 1) {
      return merchantsDetail(req as never, res as never);
    }
    if (rest[1] === 'approve') {
      return merchantsApprove(req as never, res as never);
    }
    if (rest[1] === 'reject') {
      return merchantsReject(req as never, res as never);
    }
    res.status(404).json({ error: `unknown merchants action: ${rest[1]}` });
    return;
  }

  if (resource === 'orders') {
    return ordersList(req as never, res as never);
  }

  if (resource === 'payouts') {
    return payoutsList(req as never, res as never);
  }

  if (resource === 'products') {
    if (rest[0] === 'import-csv') {
      return productsImportCsv(req as never, res as never);
    }
    if (req.method === 'GET') return productsList(req as never, res as never);
    return productsWrite(req as never, res as never);
  }

  if (resource === 'suppliers') {
    if (req.method === 'GET') return suppliersList(req as never, res as never);
    return suppliersWrite(req as never, res as never);
  }

  if (resource === 'stats' || resource === 'dashboard') {
    return statsHandler(req as never, res as never);
  }

  if (resource === 'audit-log') {
    return auditLogHandler(req as never, res as never);
  }

  // Phase 4 — review moderation. Pass the rest-segments (e.g. [':id',
  // 'approve']) through query.slug so the handler can resolve moderation.
  if (resource === 'reviews') {
    req.query = { ...(req.query ?? {}), slug: rest };
    return reviewsHandler(req as never, res as never);
  }

  // Phase 6 — coupon CRUD + Pattern-C commission ledger. Pass the
  // rest-segments through query.slug so the handlers can resolve
  // /coupons/:code and /k1-commission/:refCode/reconcile.
  if (resource === 'coupons') {
    req.query = { ...(req.query ?? {}), slug: rest };
    return couponsHandler(req as never, res as never);
  }
  if (resource === 'k1-commission') {
    req.query = { ...(req.query ?? {}), slug: rest };
    return commissionHandler(req as never, res as never);
  }

  res.status(404).json({ error: `unknown admin resource: ${resource ?? '(empty)'}` });
}

export default withSentry(handler);
