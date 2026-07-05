/**
 * Sims-Parity DT-03 — sign-upload handler tests.
 *
 * The pure `signUpload` core is exercised here with a stub token
 * generator (deps injection on randomSuffix + now). The full HTTP
 * round-trip (sign → PUT → 200) is a Playwright smoke we can't run
 * in unit tests because Vercel Blob is a network-bound dep; the unit
 * tests instead prove the input validation + payload shape contract.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { signUpload, SIGN_UPLOAD_TOKEN_TTL_MS } from '../_lib/capture/signUpload';
import merchantsRouter from '../merchants-router';

const FIXED_NOW_MS = 1748764800000; // 2025-06-01T08:00:00Z — pinned for deterministic blobKey
const FIXED_SUFFIX = '8charsfx';

vi.mock('@vercel/blob/client', () => ({
  generateClientTokenFromReadWriteToken: vi.fn(async (opts: { pathname: string }) => {
    return `vercel_blob_client_FAKE_FOR_${opts.pathname}`;
  }),
}));

describe('DT-03 / signUpload pure core', () => {
  const deps = {
    readWriteToken: 'vercel_blob_rw_FAKE',
    now: () => FIXED_NOW_MS,
    randomSuffix: () => FIXED_SUFFIX,
  };

  it('mints a token + blobKey for a valid front-webp request', async () => {
    const result = await signUpload(
      'aurora-wellness',
      { filename: 'front.webp', contentType: 'image/webp', slot: 'front' },
      deps,
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.response.blobKey).toBe(
        `merchants/aurora-wellness/capture/${FIXED_NOW_MS}-front-${FIXED_SUFFIX}.webp`,
      );
      expect(result.response.uploadUrl).toBe(
        `https://blob.vercel-storage.com/merchants/aurora-wellness/capture/${FIXED_NOW_MS}-front-${FIXED_SUFFIX}.webp`,
      );
      expect(result.response.token).toContain('vercel_blob_client_FAKE');
      // Token TTL == 60 s — confirm expiresAt is FIXED_NOW + TTL.
      expect(new Date(result.response.expiresAt).getTime()).toBe(
        FIXED_NOW_MS + SIGN_UPLOAD_TOKEN_TTL_MS,
      );
    }
  });

  it('uses .jpg extension for image/jpeg', async () => {
    const result = await signUpload(
      'aurora-wellness',
      { filename: 'side.jpg', contentType: 'image/jpeg', slot: 'side' },
      deps,
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.response.blobKey).toMatch(/\.jpg$/);
    }
  });

  it('rejects an invalid slug (non-kebab-case)', async () => {
    const result = await signUpload(
      'Aurora_Wellness!',
      { filename: 'front.webp', contentType: 'image/webp', slot: 'front' },
      deps,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('invalid_slug');
  });

  it('rejects a slug that is too short', async () => {
    const result = await signUpload(
      'a',
      { filename: 'front.webp', contentType: 'image/webp', slot: 'front' },
      deps,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('invalid_slug');
  });

  it('rejects a disallowed content type (image/png)', async () => {
    const result = await signUpload(
      'aurora-wellness',
      { filename: 'front.png', contentType: 'image/png', slot: 'front' },
      deps,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('invalid_content_type');
  });

  it('rejects an unknown slot', async () => {
    const result = await signUpload(
      'aurora-wellness',
      { filename: 'front.webp', contentType: 'image/webp', slot: 'top' },
      deps,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('invalid_slot');
  });

  it('rejects an empty filename', async () => {
    const result = await signUpload(
      'aurora-wellness',
      { filename: '', contentType: 'image/webp', slot: 'front' },
      deps,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('invalid_body');
  });

  it('rejects a missing body', async () => {
    const result = await signUpload('aurora-wellness', null, deps);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('invalid_body');
  });

  it('encodes the slot tag in the blobKey for each of the three slots', async () => {
    for (const slot of ['front', 'side', 'back'] as const) {
      const result = await signUpload(
        'aurora-wellness',
        { filename: `${slot}.webp`, contentType: 'image/webp', slot },
        deps,
      );
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.response.blobKey).toMatch(new RegExp(`-${slot}-`));
    }
  });
});

describe('DT-03 / merchants-router dispatch — sign-upload', () => {
  const ORIGINAL_TOKEN = process.env.BLOB_READ_WRITE_TOKEN;

  beforeEach(() => {
    process.env.BLOB_READ_WRITE_TOKEN = 'vercel_blob_rw_FAKE';
  });
  afterEach(() => {
    if (ORIGINAL_TOKEN === undefined) delete process.env.BLOB_READ_WRITE_TOKEN;
    else process.env.BLOB_READ_WRITE_TOKEN = ORIGINAL_TOKEN;
  });

  type FakeRes = ReturnType<typeof fakeRes>;
  function fakeRes() {
    const state = { statusCode: 0, headers: {} as Record<string, string>, body: null as unknown };
    const res = {
      get statusCode() { return state.statusCode; },
      get headers() { return state.headers; },
      get body() { return state.body; },
      setHeader(k: string, v: string) { state.headers[k.toLowerCase()] = v; },
      status(c: number) { state.statusCode = c; return res; },
      end() { /* no-op */ },
      json(b: unknown) { state.body = b; },
      send(_: unknown) { /* no-op */ },
    };
    return res;
  }

  it('POST /api/merchants/aurora-wellness/capture/sign-upload returns 200 + token shape', async () => {
    const res: FakeRes = fakeRes();
    await merchantsRouter(
      {
        method: 'POST',
        url: '/api/merchants/aurora-wellness/capture/sign-upload',
        headers: {},
        body: { filename: 'front.webp', contentType: 'image/webp', slot: 'front' },
      } as never,
      res as never,
    );
    expect(res.statusCode).toBe(200);
    const body = res.body as {
      uploadUrl: string; token: string; blobKey: string; expiresAt: string;
    };
    expect(body.blobKey).toMatch(/^merchants\/aurora-wellness\/capture\/\d+-front-[\w]+\.webp$/);
    expect(body.uploadUrl).toContain('blob.vercel-storage.com/');
    expect(body.token).toContain('vercel_blob_client_FAKE');
    expect(typeof body.expiresAt).toBe('string');
  });

  it('GET on the sign-upload path returns 405', async () => {
    const res: FakeRes = fakeRes();
    await merchantsRouter(
      {
        method: 'GET',
        url: '/api/merchants/aurora-wellness/capture/sign-upload',
        headers: {},
      } as never,
      res as never,
    );
    expect(res.statusCode).toBe(405);
  });

  it('POST with malformed contentType returns 400 + code=invalid_content_type', async () => {
    const res: FakeRes = fakeRes();
    await merchantsRouter(
      {
        method: 'POST',
        url: '/api/merchants/aurora-wellness/capture/sign-upload',
        headers: {},
        body: { filename: 'front.png', contentType: 'image/png', slot: 'front' },
      } as never,
      res as never,
    );
    expect(res.statusCode).toBe(400);
    expect(res.body as { code: string }).toMatchObject({ code: 'invalid_content_type' });
  });

  it('POST returns 500 when BLOB_READ_WRITE_TOKEN is missing', async () => {
    delete process.env.BLOB_READ_WRITE_TOKEN;
    const res: FakeRes = fakeRes();
    await merchantsRouter(
      {
        method: 'POST',
        url: '/api/merchants/aurora-wellness/capture/sign-upload',
        headers: {},
        body: { filename: 'front.webp', contentType: 'image/webp', slot: 'front' },
      } as never,
      res as never,
    );
    expect(res.statusCode).toBe(500);
  });
});
