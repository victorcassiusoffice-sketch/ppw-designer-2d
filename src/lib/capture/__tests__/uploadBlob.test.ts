/**
 * Sims-Parity DT-03 — browser uploader util tests.
 *
 * Exercises the two-phase handshake (sign → PUT) with a stub fetch.
 * Verifies retry/error paths and that the right wire shapes go out
 * and come back.
 */

import { describe, it, expect, vi } from 'vitest';
import { uploadCaptureBlob, UploadBlobError } from '../uploadBlob';

const SIGN_OK = {
  uploadUrl: 'https://blob.vercel-storage.com/merchants/aurora-wellness/capture/1748764800000-front-abc.webp',
  token: 'vercel_blob_client_FAKE',
  blobKey: 'merchants/aurora-wellness/capture/1748764800000-front-abc.webp',
  expiresAt: '2025-06-01T08:01:00.000Z',
};

function mockFetchSequence(...responses: Response[]): typeof globalThis.fetch {
  let i = 0;
  return vi.fn(async () => {
    const r = responses[i++];
    if (!r) throw new Error('mockFetchSequence: no more responses');
    return r;
  }) as unknown as typeof globalThis.fetch;
}

function jsonResponse(status: number, body: unknown, headers?: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...(headers ?? {}) },
  });
}

describe('DT-03 / uploadCaptureBlob', () => {
  it('happy path: sign → PUT → returns blobKey + blobUrl + bytesUploaded', async () => {
    const file = new Blob(['x'.repeat(2048)], { type: 'image/webp' });
    const fetchStub = mockFetchSequence(
      jsonResponse(200, SIGN_OK),
      new Response('', { status: 200, headers: { Location: SIGN_OK.uploadUrl } }),
    );

    const result = await uploadCaptureBlob({
      merchantSlug: 'aurora-wellness',
      file,
      filename: 'front.webp',
      contentType: 'image/webp',
      slot: 'front',
      deps: { fetch: fetchStub },
    });

    expect(result.blobKey).toBe(SIGN_OK.blobKey);
    expect(result.blobUrl).toBe(SIGN_OK.uploadUrl);
    expect(result.bytesUploaded).toBe(2048);
    expect(fetchStub).toHaveBeenCalledTimes(2);
  });

  it('first call is POST sign-upload with correct JSON body', async () => {
    const file = new Blob(['x'], { type: 'image/webp' });
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const fetchStub = vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url, init });
      if (calls.length === 1) return jsonResponse(200, SIGN_OK);
      return new Response('', { status: 200 });
    }) as unknown as typeof globalThis.fetch;

    await uploadCaptureBlob({
      merchantSlug: 'aurora-wellness',
      file,
      filename: 'front.webp',
      contentType: 'image/webp',
      slot: 'front',
      deps: { fetch: fetchStub },
    });

    expect(calls[0].url).toBe('/api/merchants/aurora-wellness/capture/sign-upload');
    expect(calls[0].init?.method).toBe('POST');
    const sentBody = JSON.parse(String(calls[0].init?.body));
    expect(sentBody).toEqual({
      filename: 'front.webp',
      contentType: 'image/webp',
      slot: 'front',
    });
  });

  it('second call PUTs to uploadUrl with Bearer token + Content-Type', async () => {
    const file = new Blob(['x'], { type: 'image/webp' });
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const fetchStub = vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url, init });
      if (calls.length === 1) return jsonResponse(200, SIGN_OK);
      return new Response('', { status: 200 });
    }) as unknown as typeof globalThis.fetch;

    await uploadCaptureBlob({
      merchantSlug: 'aurora-wellness',
      file,
      filename: 'front.webp',
      contentType: 'image/webp',
      slot: 'front',
      deps: { fetch: fetchStub },
    });

    expect(calls[1].url).toBe(SIGN_OK.uploadUrl);
    expect(calls[1].init?.method).toBe('PUT');
    const headers = calls[1].init?.headers as Record<string, string>;
    expect(headers.Authorization).toBe(`Bearer ${SIGN_OK.token}`);
    expect(headers['Content-Type']).toBe('image/webp');
  });

  it('throws UploadBlobError with phase=sign on sign-upload 400', async () => {
    const fetchStub = mockFetchSequence(
      jsonResponse(400, { error: 'bad', code: 'invalid_content_type' }),
    );

    let thrown: unknown;
    try {
      await uploadCaptureBlob({
        merchantSlug: 'aurora-wellness',
        file: new Blob(['x'], { type: 'image/png' }),
        filename: 'front.png',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        contentType: 'image/png' as any,
        slot: 'front',
        deps: { fetch: fetchStub },
      });
    } catch (e) {
      thrown = e;
    }
    expect(thrown).toBeInstanceOf(UploadBlobError);
    if (thrown instanceof UploadBlobError) {
      expect(thrown.phase).toBe('sign');
      expect(thrown.status).toBe(400);
      expect(thrown.code).toBe('invalid_content_type');
    }
  });

  it('throws UploadBlobError with phase=put on PUT 403', async () => {
    const fetchStub = mockFetchSequence(
      jsonResponse(200, SIGN_OK),
      new Response('forbidden', { status: 403 }),
    );

    let thrown: unknown;
    try {
      await uploadCaptureBlob({
        merchantSlug: 'aurora-wellness',
        file: new Blob(['x'], { type: 'image/webp' }),
        filename: 'front.webp',
        contentType: 'image/webp',
        slot: 'front',
        deps: { fetch: fetchStub },
      });
    } catch (e) {
      thrown = e;
    }
    expect(thrown).toBeInstanceOf(UploadBlobError);
    if (thrown instanceof UploadBlobError) {
      expect(thrown.phase).toBe('put');
      expect(thrown.status).toBe(403);
    }
  });

  it('falls back to uploadUrl when PUT response omits Location header', async () => {
    const fetchStub = mockFetchSequence(
      jsonResponse(200, SIGN_OK),
      new Response('', { status: 200 }),
    );

    const result = await uploadCaptureBlob({
      merchantSlug: 'aurora-wellness',
      file: new Blob(['x'], { type: 'image/webp' }),
      filename: 'front.webp',
      contentType: 'image/webp',
      slot: 'front',
      deps: { fetch: fetchStub },
    });
    expect(result.blobUrl).toBe(SIGN_OK.uploadUrl);
  });

  it('URL-encodes the merchant slug', async () => {
    const calls: Array<{ url: string }> = [];
    const fetchStub = vi.fn(async (url: string) => {
      calls.push({ url });
      if (calls.length === 1) return jsonResponse(200, SIGN_OK);
      return new Response('', { status: 200 });
    }) as unknown as typeof globalThis.fetch;

    await uploadCaptureBlob({
      merchantSlug: 'aurora wellness',  // space — should encode
      file: new Blob(['x'], { type: 'image/webp' }),
      filename: 'front.webp',
      contentType: 'image/webp',
      slot: 'front',
      deps: { fetch: fetchStub },
    });
    expect(calls[0].url).toBe('/api/merchants/aurora%20wellness/capture/sign-upload');
  });
});
