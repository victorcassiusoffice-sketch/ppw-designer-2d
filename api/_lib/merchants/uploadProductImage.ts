/**
 * Wellness-Designer-App chain · deliverable (c) —
 * pre-signed Vercel Blob upload handler for merchant product images.
 *
 * POST /api/merchants/:slug/products/upload-image
 *   body: { filename, contentType }
 *   ◀── { uploadUrl, token, blobKey, expiresAt }
 *
 * The merchant's "Add product" form posts here, gets a short-lived
 * client token, then PUTs the PNG/JPG bytes directly to Vercel Blob
 * via @vercel/blob/client. The resulting `blobKey` is then submitted
 * alongside the rest of the product metadata to the merchant-product
 * write path so it lands in `merchant_products.image_url`.
 *
 * Sibling to `lib/capture/signUpload.ts` (which handles the photo-
 * capture pipeline DT-03). Both folded into `merchants-router.ts`
 * to keep the Vercel Hobby 12/12 lambda cap intact.
 *
 * Content-type allowlist (chain spec deliverable (c)):
 *   • image/png
 *   • image/jpeg
 *
 * Size cap: 5 MiB. Enforced on the signed token via
 * `maximumSizeInBytes` so the client SDK refuses oversized uploads
 * before any bytes hit Blob.
 *
 * Lifetime: 60 seconds. After 60s the merchant re-posts.
 *
 * Privacy: blob pathnames are scoped per-merchant
 * (`merchants/:slug/products/…`). Random 8-char suffix in the
 * filename prevents collision when a merchant re-uploads the same SKU.
 */

import { generateClientTokenFromReadWriteToken } from '@vercel/blob/client';

const ALLOWED_CONTENT_TYPES = ['image/png', 'image/jpeg'] as const;
type AllowedContentType = (typeof ALLOWED_CONTENT_TYPES)[number];

/** Token lifetime — 60 seconds. */
export const UPLOAD_PRODUCT_IMAGE_TOKEN_TTL_MS = 60_000;

/** Max product image size: 5 MiB. */
export const UPLOAD_PRODUCT_IMAGE_MAX_BYTES = 5 * 1024 * 1024;

export interface UploadProductImageRequest {
  filename: string;
  contentType: string;
}

export interface UploadProductImageResponse {
  uploadUrl: string;
  token: string;
  blobKey: string;
  expiresAt: string;
}

export interface UploadProductImageDeps {
  /** Vercel Blob read-write token. Inject for tests. */
  readWriteToken: string;
  /** Stable timestamp source (default = Date.now). Inject for deterministic tests. */
  now?: () => number;
  /** Stable random suffix source (default = crypto.randomUUID slice). Inject for tests. */
  randomSuffix?: () => string;
}

function isAllowedContentType(s: unknown): s is AllowedContentType {
  return typeof s === 'string' && (ALLOWED_CONTENT_TYPES as readonly string[]).includes(s);
}

/**
 * Strict slug validation — kebab-case, 2–80 chars, matches the
 * `merchants_slug_kebab_ck` CHECK constraint from migration 0010.
 */
function isValidSlug(s: unknown): s is string {
  if (typeof s !== 'string') return false;
  if (s.length < 2 || s.length > 80) return false;
  return /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(s);
}

function extensionForContentType(ct: AllowedContentType): string {
  switch (ct) {
    case 'image/png':
      return 'png';
    case 'image/jpeg':
      return 'jpg';
  }
}

export type UploadProductImageValidationError =
  | { ok: false; status: 400; code: 'invalid_body'; message: string }
  | { ok: false; status: 400; code: 'invalid_slug'; message: string }
  | { ok: false; status: 400; code: 'invalid_content_type'; message: string }
  | { ok: false; status: 500; code: 'blob_token_missing'; message: string };

/**
 * Pure handler core — exported for unit tests so validation and the
 * token-grant call can be exercised without spinning up a Vercel
 * request.
 */
