/**
 * V4 M9.A.send.1-4 — Resend wrapper unit tests.
 *
 * Mocks the audit writer + Redis + Resend client via the _setForTests
 * injectors on send.ts.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

import type { AuditEntry } from '../../../lib/auditLog';
import {
  sendEmail,
  _resetForTests,
  _setForTests,
  BUDGET_LIMIT_PER_DAY,
} from '../../../lib/email/send';

// Mock the audit writer so we can assert records without a DB.
const auditRecord = vi.fn<(entry: AuditEntry) => Promise<{ ok: true } | { ok: false; error: string }>>(
  async () => ({ ok: true as const }),
);
vi.mock('../../../lib/auditLog.js', () => ({
  drizzleAuditWriter: () => ({ record: auditRecord }),
  recordAudit: vi.fn(async () => ({ ok: true })),
}));

function firstAuditEntry(): AuditEntry {
  const call = auditRecord.mock.calls[0];
  if (!call) throw new Error('expected at least one audit call');
  return call[0];
}

interface FakeRedisState {
  store: Map<string, string>;
  counters: Map<string, number>;
  expires: Map<string, number>;
}

function makeFakeRedis(): { state: FakeRedisState; client: Parameters<typeof _setForTests>[0]['redis'] } {
  const state: FakeRedisState = { store: new Map(), counters: new Map(), expires: new Map() };
  const client = {
    async get<T = unknown>(key: string): Promise<T | null> {
      return (state.store.get(key) as T | undefined) ?? null;
    },
    async set(key: string, value: string, opts?: { ex?: number }): Promise<unknown> {
      state.store.set(key, value);
      if (opts?.ex) state.expires.set(key, opts.ex);
      return 'OK';
    },
    async incr(key: string): Promise<number> {
      const next = (state.counters.get(key) ?? 0) + 1;
      state.counters.set(key, next);
      return next;
    },
    async expire(key: string, seconds: number): Promise<unknown> {
      state.expires.set(key, seconds);
      return 1;
    },
  };
  return { state, client };
}

function makeResendStub(impl: (args: { to: string }) => { id: string } | { error: string } | { throw: string }) {
  const sends: Array<{ to: string; subject: string }> = [];
  const client = {
    emails: {
      async send(args: { from: string; to: string; subject: string; html: string; replyTo?: string }) {
        sends.push({ to: args.to, subject: args.subject });
        const r = impl({ to: args.to });
        if ('throw' in r) throw new Error(r.throw);
        if ('error' in r) return { data: null, error: { message: r.error } };
        return { data: { id: r.id }, error: null };
      },
    },
  };
  return { client, sends };
}

describe('sendEmail — M9.A.send.1-4', () => {
  beforeEach(() => {
    _resetForTests();
    auditRecord.mockClear();
  });

  it('degrades to dry-run when Resend client absent (no_client)', async () => {
    _setForTests({ resend: null, redis: null });
    const r = await sendEmail({
      to: 'c@example.com',
      subject: 'Test',
      html: '<p>hi</p>',
      template: 'design-saved',
      payload: { designId: 1 },
    });
    expect(r.ok).toBe(true);
    expect(r.loggedOnly).toBe(true);
    expect(r.code).toBe('no_client');
    expect(r.dedupKey).toHaveLength(32);
    expect(auditRecord).not.toHaveBeenCalled();
  });

  it('returns the Resend id on a clean send + writes email.sent audit', async () => {
    const { client } = makeResendStub(() => ({ id: 're_123' }));
    _setForTests({ resend: client, redis: null });
    const r = await sendEmail({
      to: 'c@example.com',
      subject: 'Test',
      html: '<p>hi</p>',
      template: 'design-saved',
      payload: { designId: 1 },
    });
    expect(r.ok).toBe(true);
    expect(r.id).toBe('re_123');
    expect(auditRecord).toHaveBeenCalledTimes(1);
    const entry = firstAuditEntry();
    expect(entry.action).toBe('email.sent');
    expect(entry.targetId).toBe('re_123');
  });

  it('caches by dedupKey: second call with same key returns first id without sending again', async () => {
    const stub = makeResendStub(() => ({ id: 're_first' }));
    const { state, client: redis } = makeFakeRedis();
    _setForTests({ resend: stub.client, redis });
    const r1 = await sendEmail({
      to: 'c@example.com',
      subject: 'Test',
      html: '<p>hi</p>',
      template: 'design-saved',
      payload: { designId: 1 },
    });
    expect(r1.id).toBe('re_first');
    expect(stub.sends).toHaveLength(1);
    expect(state.store.has(`email:dedup:${r1.dedupKey}`)).toBe(true);

    const r2 = await sendEmail({
      to: 'c@example.com',
      subject: 'Test',
      html: '<p>hi</p>',
      template: 'design-saved',
      payload: { designId: 1 },
    });
    expect(r2.ok).toBe(true);
    expect(r2.id).toBe('re_first');
    expect(r2.code).toBe('dedup_hit');
    expect(stub.sends).toHaveLength(1); // no second Resend call
  });

  it('budget INCR over the limit returns rate_limit + writes email.failed audit (system bucket)', async () => {
    const stub = makeResendStub(() => ({ id: 're_x' }));
    const { state, client: redis } = makeFakeRedis();
    // Pre-fill the system bucket at the limit.
    const today = new Date().toISOString().slice(0, 10);
    state.counters.set(`email:budget:system:${today}`, BUDGET_LIMIT_PER_DAY);
    _setForTests({ resend: stub.client, redis });
    const r = await sendEmail({
      to: 'c@example.com',
      subject: 'Test',
      html: '<p>hi</p>',
      template: 'design-saved',
      payload: { designId: 1 },
    });
    expect(r.ok).toBe(false);
    expect(r.code).toBe('rate_limit');
    expect(stub.sends).toHaveLength(0);
    expect(auditRecord).toHaveBeenCalledTimes(1);
    expect(firstAuditEntry().action).toBe('email.failed');
  });

  it('budget is per-merchant: merchant A at limit does not block merchant B', async () => {
    const stub = makeResendStub(() => ({ id: 're_b' }));
    const { state, client: redis } = makeFakeRedis();
    const today = new Date().toISOString().slice(0, 10);
    state.counters.set(`email:budget:1:${today}`, BUDGET_LIMIT_PER_DAY);
    _setForTests({ resend: stub.client, redis });
    const r = await sendEmail({
      to: 'b@example.com',
      subject: 'Test',
      html: '<p>hi</p>',
      template: 'design-saved',
      merchantId: 2,
      payload: { x: 1 },
    });
    expect(r.ok).toBe(true);
    expect(r.id).toBe('re_b');
  });

  it('budget bucket gets an EXPIRE on the first increment of the day', async () => {
    const stub = makeResendStub(() => ({ id: 're_e' }));
    const { state, client: redis } = makeFakeRedis();
    _setForTests({ resend: stub.client, redis });
    await sendEmail({
      to: 'c@example.com',
      subject: 'Test',
      html: '<p>hi</p>',
      template: 't',
      merchantId: 7,
      payload: { x: 1 },
    });
    const today = new Date().toISOString().slice(0, 10);
    expect(state.expires.get(`email:budget:7:${today}`)).toBe(86400);
  });

  it('retries on transient error and succeeds on the second attempt', async () => {
    let calls = 0;
    const stub = makeResendStub(() => {
      calls++;
      if (calls === 1) return { error: 'Network timeout' };
      return { id: 're_after_retry' };
    });
    _setForTests({ resend: stub.client, redis: null });
    const r = await sendEmail({
      to: 'c@example.com',
      subject: 'Test',
      html: '<p>hi</p>',
      template: 't',
      payload: { x: 1 },
    });
    expect(r.ok).toBe(true);
    expect(r.id).toBe('re_after_retry');
    expect(stub.sends).toHaveLength(2);
  });

  it('does NOT retry on a non-transient error (e.g. invalid email)', async () => {
    const stub = makeResendStub(() => ({ error: 'invalid email address' }));
    _setForTests({ resend: stub.client, redis: null });
    const r = await sendEmail({
      to: 'not-an-email',
      subject: 'Test',
      html: '<p>hi</p>',
      template: 't',
      payload: { x: 1 },
    });
    expect(r.ok).toBe(false);
    expect(r.code).toBe('resend_error');
    expect(stub.sends).toHaveLength(1);
  });

  it('gives up after 3 retries on persistent transient error and audits email.failed', async () => {
    const stub = makeResendStub(() => ({ error: 'ETIMEDOUT' }));
    _setForTests({ resend: stub.client, redis: null });
    const r = await sendEmail({
      to: 'c@example.com',
      subject: 'Test',
      html: '<p>hi</p>',
      template: 't',
      payload: { x: 1 },
    });
    expect(r.ok).toBe(false);
    expect(stub.sends).toHaveLength(3);
    expect(auditRecord).toHaveBeenCalledTimes(1);
    expect(firstAuditEntry().action).toBe('email.failed');
  });

  it('explicit dedupKey overrides the auto-computed one', async () => {
    const stub = makeResendStub(() => ({ id: 're_explicit' }));
    _setForTests({ resend: stub.client, redis: null });
    const r = await sendEmail({
      to: 'c@example.com',
      subject: 'Test',
      html: '<p>hi</p>',
      template: 't',
      dedupKey: 'manual-explicit-key',
      payload: { x: 1 },
    });
    expect(r.dedupKey).toBe('manual-explicit-key');
  });

  it('audit payload redacts the HTML body (only template/to/dedupKey/payloadKeys logged)', async () => {
    const stub = makeResendStub(() => ({ id: 're_audit' }));
    _setForTests({ resend: stub.client, redis: null });
    await sendEmail({
      to: 'c@example.com',
      subject: 'Hi',
      html: '<p>SECRET BODY DO NOT LOG</p>',
      template: 'design-saved',
      payload: { designId: 1, customerName: 'Vic' },
    });
    expect(auditRecord).toHaveBeenCalledTimes(1);
    const entry = firstAuditEntry();
    const payloadStr = JSON.stringify(entry.payload);
    expect(payloadStr).not.toContain('SECRET BODY');
    expect(payloadStr).not.toContain('<p>');
    expect(entry.payload).toMatchObject({
      template: 'design-saved',
      to: 'c@example.com',
      payloadKeys: expect.arrayContaining(['designId', 'customerName']),
    });
  });

  it('Resend throwing (network error) is treated as transient + retried', async () => {
    let calls = 0;
    const stub = makeResendStub(() => {
      calls++;
      if (calls < 2) return { throw: 'network timeout' };
      return { id: 're_after_throw' };
    });
    _setForTests({ resend: stub.client, redis: null });
    const r = await sendEmail({
      to: 'c@example.com',
      subject: 'Test',
      html: '<p>hi</p>',
      template: 't',
      payload: { x: 1 },
    });
    expect(r.ok).toBe(true);
    expect(stub.sends.length).toBeGreaterThan(1);
  });

  it('failure to write the audit row does not flip a successful send', async () => {
    const stub = makeResendStub(() => ({ id: 're_audit_fail' }));
    _setForTests({ resend: stub.client, redis: null });
    auditRecord.mockImplementationOnce(async () => {
      throw new Error('audit DB down');
    });
    const r = await sendEmail({
      to: 'c@example.com',
      subject: 'Test',
      html: '<p>hi</p>',
      template: 't',
      payload: { x: 1 },
    });
    expect(r.ok).toBe(true);
    expect(r.id).toBe('re_audit_fail');
  });
});
