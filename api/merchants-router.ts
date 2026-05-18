/**
 * Catch-all merchants router — single Vercel function for merchant-side
 * + capture-pipeline endpoints.
 *
 * Vercel Hobby tier caps at 12 serverless functions per deployment.
 * Sims-Parity DT-02 introduces this catchall and absorbs the prior
 * `api/merchants/signup.ts` standalone lambda so the net function count
 * stays at 12. Future Sims-Parity DTs fold further capture endpoints
 * here per `MASTER-DATA-FLOW.md §7`:
 *
 *   POST   /api/merchants/signup                   → signup            (DT-02 absorbed prior lambda)
 *   GET    /api/capture/reference-page.pdf         → referencePage     (DT-02)
 *   POST   /api/merchants/:slug/capture/sign-upload → signUpload       (DT-03 — pending)
 *   POST   /api/merchants/:slug/capture/calibrate   → calibrate        (DT-04 — pending)
 *   GET    /api/capture/reference-page-v2.pdf      → referencePage v2  (DT-20 — pending)
 *
 * Vercel routes here via the rewrites in `vercel.json`:
 *   /api/merchants/signup          → /api/merchants-router
 *   /api/capture/reference-page.pdf → /api/merchants-router
 */

import { Buffer } from 'node:buffer';
import { handler as signupHandler } from './lib/merchants/signup.js';
import {
  generateReferencePagePdf,
  generateReferencePageV2Pdf,
  REFERENCE_PAGE_HEADERS,
  REFERENCE_PAGE_V2_HEADERS,
} from './lib/capture/referencePage.js';
import { handler as signUploadHandler } from './lib/capture/signUpload.js';
import { handler as calibrateHandler } from './lib/capture/calibrateHandler.js';
import { withSentry } from './lib/sentry.js';

interface MinimalReq {
  method?: string;
  url?: string;
  headers: Record<string, string | string[] | undefined>;
  query?: Record<string, string | string[] | undefined>;
  body?: unknown;
}
interface MinimalRes {
  setHeader(name: string, value: string): void;
  status(code: number): MinimalRes;
  end(payload?: string | Buffer): void;
  json(body: unknown): void;
  send?(payload: Buffer | string): void;
}

/**
 * Pure path parser — exported for unit testing. Strips the leading
 * `/api` and trailing slashes, splits on `/`, returns segments.
 */
export function pathSegments(rawUrl: string | undefined): string[] {
  if (!rawUrl) return [];
  const path = rawUrl.split('?')[0] ?? '';
  const parts = path.split('/').filter(Boolean);
  // Drop leading "api" if present (rewrite preserves it).
  if (parts[0] === 'api') parts.shift();
  return parts;
}

async function referencePageGet(_req: MinimalReq, res: MinimalRes): Promise<void> {
  const bytes = generateReferencePagePdf();
  const buf = Buffer.from(bytes);
  res.setHeader('Content-Type', REFERENCE_PAGE_HEADERS.contentType);
  res.setHeader('Cache-Control', REFERENCE_PAGE_HEADERS.cacheControl);
  res.setHeader('Content-Disposition', REFERENCE_PAGE_HEADERS.contentDisposition);
  res.setHeader('Content-Length', String(buf.length));
  res.status(200);
  // Vercel's adapter accepts either res.send(Buffer) or res.end(Buffer).
  if (typeof res.send === 'function') {
    res.send(buf);
  } else {
    res.end(buf);
  }
}

async function referencePageV2Get(_req: MinimalReq, res: MinimalRes): Promise<void> {
  const bytes = generateReferencePageV2Pdf();
  const buf = Buffer.from(bytes);
  res.setHeader('Content-Type', REFERENCE_PAGE_V2_HEADERS.contentType);
  res.setHeader('Cache-Control', REFERENCE_PAGE_V2_HEADERS.cacheControl);
  res.setHeader('Content-Disposition', REFERENCE_PAGE_V2_HEADERS.contentDisposition);
  res.setHeader('Content-Length', String(buf.length));
  res.status(200);
  if (typeof res.send === 'function') {
    res.send(buf);
  } else {
    res.end(buf);
  }
}

async function rootHandler(req: MinimalReq, res: MinimalRes): Promise<void> {
  const segments = pathSegments(req.url);

  // GET /api/capture/reference-page.pdf
  if (segments[0] === 'capture' && segments[1] === 'reference-page.pdf') {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.setHeader('Allow', 'GET, HEAD');
      res.status(405).end();
      return;
    }
    return referencePageGet(req, res);
  }

  // GET /api/capture/reference-page-v2.pdf (DT-20 ArUco variant)
  if (segments[0] === 'capture' && segments[1] === 'reference-page-v2.pdf') {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.setHeader('Allow', 'GET, HEAD');
      res.status(405).end();
      return;
    }
    return referencePageV2Get(req, res);
  }

  // POST /api/merchants/signup
  if (segments[0] === 'merchants' && segments[1] === 'signup') {
    return signupHandler(req, res);
  }

  // POST /api/merchants/:slug/capture/sign-upload
  if (
    segments[0] === 'merchants'
    && typeof segments[1] === 'string'
    && segments[2] === 'capture'
    && segments[3] === 'sign-upload'
  ) {
    const slug = segments[1];
    return signUploadHandler(slug, req, res);
  }

  // POST /api/merchants/:slug/capture/calibrate
  if (
    segments[0] === 'merchants'
    && typeof segments[1] === 'string'
    && segments[2] === 'capture'
    && segments[3] === 'calibrate'
  ) {
    const slug = segments[1];
    return calibrateHandler(slug, req, res);
  }

  res.status(404).json({
    error: `unknown merchants-router path: /${segments.join('/')}`,
  });
}

export default withSentry(rootHandler);
