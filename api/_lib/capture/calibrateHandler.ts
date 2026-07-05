/**
 * Sims-Parity DT-04 — POST /capture/calibrate handler.
 *
 * The merchant has finished the CaptureModal flow (DT-05..DT-08), the
 * client has PUT the photos to Vercel Blob (DT-03), and is now sending
 * the assembled `CapturePacket` so the server can:
 *
 *   1. Zod-parse the packet (incl. optional silhouette_bbox_px).
 *   2. Re-validate the server-side bounds (pixelsPerMm 0.3–30,
 *      rmsCalibrationError ≤ 8 px, |deltaPct| ≤ 15% unless override).
 *   3. Mint a fresh scaleLockId (DB default = gen_random_uuid()).
 *   4. Sign the row with HMAC-SHA256(CAPTURE_LOCK_HMAC, canonical-payload).
 *   5. INSERT product_capture_scale_locks with invalidated_at = NULL.
 *   6. recordAudit('capture.calibrate', ...).
 *   7. Return 200 with { scaleLockId, accepted, warnings }.
 *
 * Honoured constraints:
 *   • CAPTURE_LOCK_HMAC consumed from process.env (Vercel env id
 *     UWpPlyhopXThwXwe; prod+preview; sensitive).
 *   • Hobby 12-fn cap — wired into merchants-router catchall.
 *   • HARD STOP — no money, no public posting, no permanent delete,
 *     no creds in repo. The HMAC value never appears in logs or
 *     response bodies; only the signed digest.
 *   • Audit row is best-effort (recordAudit returns {ok}); a failed
 *     audit insert does NOT block the calibrate response, but the
 *     failure is surfaced in the response `warnings[]`.
 */

import { createHmac } from 'node:crypto';
import { z } from 'zod';
import { CapturePacketSchema, type CapturePacket } from '../../../src/lib/capture/types.js';
import { getDb } from '../../_db/client.js';
import { productCaptureScaleLocks } from '../../_db/schema.js';
import { recordAudit } from '../auditLog.js';

const PIXELS_PER_MM_MIN = 0.3;
const PIXELS_PER_MM_MAX = 30;
const RMS_MAX = 8;
const DELTA_PCT_MAX = 0.15;

export interface CalibrateResponse {
  scaleLockId: string;
  accepted: true;
  warnings: string[];
}

export type CalibrateError =
  | { ok: false; status: 400; code: 'invalid_body'; message: string }
  | { ok: false; status: 400; code: 'invalid_slug'; message: string }
  | { ok: false; status: 422; code: 'invalid_packet'; message: string; issues?: unknown }
  | { ok: false; status: 422; code: 'bounds_violation'; message: string; field?: string }
  | { ok: false; status: 500; code: 'hmac_missing'; message: string }
  | { ok: false; status: 500; code: 'db_failure'; message: string };

export interface CalibrateDeps {
  hmacSecret: string;
  now?: () => Date;
  /** Test-injectable INSERT — defaults to Drizzle round-trip. */
  insertScaleLock?: (row: ScaleLockInsertRow) => Promise<{ scaleLockId: string }>;
  audit?: (entry: AuditEntry) => Promise<void>;
}

export interface ScaleLockInsertRow {
  merchantId: number;
  path: 'a4-corner-tap' | 'aruco' | 'webxr-plane';
  pixelsPerMm: string; // numeric → string in Drizzle
  rmsCalibrationError: string;
  hmacSignature: string;
  silhouetteBboxPx: unknown;
  capturedAt: Date;
}

interface AuditEntry {
  action: 'capture.calibrate';
  targetType: 'product_capture_scale_lock';
  targetId: string;
  actorEmail: string;
  payload: Record<string, unknown>;
}

/**
 * Canonical-payload HMAC: sign the fields that bind the lock to the
 * physical capture. Pathname (blobKey) is NOT included because the
 * client uploads to a server-chosen pathname in DT-03; only the
 * derived metrics + dim claim need to be bound.
 */
