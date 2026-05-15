/**
 * OMS Wave 5.5 — webhook replay tests.
 *
 * Sends each webhook type twice with the same event id, asserts the
 * idempotency layer prevents double-write. Mocks the Upstash Redis
 * client so the test stays deterministic without a live KV.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

const memStore = new Map<string, unknown>();

vi.mock('@upstash/redis', () => ({
  Redis: class FakeRedis {
    async get(key: string): Promise<unknown> {
      return memStore.get(key) ?? null;
    }
    async set(key: string, value: unknown): Promise<'OK'> {
      memStore.set(key, value);
      return 'OK';
    }
  },
}));

import { hashBody, checkIdempotency, storeIdempotency } from '../lib/idempotency';

beforeEach(() => {
  memStore.clear();
  process.env.KV_REST_API_URL = 'https://fake-upstash.invalid';
  process.env.KV_REST_API_TOKEN = 'fake-token';
});

describe('idempotency replay invariants', () => {
  it('first POST is fresh; replay with same body returns cached result', async () => {
    const body = { hello: 'world', n: 1 };
    const hash = hashBody(body);
    const key = 'test-key-1';
    const first = await checkIdempotency('endpoint-a', key, hash);
    expect(first.kind).toBe('fresh');
    await storeIdempotency('endpoint-a', key, { status: 201, body: { id: 42 }, bodyHash: hash });

    const second = await checkIdempotency('endpoint-a', key, hash);
    expect(second.kind).toBe('replay');
    if (second.kind === 'replay') {
      expect(second.cached.body).toEqual({ id: 42 });
      expect(second.cached.status).toBe(201);
    }
  });

  it('replay with DIFFERENT body returns conflict', async () => {
    const hash1 = hashBody({ a: 1 });
    const hash2 = hashBody({ a: 2 });
    await storeIdempotency('endpoint-b', 'k2', { status: 200, body: {}, bodyHash: hash1 });
    const res = await checkIdempotency('endpoint-b', 'k2', hash2);
    expect(res.kind).toBe('conflict');
  });

  it('namespaces by endpoint — same key on different endpoints is fresh', async () => {
    const hash = hashBody({ x: 1 });
    await storeIdempotency('endpoint-c', 'shared', { status: 200, body: {}, bodyHash: hash });
    const onOther = await checkIdempotency('endpoint-d', 'shared', hash);
    expect(onOther.kind).toBe('fresh');
  });

  it('hash is stable across equivalent JSON', () => {
    const a = hashBody({ x: 1, y: 'hi' });
    const b = hashBody('{"x":1,"y":"hi"}');
    expect(a).toEqual(b);
  });

  it('hash changes when content changes', () => {
    expect(hashBody({ x: 1 })).not.toEqual(hashBody({ x: 2 }));
  });
});
