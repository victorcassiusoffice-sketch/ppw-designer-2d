/**
 * Wellness-Designer-App chain · deliverable (c) tests.
 *
 * The pure `uploadProductImage` core is exercised with a stubbed Vercel
 * Blob token generator (deps-injected `now` + `randomSuffix`). The full
 * round-trip (sign → PUT → 200) is a Playwright smoke we can't run in
 * unit tests because Vercel Blob is a network-bound dep; the unit tests
 * here prove the input-validation + payload-shape contract.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  uploadProductImage,
  UPLOAD_PRODUCT_IMAGE_TOKEN_TTL_MS,
  UPLOAD_PRODUCT_IMAGE_MAX_BYTES,
} from '../_lib/merchants/uploadProductImage';
import merchantsRouter from '../merchants-router';

const FIXED_NOW_MS = 1748764800000; // 2025-06-01T08:00:00Z — pinned for deterministic blobKey
const FIXED_SUFFIX = '8charsfx';

vi.mock('@vercel/blob/client', () => ({
  generateClientTokenFromReadWriteToken: vi.fn(async (opts: { pathname: string }) => {
    return `vercel_blob_client_FAKE_FOR_${opts.pathname}`;
  }),
}));

describe('Wellness-Designer-App (c) / uploadProductImage pure core', () => {
  const deps = {
    readWriteToken: 'vercel_blob_rw_FAKE',
    now: () => FIXED_NOW_MS,
    randomSuffix: () => FIXED_SUFFIX,
  };

  it('mints a token + blobKey for a valid PNG product image', async () => {
    const result = await uploadProductImage(
      'k1-sport',
      { filename: 'treadmill-t600e.png', contentType: 'image/png' },
      deps,
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.response.blobKey).toBe(
        `merchants/k1-sport/products/${FIXED_NOW_MS}-${FIXED_SUFFIX}.png`,
      );
      expect(result.response.uploadUrl).toBe(
        `https://blob.vercel-storage.com/merchants/k1-sport/products/${FIXED_NOW_MS}-${FIXED_SUFFIX}.png`,
      );
      expect(result.response.token).toContain('vercel_blob_client_FAKE');
      expect(new Date(result.response.expiresAt).getTime()).toBe(
        FIXED_NOW_MS + UPLOAD_PRODUCT_IMAGE_TOKEN_TTL_MS,
      );
    }
  });

  it('uses .jpg extension for image/jpeg', async () => {
    const result = await uploadProductImage(
      'k1-sport',
      { filename: 'bench.jpg', contentType: 'image/jpeg' },
      deps,
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.response.blobKey).toMatch(/\.jpg$/);
    }
  });

  it('rejects an invalid slug (non-kebab-case)', async () => {
    const result = await uploadProductImage(
      'K1_Sport!',
      { filename: 'foo.png', contentType: 'image/png' },
      deps,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('invalid_slug');
  });

  it('rejects a slug that is too short', async () => {
    const result = await uploadProductImage(
      'a',
      { filename: 'foo.png', contentType: 'image/png' },
      deps,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('invalid_slug');
  });

  it('rejects a disallowed content type (image/webp)', async () => {
    const result = await uploadProductImage(
      'k1-sport',
      { filename: 'foo.webp', contentType: 'image/webp' },
      deps,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('invalid_content_type');
  });

  it('rejects a disallowed content type (application/pdf)', async () => {
    const result = await uploadProductImage(
      'k1-sport',
      { filename: 'foo.pdf', contentType: 'application/pdf' },
      deps,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('invalid_content_type');
  });

  it('rejects an empty filename', async () => {
    const result = await uploadProductImage(
      'k1-sport',
      { filename: '', contentType: 'image/png' },
      deps,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('invalid_body');
  });

  it('rejects a missing body', async () => {
    const result = await uploadProductImage('k1-sport', null, deps);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('invalid_body');
  });

  it('caps maximum size at 5 MiB on the signed token', async () => {
    expect(UPLOAD_PRODUCT_IMAGE_MAX_BYTES).toBe(5 * 1024 * 1024);
  });
});

describe('Wellness-Designer-App (c) / merchants-router dispatch — upload-image', () => {
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

  it('POST /api/merchants/k1-sport/products/upload-image returns 200 + token shape', async () => {
    const res: FakeRes = fakeRes();
    await merchantsRouter(
      {
        method: 'POST',
        url: '/api/merchants/k1-sport/products/upload-image',
        headers: {},
        body: { filename: 'treadmill.png', contentType: 'image/png' },
      } as never,
      res as never,
    );
    expect(res.statusCode).toBe(200);
    const body = res.body as {
      uploadUrl: string; token: string; blobKey: string; expiresAt: string;
    };
    expect(body.blobKey).toMatch(/^merchants\/k1-sport\/products\/\d+-[\w]+\.png$/);
    expect(body.uploadUrl).toContain('blob.vercel-storage.com/');
    expect(body.token).toContain('vercel_blob_client_FAKE');
    expect(typeof body.expiresAt).toBe('string');
  });

  it('GET on the upload-image path returns 405', async () => {
    const res: FakeRes = fakeRes();
    await merchantsRouter(
      {
        method: 'GET',
        url: '/api/merchants/k1-sport/products/upload-image',
        headers: {},
      } as never,
      res as never,
    );
    expect(res.statusCode).toBe(405);
  });

  it('POST with image/webp returns 400 + code=invalid_content_type', async () => {
    const res: FakeRes = fakeRes();
    await merchantsRouter(
      {
        method: 'POST',
        url: '/api/merchants/k1-sport/products/upload-image',
        headers: {},
        body: { filename: 'foo.webp', contentType: 'image/webp' },
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
        url: '/api/merchants/k1-sport/products/upload-image',
        headers: {},
        body: { filename: 'foo.png', contentType: 'image/png' },
      } as never,
      res as never,
    );
    expect(res.statusCode).toBe(500);
  });
});