export async function uploadProductImage(
  slug: string,
  body: unknown,
  deps: UploadProductImageDeps,
): Promise<
  | { ok: true; status: 200; response: UploadProductImageResponse }
  | UploadProductImageValidationError
> {
  if (!isValidSlug(slug)) {
    return {
      ok: false,
      status: 400,
      code: 'invalid_slug',
      message: 'merchant slug missing or malformed',
    };
  }
  if (!body || typeof body !== 'object') {
    return { ok: false, status: 400, code: 'invalid_body', message: 'body must be a JSON object' };
  }
  const raw = body as Record<string, unknown>;
  if (!isAllowedContentType(raw.contentType)) {
    return {
      ok: false,
      status: 400,
      code: 'invalid_content_type',
      message: `contentType must be one of: ${ALLOWED_CONTENT_TYPES.join(', ')}`,
    };
  }
  if (typeof raw.filename !== 'string' || raw.filename.length < 1 || raw.filename.length > 240) {
    return {
      ok: false,
      status: 400,
      code: 'invalid_body',
      message: 'filename must be a 1–240 char string',
    };
  }

  const now = deps.now ?? Date.now;
  const nowMs = now();
  const expiresAt = new Date(nowMs + UPLOAD_PRODUCT_IMAGE_TOKEN_TTL_MS).toISOString();

  const suffix = deps.randomSuffix
    ? deps.randomSuffix()
    : globalThis.crypto.randomUUID().slice(0, 8);
  const ext = extensionForContentType(raw.contentType);
  const blobKey = `merchants/${slug}/products/${nowMs}-${suffix}.${ext}`;

  const clientToken = await generateClientTokenFromReadWriteToken({
    pathname: blobKey,
    token: deps.readWriteToken,
    validUntil: nowMs + UPLOAD_PRODUCT_IMAGE_TOKEN_TTL_MS,
    allowedContentTypes: [raw.contentType],
    maximumSizeInBytes: UPLOAD_PRODUCT_IMAGE_MAX_BYTES,
    addRandomSuffix: false,
  });

  const uploadUrl = `https://blob.vercel-storage.com/${blobKey}`;

  return {
    ok: true,
    status: 200,
    response: { uploadUrl, token: clientToken, blobKey, expiresAt },
  };
}

interface MinimalReq {
  method?: string;
  url?: string;
  headers: Record<string, string | string[] | undefined>;
  body?: unknown;
}
interface MinimalRes {
  setHeader(name: string, value: string): void;
  status(code: number): MinimalRes;
  end(payload?: string): void;
  json(body: unknown): void;
}

async function readJsonBody(req: MinimalReq): Promise<unknown> {
  const b = req.body;
  if (b === undefined || b === null) return {};
  if (typeof b === 'object' && !Buffer.isBuffer(b)) return b;
  if (typeof b === 'string') {
    try {
      return JSON.parse(b);
    } catch {
      return null;
    }
  }
  if (Buffer.isBuffer(b)) {
    try {
      return JSON.parse(b.toString('utf8'));
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * HTTP handler — adapts the pure `uploadProductImage` core to the
 * Vercel request/response shape. Wired up by `api/merchants-router.ts`.
 */
export async function handler(
  slug: string,
  req: MinimalReq,
  res: MinimalRes,
): Promise<void> {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).end();
    return;
  }

  const readWriteToken = process.env.BLOB_READ_WRITE_TOKEN;
  if (!readWriteToken) {
    res.status(500).json({
      error: 'blob storage is not configured (BLOB_READ_WRITE_TOKEN missing)',
    });
    return;
  }

  const body = await readJsonBody(req);
  if (body === null) {
    res.status(400).json({ error: 'body must be valid JSON' });
    return;
  }

  const result = await uploadProductImage(slug, body, { readWriteToken });
  if (!result.ok) {
    res.status(result.status).json({ error: result.message, code: result.code });
    return;
  }
  res.status(200).json(result.response);
}