function signLock(secret: string, packet: CapturePacket, merchantId: number): string {
  const canonical = [
    String(merchantId),
    packet.path,
    packet.photoFront.pixelsPerMm.toFixed(4),
    packet.photoFront.rmsCalibrationError.toFixed(4),
    String(packet.dimensionsMm.width),
    String(packet.dimensionsMm.depth),
    String(packet.dimensionsMm.height),
    packet.capturedAt,
  ].join('|');
  return createHmac('sha256', secret).update(canonical).digest('hex');
}

const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;

export const CalibrateRequestEnvelopeSchema = z.object({
  merchantId: z.number().int().positive(),
  packet: CapturePacketSchema,
});

/**
 * Pure calibrate core — exported for tests. Performs everything
 * except writing to a real DB; the `deps.insertScaleLock` callback
 * does that.
 */
export async function calibrate(
  slug: string,
  rawBody: unknown,
  deps: CalibrateDeps,
): Promise<{ ok: true; status: 200; response: CalibrateResponse } | CalibrateError> {
  if (typeof slug !== 'string' || !SLUG_RE.test(slug) || slug.length < 2 || slug.length > 80) {
    return { ok: false, status: 400, code: 'invalid_slug', message: 'merchant slug missing or malformed' };
  }
  if (!rawBody || typeof rawBody !== 'object') {
    return { ok: false, status: 400, code: 'invalid_body', message: 'body must be a JSON object' };
  }

  const parsed = CalibrateRequestEnvelopeSchema.safeParse(rawBody);
  if (!parsed.success) {
    return {
      ok: false,
      status: 422,
      code: 'invalid_packet',
      message: 'CapturePacket failed Zod validation',
      issues: parsed.error.issues,
    };
  }
  const { merchantId, packet } = parsed.data;

  // Server-side bounds re-check (the Zod schema is permissive on numerics).
  const ppmm = packet.photoFront.pixelsPerMm;
  if (ppmm < PIXELS_PER_MM_MIN || ppmm > PIXELS_PER_MM_MAX) {
    return {
      ok: false,
      status: 422,
      code: 'bounds_violation',
      field: 'photoFront.pixelsPerMm',
      message: `pixelsPerMm ${ppmm} outside [${PIXELS_PER_MM_MIN}, ${PIXELS_PER_MM_MAX}]`,
    };
  }
  const rms = packet.photoFront.rmsCalibrationError;
  if (rms < 0 || rms > RMS_MAX) {
    return {
      ok: false,
      status: 422,
      code: 'bounds_violation',
      field: 'photoFront.rmsCalibrationError',
      message: `rmsCalibrationError ${rms} outside [0, ${RMS_MAX}]`,
    };
  }
  // |deltaPct| > DELTA_PCT_MAX requires an override reason from DT-07.
  const delta = packet.typedVsMeasured.deltaPct;
  const overridden = typeof packet.typedVsMeasured.overrideReason === 'string'
    && packet.typedVsMeasured.overrideReason.length > 0;
  if (Math.abs(delta) > DELTA_PCT_MAX && !overridden) {
    return {
      ok: false,
      status: 422,
      code: 'bounds_violation',
      field: 'typedVsMeasured.deltaPct',
      message: `|deltaPct| ${Math.abs(delta).toFixed(4)} exceeds ${DELTA_PCT_MAX} without overrideReason`,
    };
  }

  // ─── Mint signature + insert row ────────────────────────────────
  const hmacSignature = signLock(deps.hmacSecret, packet, merchantId);
  const now = deps.now ?? (() => new Date());
  const capturedAt = new Date(packet.capturedAt);

  const insertRow: ScaleLockInsertRow = {
    merchantId,
    path: packet.path,
    pixelsPerMm: ppmm.toFixed(4),
    rmsCalibrationError: rms.toFixed(4),
    hmacSignature,
    silhouetteBboxPx: packet.photoFront.silhouette_bbox_px ?? null,
    capturedAt,
  };

  let scaleLockId: string;
  try {
    const result = deps.insertScaleLock
      ? await deps.insertScaleLock(insertRow)
      : await defaultInsertScaleLock(insertRow);
    scaleLockId = result.scaleLockId;
  } catch (err) {
    return {
      ok: false,
      status: 500,
      code: 'db_failure',
      message: err instanceof Error ? err.message : 'db insert failed',
    };
  }

  // ─── Best-effort audit ──────────────────────────────────────────
  const warnings: string[] = [];
  try {
    const auditFn = deps.audit ?? defaultAudit;
    await auditFn({
      action: 'capture.calibrate',
      targetType: 'product_capture_scale_lock',
      targetId: scaleLockId,
      actorEmail: `merchant:${slug}`,
      payload: {
        merchantId,
        path: packet.path,
        pixelsPerMm: ppmm,
        rmsCalibrationError: rms,
        deltaPct: delta,
        overridden,
        hasBbox: Boolean(packet.photoFront.silhouette_bbox_px),
        capturedAt: packet.capturedAt,
        // hmacSignature deliberately omitted from audit payload —
        // the signed digest is already stored on the lock row.
      },
    });
  } catch (err) {
    warnings.push(`audit_failed: ${err instanceof Error ? err.message : String(err)}`);
  }
  // capturedAt unused locally beyond row insert; reference once to keep tsc happy.
  void capturedAt;
  void now;

  return {
    ok: true,
    status: 200,
    response: { scaleLockId, accepted: true, warnings },
  };
}

