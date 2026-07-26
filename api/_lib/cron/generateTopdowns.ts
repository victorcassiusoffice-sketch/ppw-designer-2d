/**
 * Top-down generation worker — SCAFFOLD (WD-2D rebuild 2026-07-10).
 *
 * Turns a merchant's uploaded product photo into a footprint-exact
 * transparent top-down catalog asset via Runway `gen4_image`
 * (image-conditioned) + the deterministic footprint normaliser, then
 * attaches it to the product (`topdown_image_url`) so the designer renders
 * it to-scale. Wires the previously-dead generator into the live listing
 * flow WITHOUT overwriting the merchant's original photo.
 *
 * FOUR safety layers (mirrors disbursePayouts.ts — money path discipline):
 *   1. DRY-RUN BY DEFAULT — unless TOPDOWN_GENERATE_ENABLED === 'true', the
 *      worker only REPORTS eligible products + estimated credit cost. Zero
 *      Runway calls, zero spend, zero writes.
 *   2. KEY-GATED — even enabled, it no-ops (stays dry-run) unless
 *      RUNWAY_API_KEY (+ BLOB_READ_WRITE_TOKEN) are present in the env.
 *   3. PER-RUN CAPS — hard ceilings on both count and USD per invocation;
 *      it stops before exceeding them and never auto-tops-up credits.
 *   4. NOT SCHEDULED — the /api/cron/generate-topdowns route exists but is
 *      NOT in vercel.json crons. Manual invoke only (CRON_SECRET), so a
 *      run happens exactly when a human triggers it.
 *
 * ACTIVATION (Vic-gated): run migration 0027 on Neon → set RUNWAY_API_KEY
 * in Vercel env (capped Runway key) → flip TOPDOWN_GENERATE_ENABLED=true →
 * invoke the route. Each step is its own reviewable action.
 */

import { and, eq, isNull, isNotNull, gt, ne, notLike, sql } from 'drizzle-orm';
import { getDb, schema } from '../../_db/client.js';
import {
  GEN4_IMAGE_CREDITS_1080P,
  USD_PER_CREDIT,
} from '../../../src/lib/topdown/runwayTopDown.js';

const RUNWAY_API_BASE = 'https://api.dev.runwayml.com';
const RUNWAY_API_VERSION = '2024-11-06';

/** Per-invocation ceilings — belt-and-braces on top of the est-cost check. */
export const TOPDOWN_PER_RUN_MAX = 8;
export const TOPDOWN_PER_RUN_USD_CAP = 5;

export interface TopdownCandidate {
  id: number;
  sku: string;
  name: string;
  category: string;
  widthMm: number;
  depthMm: number;
  imageUrl: string;
}

export interface GenerateTopdownsResult {
  mode: 'dry-run' | 'live';
  /** Products eligible for generation (real photo + dims, not yet done). */
  eligible: number;
  /** Up to TOPDOWN_PER_RUN_MAX processed this run (live mode). */
  attempted: number;
  generated: number;
  failed: number;
  estCredits: number;
  estUsd: number;
  spentCredits: number | null;
  /** Per-item detail, capped for response size. */
  items: Array<{ id: number; sku: string; status: 'generated' | 'failed' | 'eligible'; reason?: string }>;
  reason?: string;
}

export function isTopdownGenEnabled(): boolean {
  return process.env.TOPDOWN_GENERATE_ENABLED === 'true';
}

/**
 * Eligible = active, not retired, real footprint (width+depth > 0), a real
 * uploaded photo (not a placehold.co placeholder), and no generated
 * top-down yet (status not 'done' AND topdown_image_url IS NULL).
 */
export async function findTopdownCandidates(limit = TOPDOWN_PER_RUN_MAX): Promise<TopdownCandidate[]> {
  const db = getDb();
  const rows = await db
    .select({
      id: schema.products.id,
      sku: schema.products.sku,
      name: schema.products.name,
      category: schema.products.category,
      widthMm: schema.products.widthMm,
      depthMm: schema.products.depthMm,
      imageUrl: schema.products.imageUrl,
    })
    .from(schema.products)
    .where(
      and(
        eq(schema.products.status, 'active'),
        isNull(schema.products.retiredAt),
        isNotNull(schema.products.widthMm),
        isNotNull(schema.products.depthMm),
        gt(schema.products.widthMm, 0),
        gt(schema.products.depthMm, 0),
        isNotNull(schema.products.imageUrl),
        notLike(schema.products.imageUrl, '%placehold.co%'),
        isNull(schema.products.topdownImageUrl),
        ne(schema.products.topdownStatus, 'done'),
      ),
    )
    .limit(limit);
  return rows
    .filter((r): r is TopdownCandidate =>
      r.imageUrl != null && r.widthMm != null && r.depthMm != null,
    )
    .map((r) => ({
      id: Number(r.id),
      sku: r.sku,
      name: r.name,
      category: r.category,
      widthMm: r.widthMm as number,
      depthMm: r.depthMm as number,
      imageUrl: r.imageUrl as string,
    }));
}

async function runwayBalance(key: string): Promise<number | null> {
  try {
    const res = await fetch(`${RUNWAY_API_BASE}/v1/organization`, {
      headers: { Authorization: `Bearer ${key}`, 'X-Runway-Version': RUNWAY_API_VERSION },
    });
    if (!res.ok) return null;
    const j = (await res.json()) as { creditBalance?: number };
    return j.creditBalance ?? null;
  } catch {
    return null;
  }
}

