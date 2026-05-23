/**
 * Wellness-Designer-App (c) part 2 — browser-side product-image uploader.
 *
 * Mirror of `src/lib/capture/uploadBlob.ts` (DT-03 capture-pipeline)
 * but scoped to the merchant Add-Product flow. Two-phase:
 *
 *   1. POST /api/merchants/:slug/products/upload-image
 *      body: { filename, contentType }
 *      ◀── { uploadUrl, token, blobKey, expiresAt }
 *   2. PUT  uploadUrl  with Authorization: Bearer {token}
 *      body: the raw PNG/JPG bytes
 *      ◀── 200 OK  → returns the final blob URL
 *
 * The Vercel Function payload limit (4.5 MB) is sidestepped — product
 * photos can be up to 5 MiB enforced at the token layer.
 *
 * Throws `UploadProductImageError` on either sign-grant failure or
 * PUT failure; the `.phase` field tells the caller which leg failed.
 */

export type ProductImageContentType = 'image/png' | 'image/jpeg';

export interface SignUploadResponse {
  uploadUrl: string;
  token: string;
  blobKey: string;
  expiresAt: string;
}

export interface UploadProductImageResult {
  blobKey: string;
  blobUrl: string;
  bytesUploaded: number;
}

export class UploadProductImageError extends Error {
  readonly phase: 'sign' | 'put';
  readonly status?: number;
  readonly code?: string;
  constructor(message: string, opts: { phase: 'sign' | 'put'; status?: number; code?: string }) {
    super(message);
    this.name = 'UploadProductImageError';
    this.phase = opts.phase;
    this.status = opts.status;
    this.code = opts.code;
  }
}

export interface UploadDeps {
  /** fetch impl — defaults to `globalThis.fetch`. Injected by tests. */
  fetch?: typeof globalThis.fetch;
  /** Origin override. Defaults to '' (same-origin). */
  origin?: string;
}

export async function uploadProductImageBlob(input: {
  merchantSlug: string;
  file: Blob;
  filename: string;
  contentType: ProductImageContentType;
  deps?: UploadDeps;
}): Promise<UploadProductImageResult> {
  const fetchImpl = input.deps?.fetch ?? globalThis.fetch;
  const origin = input.deps?.origin ?? '';

  // ─── Phase 1: token grant ──────────────────────────────────────────
  const signRes = await fetchImpl(
    `${origin}/api/merchants/${encodeURIComponent(input.merchantSlug)}/products/upload-image`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filename: input.filename,
        contentType: input.contentType,
      }),
    },
  );
  if (!signRes.ok) {
    let code: string | undefined;
    try {
      const errBody = (await signRes.json()) as { code?: string };
      code = errBody.code;
    } catch {
      // Body parse failure — leave code undefined.
    }
    throw new UploadProductImageError(
      `sign-upload failed (HTTP ${signRes.status})`,
      { phase: 'sign', status: signRes.status, code },
    );
  }
  const sign = (await signRes.json()) as SignUploadResponse;

  // ─── Phase 2: direct PUT to Vercel Blob ───────────────────────────
  const putRes = await fetchImpl(sign.uploadUrl, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${sign.token}`,
      'Content-Type': input.contentType,
      'x-content-type': input.contentType,
    },
    body: input.file,
  });
  if (!putRes.ok) {
    throw new UploadProductImageError(
      `blob PUT failed (HTTP ${putRes.status})`,
      { phase: 'put', status: putRes.status },
    );
  }

  const blobUrl = putRes.headers.get('location') ?? sign.uploadUrl;
  return {
    blobKey: sign.blobKey,
    blobUrl,
    bytesUploaded: input.file.size,
  };
}
