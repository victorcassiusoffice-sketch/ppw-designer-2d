/**
 * Sims-Parity DT-04 — calibrate handler tests.
 *
 * Exit criteria coverage:
 *   • Valid packet → 200 + scaleLockId returned.
 *   • Invalid packet → 422.
 *   • Audit row written (best-effort, non-blocking).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createHmac } from 'node:crypto';
import { calibrate, __TEST__ } from '../_lib/capture/calibrateHandler';
import merchantsRouter from '../merchants-router';

const SECRET = 'test-hmac-secret-do-not-use-in-prod';

function validPacket(overrides: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
  return {
    scaleLockId: '11111111-1111-4111-8111-111111111111',
    capturedAt: '2026-05-18T12:00:00.000Z',
    path: 'a4-corner-tap',
    photoFront: {
      blobUrl: 'https://blob.vercel-storage.com/merchants/aurora/capture/x.webp',
      widthPx: 1920,
      heightPx: 1080,
      pixelsPerMm: 5.2,
      rmsCalibrationError: 1.3,
      alphaClean: false,
    },
    dimensionsMm: { width: 800, depth: 600, height: 450 },
    typedVsMeasured: { deltaPct: 0.03, flagged: false },
    ...overrides,
  };
}

function envelope(merchantId: number, packet: Record<string, unknown>): Record<string, unknown> {
  return { merchantId, packet };
}

describe('DT-04 / calibrate pure core', () => {
  let auditCalls: Array<unknown> = [];
  let insertCalls: Array<unknown> = [];

  beforeEach(() => {
    auditCalls = [];
    insertCalls = [];
  });

  const deps = () => ({
    hmacSecret: SECRET,
    insertScaleLock: vi.fn(async (row: unknown) => {
      insertCalls.push(row);
      return { scaleLockId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' };
    }),
    audit: vi.fn(async (entry: unknown) => {
      auditCalls.push(entry);
    }),
  });

  it('happy path: valid packet → 200 + scaleLockId + audit recorded', async () => {
    const d = deps();
    const result = await calibrate('aurora-wellness', envelope(13, validPacket()), d);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.response.scaleLockId).toBe('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
      expect(result.response.accepted).toBe(true);
      expect(result.response.warnings).toEqual([]);
    }
    expect(insertCalls).toHaveLength(1);
    expect(auditCalls).toHaveLength(1);
    const audit = auditCalls[0] as { action: string; targetType: string; payload: Record<string, unknown> };
    expect(audit.action).toBe('capture.calibrate');
    expect(audit.targetType).toBe('product_capture_scale_lock');
    expect(audit.payload.merchantId).toBe(13);
    expect(audit.payload.hasBbox).toBe(false);
  });

  it('insert row carries HMAC signature derived from canonical payload', async () => {
    const d = deps();
    const packet = validPacket();
    await calibrate('aurora-wellness', envelope(13, packet), d);
    const row = insertCalls[0] as { hmacSignature: string };
    const canonical = ['13', 'a4-corner-tap', '5.2000', '1.3000', '800', '600', '450', '2026-05-18T12:00:00.000Z'].join('|');
    const expected = createHmac('sha256', SECRET).update(canonical).digest('hex');
    expect(row.hmacSignature).toBe(expected);
  });

  it('records audit payload without leaking the HMAC value', async () => {
    const d = deps();
    await calibrate('aurora-wellness', envelope(13, validPacket()), d);
    const audit = auditCalls[0] as { payload: Record<string, unknown> };
    expect(audit.payload).not.toHaveProperty('hmacSignature');
    expect(audit.payload).not.toHaveProperty('secret');
  });

  it('persists silhouette_bbox_px when present', async () => {
    const d = deps();
    const packet = validPacket();
    (packet.photoFront as Record<string, unknown>).silhouette_bbox_px = {
      x: 120, y: 80, width: 800, height: 1200,
    };
    await calibrate('aurora-wellness', envelope(13, packet), d);
    const row = insertCalls[0] as { silhouetteBboxPx: unknown };
    expect(row.silhouetteBboxPx).toEqual({ x: 120, y: 80, width: 800, height: 1200 });
  });

  it('persists null silhouette_bbox_px when absent (v1 corner-tap fallback)', async () => {
    const d = deps();
    await calibrate('aurora-wellness', envelope(13, validPacket()), d);
    const row = insertCalls[0] as { silhouetteBboxPx: unknown };
    expect(row.silhouetteBboxPx).toBeNull();
  });

  it('rejects pixelsPerMm > 30 with 422 + bounds_violation', async () => {
    const d = deps();
    const packet = validPacket();
    (packet.photoFront as Record<string, unknown>).pixelsPerMm = 31;
    const result = await calibrate('aurora-wellness', envelope(13, packet), d);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(422);
      expect(result.code).toBe('bounds_violation');
    }
  });

  it('rejects rmsCalibrationError > 8 with 422', async () => {
    const d = deps();
    const packet = validPacket();
    (packet.photoFront as Record<string, unknown>).rmsCalibrationError = 9;
    const result = await calibrate('aurora-wellness', envelope(13, packet), d);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('bounds_violation');
  });

  it('rejects |deltaPct| > 0.15 without overrideReason with 422', async () => {
    const d = deps();
    const packet = validPacket();
    (packet.typedVsMeasured as Record<string, unknown>).deltaPct = 0.2;
    (packet.typedVsMeasured as Record<string, unknown>).flagged = true;
    const result = await calibrate('aurora-wellness', envelope(13, packet), d);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('bounds_violation');
  });

  it('accepts |deltaPct| > 0.15 WITH overrideReason', async () => {
    const d = deps();
    const packet = validPacket();
    (packet.typedVsMeasured as Record<string, unknown>).deltaPct = 0.2;
    (packet.typedVsMeasured as Record<string, unknown>).flagged = true;
    (packet.typedVsMeasured as Record<string, unknown>).overrideReason = 'merchant typed value is correct; tape measure used';
    const result = await calibrate('aurora-wellness', envelope(13, packet), d);
    expect(result.ok).toBe(true);
  });

  it('rejects garbage Zod-side with 422 + invalid_packet', async () => {
    const d = deps();
    const result = await calibrate('aurora-wellness', { merchantId: 13, packet: { foo: 'bar' } }, d);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(422);
      expect(result.code).toBe('invalid_packet');
    }
  });

  it('rejects bad slug', async () => {
    const d = deps();
    const result = await calibrate('AURORA!', envelope(13, validPacket()), d);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('invalid_slug');
  });

  it('continues + warns when audit fails (insert still happens)', async () => {
    const d = {
      hmacSecret: SECRET,
      insertScaleLock: vi.fn(async () => ({ scaleLockId: 'bb' + 'b'.repeat(34) })),
      audit: vi.fn(async () => {
        throw new Error('audit DB offline');
      }),
    };
    const result = await calibrate('aurora-wellness', envelope(13, validPacket()), d);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.response.warnings[0]).toContain('audit_failed');
    }
  });

  it('exposes the bounds constants for downstream consumers', () => {
    expect(__TEST__.PIXELS_PER_MM_MIN).toBe(0.3);
    expect(__TEST__.PIXELS_PER_MM_MAX).toBe(30);
    expect(__TEST__.RMS_MAX).toBe(8);
    expect(__TEST__.DELTA_PCT_MAX).toBe(0.15);
  });
});

describe('DT-04 / merchants-router dispatch', () => {
  const ORIG = process.env.CAPTURE_LOCK_HMAC;
  beforeEach(() => {
    process.env.CAPTURE_LOCK_HMAC = SECRET;
  });
  afterAll(() => {
    if (ORIG === undefined) delete process.env.CAPTURE_LOCK_HMAC;
    else process.env.CAPTURE_LOCK_HMAC = ORIG;
  });

  function fakeRes() {
    const state = { statusCode: 0, headers: {} as Record<string, string>, body: null as unknown };
    const res = {
      get statusCode() { return state.statusCode; },
      get headers() { return state.headers; },
      get body() { return state.body; },
      setHeader(k: string, v: string) { state.headers[k.toLowerCase()] = v; },
      status(c: number) { state.statusCode = c; return res; },
      end() { },
      json(b: unknown) { state.body = b; },
      send() { },
    };
    return res;
  }

  it('GET /api/merchants/:slug/capture/calibrate returns 405', async () => {
    const res = fakeRes();
    await merchantsRouter(
      { method: 'GET', url: '/api/merchants/aurora-wellness/capture/calibrate', headers: {} } as never,
      res as never,
    );
    expect(res.statusCode).toBe(405);
  });

  it('POST with missing HMAC env returns 500 + code=hmac_missing', async () => {
    delete process.env.CAPTURE_LOCK_HMAC;
    const res = fakeRes();
    await merchantsRouter(
      {
        method: 'POST',
        url: '/api/merchants/aurora-wellness/capture/calibrate',
        headers: {},
        body: envelope(13, validPacket()),
      } as never,
      res as never,
    );
    expect(res.statusCode).toBe(500);
    expect((res.body as { code: string }).code).toBe('hmac_missing');
  });
});

// Vitest expects describe-level helpers to refer to afterAll explicitly.
import { afterAll } from 'vitest';
