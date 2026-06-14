/**
 * Phase 4 — admin review moderation (folded into admin-router).
 *
 *   GET  /api/admin/reviews?status=pending   → moderation queue
 *   POST /api/admin/reviews/:id/approve      → status='published'
 *   POST /api/admin/reviews/:id/reject       → status='rejected'
 *
 * Clerk-admin gated (authoriseAdminWithLive). Every moderation writes an
 * audit_log row; audit failure never blocks the moderation (Phase 2
 * semantics).
 */

import { drizzleMerchantStore } from '../../../db/merchantStore.js';
import { authoriseAdminWithLive } from '../../adminAuth.js';
import { drizzleAuditWriter } from '../../auditLog.js';
import {
  listReviewsForAdmin,
  moderateReview,
  type ModerationAction,
} from '../../reviews/reviews.js';

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

function pickStr(q: Record<string, string | string[] | undefined>, key: string): string | null {
  const v = q[key];
  if (Array.isArray(v)) return v[0] ?? null;
  return typeof v === 'string' && v.trim() ? v.trim() : null;
}

/**
 * Resolve {reviewId, action} from the admin-router segments injected via
 * req.query.slug (['reviews', ':id', 'approve'|'reject']).
 */
export function parseModeration(
  segments: string[],
): { reviewId: number; action: ModerationAction } | null {
  // segments here are the admin-router `rest` after the 'reviews' resource.
  const idRaw = segments[0];
  const actionRaw = segments[1];
  if (!idRaw || !/^\d+$/.test(idRaw)) return null;
  if (actionRaw !== 'approve' && actionRaw !== 'reject') return null;
  return { reviewId: Number(idRaw), action: actionRaw };
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

  // admin-router injects the rest-segments past 'reviews' into query.slug.
  const slugRaw = req.query?.['slug'];
  const segments = Array.isArray(slugRaw)
    ? slugRaw.filter((s): s is string => typeof s === 'string')
    : typeof slugRaw === 'string'
      ? [slugRaw]
      : [];
  // Drop the leading 'reviews' resource token if present.
  const rest = segments[0] === 'reviews' ? segments.slice(1) : segments;

  // Moderation: POST /api/admin/reviews/:id/(approve|reject)
  if (rest.length >= 1) {
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST, OPTIONS');
      res.status(405).end();
      return;
    }
    const mod = parseModeration(rest);
    if (!mod) {
      res.status(400);
      res.json({ error: 'expected /reviews/:id/(approve|reject)' });
      return;
    }
    const result = await moderateReview(mod.reviewId, mod.action);
    if (!result.ok) {
      res.status(result.status);
      res.json({ error: result.error });
      return;
    }
    try {
      await drizzleAuditWriter().record({
        actorEmail: auth.admin.email,
        action: `reviews.${mod.action}`,
        targetType: 'product_review',
        targetId: String(mod.reviewId),
        payload: { newStatus: result.review?.status },
      });
    } catch {
      // Audit failure must not change the moderation verdict.
    }
    res.status(200);
    res.json({ review: result.review });
    return;
  }

  // Queue list: GET /api/admin/reviews?status=pending
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET, POST, OPTIONS');
    res.status(405).end();
    return;
  }
  const status = pickStr(req.query ?? {}, 'status');
  const limit = Number(pickStr(req.query ?? {}, 'limit') ?? '50');
  const offset = Number(pickStr(req.query ?? {}, 'offset') ?? '0');
  const result = await listReviewsForAdmin({
    status,
    limit: Number.isFinite(limit) ? limit : 50,
    offset: Number.isFinite(offset) ? offset : 0,
  });
  if (result.schemaMissing) res.setHeader('X-Schema-Missing', 'product_reviews');
  res.status(200);
  res.json({
    admin: { email: auth.admin.email, role: auth.admin.role },
    items: result.items,
    total: result.total,
  });
}