/**
 * Generate + attach a top-down for a single candidate. LIVE only — imports
 * sharp (via the normaliser) + the Runway client lazily so dry-runs and the
 * other cron routes never load them.
 */
async function generateOne(
  cand: TopdownCandidate,
  apiKey: string,
  blobToken: string,
): Promise<{ ok: true; url: string } | { ok: false; reason: string }> {
  const { generateTopDownRunway } = await import('../../../src/lib/topdown/runwayTopDown.js');
  const { normalizeToFootprint } = await import('../../../src/lib/topdown/normalizeFootprint.js');
  const { put } = await import('@vercel/blob');
  const db = getDb();

  await db
    .update(schema.products)
    .set({ topdownStatus: 'processing', updatedAt: new Date() })
    .where(eq(schema.products.id, cand.id));

  const gen = await generateTopDownRunway({
    apiKey,
    referenceImageUri: cand.imageUrl, // https photo → Runway reference
    subject: { name: cand.name, category: cand.category, widthCm: cand.widthMm / 10, depthCm: cand.depthMm / 10 },
  });
  if (!gen.ok || !gen.imageUrl) {
    await markFailed(cand.id, gen.error ?? 'gen_failed');
    return { ok: false, reason: gen.error ?? 'gen_failed' };
  }

  let normalized: Buffer;
  try {
    const raw = Buffer.from(await (await fetch(gen.imageUrl)).arrayBuffer());
    const norm = await normalizeToFootprint(raw, cand.widthMm / 10, cand.depthMm / 10);
    normalized = norm.buffer;
  } catch (err) {
    const reason = `normalize_error:${err instanceof Error ? err.name : 'unknown'}`;
    await markFailed(cand.id, reason);
    return { ok: false, reason };
  }

  let url: string;
  try {
    const hex = globalThis.crypto.randomUUID().replace(/-/g, '').slice(0, 8);
    const blob = await put(`topdowns/${cand.sku}-${hex}.png`, normalized, {
      access: 'public',
      contentType: 'image/png',
      token: blobToken,
      addRandomSuffix: false,
    });
    url = blob.url;
  } catch (err) {
    const reason = `blob_error:${err instanceof Error ? err.name : 'unknown'}`;
    await markFailed(cand.id, reason);
    return { ok: false, reason };
  }

  await db
    .update(schema.products)
    .set({
      topdownImageUrl: url,
      topdownSourceUrl: cand.imageUrl,
      topdownStatus: 'done',
      topdownError: null,
      topdownGeneratedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(schema.products.id, cand.id));

  return { ok: true, url };
}

async function markFailed(id: number, reason: string): Promise<void> {
  const db = getDb();
  await db
    .update(schema.products)
    .set({ topdownStatus: 'failed', topdownError: reason.slice(0, 500), updatedAt: new Date() })
    .where(eq(schema.products.id, id));
}

export async function generateTopdownsBatch(): Promise<GenerateTopdownsResult> {
  const candidates = await findTopdownCandidates(TOPDOWN_PER_RUN_MAX);
  const estCredits = candidates.length * GEN4_IMAGE_CREDITS_1080P;
  const estUsd = +(estCredits * USD_PER_CREDIT).toFixed(2);

  const apiKey = process.env.RUNWAY_API_KEY;
  const blobToken = process.env.BLOB_READ_WRITE_TOKEN;
  const live = isTopdownGenEnabled() && !!apiKey && !!blobToken;

  const base: GenerateTopdownsResult = {
    mode: live ? 'live' : 'dry-run',
    eligible: candidates.length,
    attempted: 0,
    generated: 0,
    failed: 0,
    estCredits,
    estUsd,
    spentCredits: null,
    items: candidates.slice(0, 20).map((c) => ({ id: c.id, sku: c.sku, status: 'eligible' as const })),
  };

  if (!live) {
    if (isTopdownGenEnabled() && (!apiKey || !blobToken)) {
      base.reason = 'enabled_but_missing_key_or_blob_token';
    }
    return base;
  }

  // Live: process up to the per-run count, hard-stopping at the USD cap.
  const balBefore = await runwayBalance(apiKey!);
  const items: GenerateTopdownsResult['items'] = [];
  let generated = 0;
  let failed = 0;
  let attempted = 0;

  for (const cand of candidates) {
    // USD-cap guard: stop before starting a job that could exceed the cap.
    const projectedUsd = (attempted + 1) * GEN4_IMAGE_CREDITS_1080P * USD_PER_CREDIT;
    if (projectedUsd > TOPDOWN_PER_RUN_USD_CAP) break;
    attempted += 1;
    const res = await generateOne(cand, apiKey!, blobToken!);
    if (res.ok) {
      generated += 1;
      items.push({ id: cand.id, sku: cand.sku, status: 'generated' });
    } else {
      failed += 1;
      items.push({ id: cand.id, sku: cand.sku, status: 'failed', reason: res.reason });
    }
  }

  const balAfter = await runwayBalance(apiKey!);
  return {
    ...base,
    mode: 'live',
    attempted,
    generated,
    failed,
    spentCredits: balBefore != null && balAfter != null ? balBefore - balAfter : null,
    items: items.slice(0, 20),
  };
}
