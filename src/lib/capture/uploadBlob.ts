/**
 * Sims-Parity DT-03 — browser-side Vercel Blob uploader.
 *
 * The CaptureModal (DT-08 ReviewSubmit) invokes this util after the
 * merchant approves the captured photo. The flow is two-phase:
 *
 *   1. POST /api/merchants/:slug/capture/sign-upload
 *      body: { filename, contentType, slot }
 *      ◀── { uploadUrl, token, blobKey, expiresAt }
 *   2. PUT  uploadUrl  with Authorization: Bearer {token}
 *      body: the raw image bytes
 *      ◀── 200 OK
 *
 * The Vercel Function payload limit (4.5 MB) is sidestepped — phone
 * captures are routinely 1–3 MB.
 *
 * Honoured constraints:
 *   • Free-tier — Vercel Blob ≤ 5 GB project quota.
 *   • Tick 35 cart contract preserved (no cart-side interactions here).
 *   • V4-AU-1 palette — N/A (this is pure data-plane code, no UI).
 */

export type CaptureSlot = 'front' | 'side' | 'back';

export type CaptureContentType = 'image/webp' | 'image/jpeg';

export interface SignUploadResponse {
  uploadUrl: string;
  token: string;
  blobKey: string;
  expiresAt: string;
}

export interface UploadCaptureBlobResult {
  blobKey: string;
  blobUrl: string;
  bytesUploaded: number;
}

export class UploadBlobError extends Error {
  readonly phase: 'sign' | 'put';
  readonly status?: number;
  readonly code?: string;
  constructor(message: string, opts: { phase: 'sign' | 'put'; status?: number; code?: string }) {
    super(message);
    this.name = 'UploadBlobError';
    this.phase = opts.phase;
    this.status = opts.status;
    this.code = opts.code;
  }
}

export interface UploadBlobDeps {
  /** fetch impl — defaults to `globalThis.fetch`. Injected by tests. */
  fetch?: typeof globalThis.fetch;
  /** Origin override. Defaults to '' (same-origin). */
  origin?: string;
}

/**
 * Upload a single capture photo end-to-end.
 *
 * Throws `UploadBlobError` on either sign-grant failure or PUT failure;
 * the `.phase` field tells the caller which leg failed so the UI can
 * surface "calibration server unreachable" vs "blob storage offline".
 */
export async function uploadCaptureBlob(input: {
  merchantSlug: string;
  file: Blob;
  filename: string;
  contentType: CaptureContentType;
  slot: CaptureSlot;
  /**
   * Merchant magic-link session token — the sign-grant endpoint now
   * requires `Authorization: Bearer <token>` matching the merchant slug
   * (review P1: unauthenticated Blob-token minting closed). Read from
   * the RequireMerchant stored session.
   */
  sessionToken?: string;
  deps?: UploadBlobDeps;
}): Promise<UploadCaptureBlobResult> {
  const fetchImpl = input.deps?.fetch ?? globalThis.fetch;
  const origin = input.deps?.origin ?? '';

  // ─── Phase 1: token grant ──────────────────────────────────────────
  const signRes = await fetchImpl(
    `${origin}/api/merchants/${encodeURIComponent(input.merchantSlug)}/capture/sign-upload`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(input.sessionToken ? { Authorization: `Bearer ${input.sessionToken}` } : {}),
      },
      body: JSON.stringify({
        filename: input.filename,
        contentType: input.contentType,
        slot: input.slot,
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
    throw new UploadBlobError(
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
    throw new UploadBlobError(
      `blob PUT failed (HTTP ${putRes.status})`,
      { phase: 'put', status: putRes.status },
    );
  }

  // Vercel Blob returns the final URL in Location, falling back to
  // the uploadUrl itself when no rewrite occurs.
  const blobUrl = putRes.headers.get('location') ?? sign.uploadUrl;

  return {
    blobKey: sign.blobKey,
    blobUrl,
    bytesUploaded: input.file.size,
  };
}