async function defaultInsertScaleLock(row: ScaleLockInsertRow): Promise<{ scaleLockId: string }> {
  const db = getDb();
  const inserted = await db
    .insert(productCaptureScaleLocks)
    .values({
      merchantId: row.merchantId,
      path: row.path,
      pixelsPerMm: row.pixelsPerMm,
      rmsCalibrationError: row.rmsCalibrationError,
      hmacSignature: row.hmacSignature,
      silhouetteBboxPx: row.silhouetteBboxPx,
      capturedAt: row.capturedAt,
    })
    .returning({ scaleLockId: productCaptureScaleLocks.scaleLockId });
  const first = inserted[0];
  if (!first) throw new Error('insert returned zero rows');
  return { scaleLockId: first.scaleLockId };
}

async function defaultAudit(entry: AuditEntry): Promise<void> {
  const result = await recordAudit(
    entry.actorEmail,
    entry.action,
    entry.targetType,
    entry.targetId,
    null,
    entry.payload,
  );
  if (!result.ok) {
    throw new Error(result.error);
  }
}

interface MinimalReq {
  method?: string;
  url?: string;
  headers: Record<string, string | string[] | undefined>;
  body?: unknown;
}
interface MinimalRes {
  setHeader(name: string, value: string): void;
  status(code: number): MinimalRes;
  end(payload?: string): void;
  json(body: unknown): void;
}

async function readJsonBody(req: MinimalReq): Promise<unknown> {
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

export async function handler(
  slug: string,
  req: MinimalReq,
  res: MinimalRes,
): Promise<void> {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).end();
    return;
  }
  const hmacSecret = process.env.CAPTURE_LOCK_HMAC;
  if (!hmacSecret) {
    res.status(500).json({
      error: 'capture HMAC not configured',
      code: 'hmac_missing',
    });
    return;
  }
  const body = await readJsonBody(req);
  if (body === null) {
    res.status(400).json({ error: 'body must be valid JSON' });
    return;
  }
  const result = await calibrate(slug, body, { hmacSecret });
  if (!result.ok) {
    const errBody: Record<string, unknown> = {
      error: result.message,
      code: result.code,
    };
    if ('field' in result && result.field) errBody.field = result.field;
    if ('issues' in result && result.issues) errBody.issues = result.issues;
    res.status(result.status).json(errBody);
    return;
  }
  res.status(200).json(result.response);
}

export const __TEST__ = { signLock, PIXELS_PER_MM_MIN, PIXELS_PER_MM_MAX, RMS_MAX, DELTA_PCT_MAX };
