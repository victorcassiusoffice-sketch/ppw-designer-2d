/**
 * Sims-Parity DT-03 — pre-signed Vercel Blob upload handler.
 *
 * POST /api/merchants/:slug/capture/sign-upload
 *   body: { filename, contentType, slot }
 *   ◀── { uploadUrl, token, blobKey, expiresAt }
 *
 * The client then PUTs the photo bytes directly to Vercel Blob using
 * the returned token — the 4.5 MB Vercel Function payload limit is
 * sidestepped entirely. Subsequent DT-04 `/calibrate` ingests the
 * `blobKey` produced here into the `CapturePacket.photoFront.blobUrl`.
 *
 * Path enumeration (slot):
 *   • front — required photo
 *   • side  — optional, mirrored-from-front fallback in renderer
 *   • back  — optional, same fallback policy
 *
 * Content-type allowlist:
 *   • image/webp (preferred, camera modal default)
 *   • image/jpeg (fallback on older Safari)
 *
 * Lifetime: client token valid for 60 seconds. After 60s the merchant
 * must POST sign-upload again.
 *
 * Honoured constraints:
 *   • Hobby 12-fn cap — folded into merchants-router (zero net add).
 *   • Free tier — Vercel Blob ≤ 5 GB project quota.
 *   • HARD STOP — token is opaque + scoped to the single pathname;
 *     never logged; only the blobKey appears in audit metadata.
 *   • Privacy — blob pathnames are scoped per-merchant (`merchants/:slug/…`).
 */

import { generateClientTokenFromReadWriteToken } from '@vercel/blob/client';

const ALLOWED_CONTENT_TYPES = ['image/webp', 'image/jpeg'] as const;
type AllowedContentType = (typeof ALLOWED_CONTENT_TYPES)[number];

const ALLOWED_SLOTS = ['front', 'side', 'back'] as const;
export type CaptureSlot = (typeof ALLOWED_SLOTS)[number];

/** Token lifetime — 60 seconds is plenty for one phone upload. */
export const SIGN_UPLOAD_TOKEN_TTL_MS = 60_000;

export interface SignUploadRequest {
  filename: string;
  contentType: string;
  slot: string;
}

export interface SignUploadResponse {
  uploadUrl: string;
  token: string;
  blobKey: string;
  expiresAt: string;
}

export interface SignUploadDeps {
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

function isAllowedSlot(s: unknown): s is CaptureSlot {
  return typeof s === 'string' && (ALLOWED_SLOTS as readonly string[]).includes(s);
}

/**
 * Strict slug validation — kebab-case, 2–80 chars, matches the
 * merchants_slug_kebab_ck CHECK constraint from migration 0010.
 */
function isValidSlug(s: unknown): s is string {
  if (typeof s !== 'string') return false;
  if (s.length < 2 || s.length > 80) return false;
  return /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(s);
}

/** Returns the file extension that matches a given content type. */
function extensionForContentType(ct: AllowedContentType): string {
  switch (ct) {
    case 'image/webp':
      return 'webp';
    case 'image/jpeg':
      return 'jpg';
  }
}

export type SignUploadValidationError =
  | { ok: false; status: 400; code: 'invalid_body'; message: string }
  | { ok: false; status: 400; code: 'invalid_slug'; message: string }
  | { ok: false; status: 400; code: 'invalid_content_type'; message: string }
  | { ok: false; status: 400; code: 'invalid_slot'; message: string }
  | { ok: false; status: 500; code: 'blob_token_missing'; message: string };

/**
 * Pure handler core — exported so tests can exercise validation +
 * token-grant logic without spinning up a Vercel request.
 */
export async function signUpload(
  slug: string,
  body: unknown,
  deps: SignUploadDeps,
): Promise<{ ok: true; status: 200; response: SignUploadResponse } | SignUploadValidationError> {
  if (!isValidSlug(slug)) {
    return { ok: false, status: 400, code: 'invalid_slug', message: 'merchant slug missing or malformed' };
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
  if (!isAllowedSlot(raw.slot)) {
    return {
      ok: false,
      status: 400,
      code: 'invalid_slot',
      message: `slot must be one of: ${ALLOWED_SLOTS.join(', ')}`,
    };
  }
  if (typeof raw.filename !== 'string' || raw.filename.length < 1 || raw.filename.length > 240) {
    return { ok: false, status: 400, code: 'invalid_body', message: 'filename must be a 1–240 char string' };
  }

  const now = deps.now ?? Date.now;
  const nowMs = now();
  const expiresAt = new Date(nowMs + SIGN_UPLOAD_TOKEN_TTL_MS).toISOString();

  const suffix = deps.randomSuffix ? deps.randomSuffix() : globalThis.crypto.randomUUID().slice(0, 8);
  const ext = extensionForContentType(raw.contentType);
  const blobKey = `merchants/${slug}/capture/${nowMs}-${raw.slot}-${suffix}.${ext}`;

  const clientToken = await generateClientTokenFromReadWriteToken({
    pathname: blobKey,
    token: deps.readWriteToken,
    validUntil: nowMs + SIGN_UPLOAD_TOKEN_TTL_MS,
    allowedContentTypes: [raw.contentType],
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
 * HTTP handler — adapts the pure `signUpload` core to the Vercel
 * request/response shape. Wired up by `api/merchants-router.ts`.
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

  const result = await signUpload(slug, body, { readWriteToken });
  if (!result.ok) {
    res.status(result.status).json({ error: result.message, code: result.code });
    return;
  }
  res.status(200).json(result.response);
}
