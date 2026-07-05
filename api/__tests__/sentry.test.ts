/**
 * withSentry / flushSentry contract tests (P1 — server error capture).
 *
 * The capture-500 incident never reached Sentry because it was a module-load
 * crash (uncatchable by a handler wrapper). For RUNTIME handler throws, the
 * wrapper must: call the handler, capture + flush on throw, then re-throw so
 * Vercel still returns its 500. Flush is the critical serverless bit — without
 * it the frozen lambda drops the event.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { withSentry, flushSentry, isSentryConfigured } from '../_lib/sentry.js';

type Req = { method?: string; url?: string; headers: Record<string, string | string[] | undefined> };
type Res = { setHeader(n: string, v: string): void; status(c: number): Res; end(p?: string): void; json(b: unknown): void };

const mkRes = (): Res => ({ setHeader() {}, status() { return this; }, end() {}, json() {} });

describe('withSentry', () => {
  it('passes through on success and calls the inner handler once', async () => {
    const inner = vi.fn(async (_req: Req, res: Res) => { res.status(200).json({ ok: true }); });
    const wrapped = withSentry(inner);
    await wrapped({ headers: {} }, mkRes());
    expect(inner).toHaveBeenCalledTimes(1);
  });

  it('re-throws handler errors (so Vercel returns its 500)', async () => {
    const boom = new Error('handler boom');
    const wrapped = withSentry(async () => { throw boom; });
    await expect(wrapped({ headers: {}, method: 'GET', url: '/x' }, mkRes())).rejects.toThrow('handler boom');
  });

  it('flushSentry resolves and never throws when Sentry is inert (no DSN)', async () => {
    await expect(flushSentry(10)).resolves.toBeUndefined();
  });
});

describe('isSentryConfigured', () => {
  const original = process.env.SENTRY_DSN;
  afterEach(() => {
    if (original === undefined) delete process.env.SENTRY_DSN;
    else process.env.SENTRY_DSN = original;
  });

  it('is false when SENTRY_DSN is absent', () => {
    delete process.env.SENTRY_DSN;
    expect(isSentryConfigured()).toBe(false);
  });

  it('is true when SENTRY_DSN is set (never exposes the value)', () => {
    process.env.SENTRY_DSN = 'https://examplePublicKey@o0.ingest.sentry.io/0';
    expect(isSentryConfigured()).toBe(true);
  });
});
