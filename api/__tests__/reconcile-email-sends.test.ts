/**
 * V4 M9.A.recon.1 — email reconciliation cron unit tests.
 *
 * Constants + pure extractPayerEmail covered without a DB.
 * reconcileEmailSendsBatch coverage relies on dispatch + DB mocks.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const dispatchOrderConfirmedEmail = vi.fn();
vi.mock('../lib/email/dispatch.js', () => ({
  dispatchOrderConfirmedEmail: (args: unknown) => dispatchOrderConfirmedEmail(args),
  dispatchDesignSavedEmail: vi.fn(),
  deriveGreetingName: (s: string) => s,
}));

const dbExecute = vi.fn();
vi.mock('../db/client.js', () => ({
  getDb: () => ({ execute: (q: unknown) => dbExecute(q) }),
  schema: { orders: {}, auditLog: {} },
}));

import {
  RECONCILE_WINDOW_HOURS,
  RECONCILE_LIMIT,
  extractPayerEmail,
  reconcileEmailSendsBatch,
  type CapturedOrderRow,
} from '../lib/cron/reconcileEmailSends';

describe('M9.A.recon.1 constants', () => {
  it('window is 24 hours', () => {
    expect(RECONCILE_WINDOW_HOURS).toBe(24);
  });

  it('limit is 200 per tick', () => {
    expect(RECONCILE_LIMIT).toBe(200);
  });
});

describe('extractPayerEmail', () => {
  it('returns customer_email when present', () => {
    const row: CapturedOrderRow = {
      ppwOrderId: 'PPW-1',
      customerEmail: 'top@x.com',
      totalMinor: 100,
      currency: 'USD',
      rawPayload: null,
    };
    expect(extractPayerEmail(row)).toBe('top@x.com');
  });

  it('falls back to payer.email_address from raw_payload', () => {
    const row: CapturedOrderRow = {
      ppwOrderId: 'PPW-1',
      customerEmail: '',
      totalMinor: 100,
      currency: 'USD',
      rawPayload: { payer: { email_address: 'fallback@x.com' } },
    };
    expect(extractPayerEmail(row)).toBe('fallback@x.com');
  });

  it('returns null when neither source has an email', () => {
    const row: CapturedOrderRow = {
      ppwOrderId: 'PPW-1',
      customerEmail: '',
      totalMinor: 100,
      currency: 'USD',
      rawPayload: { payer: {} },
    };
    expect(extractPayerEmail(row)).toBeNull();
  });

  it('null raw_payload also yields null', () => {
    const row: CapturedOrderRow = {
      ppwOrderId: 'PPW-1',
      customerEmail: null,
      totalMinor: 100,
      currency: 'USD',
      rawPayload: null,
    };
    expect(extractPayerEmail(row)).toBeNull();
  });
});

describe('reconcileEmailSendsBatch', () => {
  beforeEach(() => {
    dispatchOrderConfirmedEmail.mockReset();
    dbExecute.mockReset();
  });

  it('returns zero counters when no stale rows', async () => {
    dbExecute.mockResolvedValue([]);
    const r = await reconcileEmailSendsBatch();
    expect(r.scanned).toBe(0);
    expect(r.reEnqueued).toBe(0);
    expect(dispatchOrderConfirmedEmail).not.toHaveBeenCalled();
  });

  it('skips rows with no contact info (no error, no enqueue)', async () => {
    dbExecute.mockResolvedValue([
      { ppwOrderId: 'PPW-1', customerEmail: '', totalMinor: 100, currency: 'USD', rawPayload: null },
    ]);
    const r = await reconcileEmailSendsBatch();
    expect(r.scanned).toBe(1);
    expect(r.reEnqueued).toBe(0);
    expect(r.errors).toBe(0);
    expect(dispatchOrderConfirmedEmail).not.toHaveBeenCalled();
  });

  it('counts a successful re-enqueue', async () => {
    dbExecute.mockResolvedValue([
      { ppwOrderId: 'PPW-1', customerEmail: 'c@x.com', totalMinor: 100, currency: 'USD', rawPayload: null },
    ]);
    dispatchOrderConfirmedEmail.mockResolvedValueOnce({
      fired: true,
      send: { ok: true, id: 're_1', dedupKey: 'k' },
    });
    const r = await reconcileEmailSendsBatch();
    expect(r.reEnqueued).toBe(1);
    expect(r.dedupHits).toBe(0);
    expect(r.errors).toBe(0);
  });

  it('counts a dedup_hit separately (means email actually did go out)', async () => {
    dbExecute.mockResolvedValue([
      { ppwOrderId: 'PPW-2', customerEmail: 'c@x.com', totalMinor: 200, currency: 'MUR', rawPayload: null },
    ]);
    dispatchOrderConfirmedEmail.mockResolvedValueOnce({
      fired: true,
      send: { ok: true, id: 're_first', code: 'dedup_hit', dedupKey: 'k' },
    });
    const r = await reconcileEmailSendsBatch();
    expect(r.dedupHits).toBe(1);
    expect(r.reEnqueued).toBe(0);
  });

  it('counts dispatch caller_caught as an error', async () => {
    dbExecute.mockResolvedValue([
      { ppwOrderId: 'PPW-3', customerEmail: 'c@x.com', totalMinor: 1, currency: 'MUR', rawPayload: null },
    ]);
    dispatchOrderConfirmedEmail.mockResolvedValueOnce({
      fired: false,
      skippedReason: 'caller_caught',
      error: 'boom',
    });
    const r = await reconcileEmailSendsBatch();
    expect(r.errors).toBe(1);
  });

  it('counts send.ok=false as an error', async () => {
    dbExecute.mockResolvedValue([
      { ppwOrderId: 'PPW-4', customerEmail: 'c@x.com', totalMinor: 1, currency: 'MUR', rawPayload: null },
    ]);
    dispatchOrderConfirmedEmail.mockResolvedValueOnce({
      fired: true,
      send: { ok: false, code: 'rate_limit', error: 'budget', dedupKey: 'k' },
    });
    const r = await reconcileEmailSendsBatch();
    expect(r.errors).toBe(1);
  });

  it('returns up to 5 ppwOrderIds in sampleOrderIds', async () => {
    const ids = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
    dbExecute.mockResolvedValue(
      ids.map((id) => ({
        ppwOrderId: id,
        customerEmail: 'c@x.com',
        totalMinor: 100,
        currency: 'MUR',
        rawPayload: null,
      })),
    );
    dispatchOrderConfirmedEmail.mockResolvedValue({
      fired: true,
      send: { ok: true, id: 're_x', dedupKey: 'k' },
    });
    const r = await reconcileEmailSendsBatch();
    expect(r.sampleOrderIds).toHaveLength(5);
    expect(r.sampleOrderIds).toEqual(['A', 'B', 'C', 'D', 'E']);
  });
});
