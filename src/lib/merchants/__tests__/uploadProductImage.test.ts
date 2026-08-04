/**
 * Wellness-Designer-App (c) part 2 — browser-side upload helper tests.
 *
 * Two-phase flow validated:
 *   • Phase 1: POST sign-upload returns 200 + token shape → continues.
 *   • Phase 2: PUT to Vercel Blob returns 200 → result returned.
 *
 * Both error paths covered:
 *   • Phase 1 non-2xx → throws UploadProductImageError(phase:'sign').
 *   • Phase 2 non-2xx → throws UploadProductImageError(phase:'put').
 */

import { describe, it, expect, vi } from 'vitest';
import {
  uploadProductImageBlob,
  UploadProductImageError,
} from '../uploadProductImage';

function jsonRes(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('uploadProductImageBlob', () => {
  const slug = 'k1-sport';
  const file = new Blob([new Uint8Array(1024)], { type: 'image/png' });

  it('returns blobKey + blobUrl on happy path', async () => {
    const fetchImpl = vi.fn(async (url: RequestInfo | URL, _init?: RequestInit) => {
      const u = url.toString();
      if (u.endsWith('/products/upload-image')) {
        return jsonRes(200, {
          uploadUrl: 'https://blob.vercel-storage.com/merchants/k1-sport/products/abc.png',
          token: 'vercel_blob_client_FAKE_token',
          blobKey: 'merchants/k1-sport/products/abc.png',
          expiresAt: new Date(Date.now() + 60_000).toISOString(),
        });
      }
      // Phase 2 PUT — return 200 with no body
      return new Response(null, { status: 200 });
    });
    const result = await uploadProductImageBlob({
      merchantSlug: slug,
      file,
      filename: 'product.png',
      contentType: 'image/png',
      sessionToken: 'SESSION-TOKEN',
      deps: { fetch: fetchImpl as unknown as typeof globalThis.fetch },
    });
    expect(result.blobKey).toBe('merchants/k1-sport/products/abc.png');
    expect(result.bytesUploaded).toBe(1024);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('phase 1 sign-upload sends filename + contentType in JSON body', async () => {
    const fetchImpl = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      const u = url.toString();
      if (u.endsWith('/products/upload-image')) {
        const sentBody = JSON.parse((init?.body as string) ?? '{}');
        expect(sentBody.filename).toBe('product.png');
        expect(sentBody.contentType).toBe('image/png');
        // IMPL-2 — the sign grant is now merchant-session gated.
        const headers = init?.headers as Record<string, string>;
        expect(headers.Authorization).toBe('Bearer SESSION-TOKEN');
        return jsonRes(200, {
          uploadUrl: 'https://blob.vercel-storage.com/x',
          token: 't',
          blobKey: 'k',
          expiresAt: 'now',
        });
      }
      return new Response(null, { status: 200 });
    });
    await uploadProductImageBlob({
      merchantSlug: slug,
      file,
      filename: 'product.png',
      contentType: 'image/png',
      sessionToken: 'SESSION-TOKEN',
      deps: { fetch: fetchImpl as unknown as typeof globalThis.fetch },
    });
  });

  it('throws UploadProductImageError(phase=sign) on phase-1 non-2xx', async () => {
    const fetchImpl = vi.fn(async () => jsonRes(400, { code: 'invalid_content_type' }));
    await expect(
      uploadProductImageBlob({
        merchantSlug: slug,
        file,
        filename: 'product.png',
        contentType: 'image/png',
        sessionToken: 'SESSION-TOKEN',
        deps: { fetch: fetchImpl as unknown as typeof globalThis.fetch },
      }),
    ).rejects.toMatchObject({
      name: 'UploadProductImageError',
      phase: 'sign',
      status: 400,
      code: 'invalid_content_type',
    });
  });

  it('throws UploadProductImageError(phase=put) on phase-2 non-2xx', async () => {
    let callCount = 0;
    const fetchImpl = vi.fn(async () => {
      callCount += 1;
      if (callCount === 1) {
        return jsonRes(200, {
          uploadUrl: 'https://blob.vercel-storage.com/x',
          token: 't',
          blobKey: 'k',
          expiresAt: 'now',
        });
      }
      return new Response(null, { status: 502 });
    });
    await expect(
      uploadProductImageBlob({
        merchantSlug: slug,
        file,
        filename: 'product.png',
        contentType: 'image/png',
        sessionToken: 'SESSION-TOKEN',
        deps: { fetch: fetchImpl as unknown as typeof globalThis.fetch },
      }),
    ).rejects.toBeInstanceOf(UploadProductImageError);
  });

  it('phase 2 PUT sets Authorization Bearer + Content-Type headers', async () => {
    const fetchImpl = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      const u = url.toString();
      if (u.endsWith('/products/upload-image')) {
        return jsonRes(200, {
          uploadUrl: 'https://blob.vercel-storage.com/merchants/k1-sport/products/abc.png',
          token: 'TOKEN-XYZ',
          blobKey: 'k',
          expiresAt: 'now',
        });
      }
      // Phase 2 inspect headers
      const headers = init?.headers as Record<string, string>;
      expect(headers.Authorization).toBe('Bearer TOKEN-XYZ');
      expect(headers['Content-Type']).toBe('image/png');
      return new Response(null, { status: 200 });
    });
    await uploadProductImageBlob({
      merchantSlug: slug,
      file,
      filename: 'product.png',
      contentType: 'image/png',
      sessionToken: 'SESSION-TOKEN',
      deps: { fetch: fetchImpl as unknown as typeof globalThis.fetch },
    });
  });
});
