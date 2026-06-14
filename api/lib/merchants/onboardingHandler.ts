/**
 * Phase 5 — merchant-scoped onboarding + bulk-upload + payout-ledger HTTP
 * handler. Folded into merchants-router (no new Vercel function). Every
 * route is magic-link session-gated for the merchant's own slug.
 *
 *   GET  /api/merchants/:slug/onboarding        → onboarding state + checklist
 *   POST /api/merchants/:slug/kyc-lite          → submit KYC-lite
 *   GET  /api/merchants/:slug/go-live           → go-live checklist
 *   POST /api/merchants/:slug/go-live           → mark go-live (if ready)
 *   POST /api/merchants/:slug/products/bulk      → bulk CSV upload (preview=1 to dry-run)
 *   GET  /api/merchants/:slug/payouts           → payout ledger (read)
 */

import { authoriseMerchantSession } from '../../products.js';
import { drizzleMerchantStore } from '../../db/merchantStore.js';
import { getOnboardingState, submitLiteKyc, markGoLive } from './onboarding.js';
import { previewBulkUpload, commitBulkUpload } from './bulkUpload.js';
import { fetchMerchantPayoutLedger } from '../payouts/ledger.js';

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

function readJson(req: MinimalReq): unknown {
  const b = req.body;
  if (b === undefined || b === null) return {};
  if (typeof b === 'object' && !Buffer.isBuffer(b)) return b;
  if (typeof b === 'string') {
    try {
      return JSON.parse(b || '{}');
    } catch {
      return null;
    }
  }
  if (Buffer.isBuffer(b)) {
    try {
      return JSON.parse(b.toString('utf8') || '{}');
    } catch {
      return null;
    }
  }
  return null;
}

function readCsvText(req: MinimalReq, body: unknown): string | null {
  // Accept raw text/csv body, or { csv: "..." } JSON.
  if (typeof req.body === 'string' && !looksLikeJson(req.body)) return req.body;
  if (body && typeof body === 'object' && typeof (body as { csv?: unknown }).csv === 'string') {
    return (body as { csv: string }).csv;
  }
  if (typeof req.body === 'string') return req.body; // last resort: treat as CSV
  return null;
}

function looksLikeJson(s: string): boolean {
  const t = s.trim();
  return t.startsWith('{') || t.startsWith('[');
}

function isPreview(req: MinimalReq): boolean {
  const v = req.query?.['preview'];
  const s = Array.isArray(v) ? v[0] : v;
  return s === '1' || s === 'true';
}

/**
 * Dispatch a merchant-scoped onboarding/payout request. `action` is the
 * path segment after the slug; `sub` is the one after that (for
 * products/bulk). Returns after writing the response.
 */
export async function handleMerchantOnboarding(
  slug: string,
  action: string,
  sub: string | undefined,
  req: MinimalReq,
  res: MinimalRes,
): Promise<void> {
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  // Every route is gated to the merchant's own session.
  const auth = authoriseMerchantSession(req.headers, slug);
  if (!auth.ok) {
    res.status(auth.status);
    res.json({ error: auth.error });
    return;
  }

  try {
    if (action === 'onboarding') {
      if (req.method !== 'GET') return methodNotAllowed(res, 'GET');
      const r = await getOnboardingState(slug);
      return respond(res, r);
    }

    if (action === 'kyc-lite') {
      if (req.method !== 'POST') return methodNotAllowed(res, 'POST');
      const body = readJson(req);
      if (body === null) {
        res.status(400);
        res.json({ error: 'invalid JSON body' });
        return;
      }
      const r = await submitLiteKyc(slug, body);
      return respond(res, r);
    }

    if (action === 'go-live') {
      if (req.method === 'GET') {
        const r = await getOnboardingState(slug);
        return respond(res, r);
      }
      if (req.method === 'POST') {
        const r = await markGoLive(slug);
        return respond(res, r);
      }
      return methodNotAllowed(res, 'GET, POST');
    }

    if (action === 'products' && sub === 'bulk') {
      if (req.method !== 'POST') return methodNotAllowed(res, 'POST');
      const body = readJson(req);
      const csv = readCsvText(req, body);
      if (!csv) {
        res.status(400);
        res.json({ error: 'CSV body required (text/csv or { csv })' });
        return;
      }
      if (isPreview(req)) {
        const r = previewBulkUpload(csv);
        res.status(r.status);
        res.json(r.ok ? { totalRows: r.totalRows, validCount: r.validCount, invalid: r.invalid, preview: r.preview } : { error: r.error });
        return;
      }
      const r = await commitBulkUpload(slug, csv);
      res.status(r.status);
      res.json(r.ok ? { created: r.created, failed: r.failed } : { error: r.error });
      return;
    }

    if (action === 'payouts') {
      if (req.method !== 'GET') return methodNotAllowed(res, 'GET');
      const merchant = await drizzleMerchantStore().findBySlug(slug);
      if (!merchant) {
        res.status(404);
        res.json({ error: 'merchant_not_found' });
        return;
      }
      const r = await fetchMerchantPayoutLedger(Number(merchant.id));
      if (r.schemaMissing) res.setHeader('X-Schema-Missing', 'payout_queue');
      if (!r.ok) {
        res.status(r.status);
        res.json({ error: r.error });
        return;
      }
      res.status(200);
      res.json({ payouts: r.payouts, totals: r.totals });
      return;
    }

    res.status(404);
    res.json({ error: `unknown merchant onboarding action: ${action}` });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'onboarding handler failed';
    res.status(500);
    res.json({ error: msg });
  }
}

function methodNotAllowed(res: MinimalRes, allow: string): void {
  res.setHeader('Allow', `${allow}, OPTIONS`);
  res.status(405).end();
}

function respond(
  res: MinimalRes,
  r: { ok: boolean; status: number; error?: string; state?: unknown; checklist?: unknown },
): void {
  if (!r.ok && r.status !== 409) {
    res.status(r.status);
    res.json({ error: r.error });
    return;
  }
  res.status(r.status);
  res.json({ state: r.state, checklist: r.checklist, ...(r.error ? { error: r.error } : {}) });
}
