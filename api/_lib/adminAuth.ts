/**
 * Admin authentication for `/api/admin/*` endpoints.
 *
 * The client (SPA `/admin/*` routes) signs in via `@clerk/clerk-react`,
 * then sends `Authorization: Bearer <session token>` on every API
 * call. This module verifies that token using `@clerk/backend`'s
 * `verifyToken` (JWKS-based signature check, no network round-trip on
 * cache hit) and resolves it to an email address.
 *
 * A request is authorised iff EITHER:
 *   - the verified email matches `VIC_EMAIL_ALLOWLIST` (hard-coded
 *     primary owner), OR
 *   - the verified Clerk user id exists in the `admins` table with
 *     role `super_admin` or `reviewer`.
 *
 * The DB-table check is the extensibility hook for Phase 2+. For
 * Phase 1 the email-allowlist short-circuits it.
 */

import { verifyToken } from '@clerk/backend';
import type { MerchantStore } from '../_db/merchantStore.js';
import { getDb, schema } from '../_db/client.js';
import { eq } from 'drizzle-orm';
import {
  ADMIN_EMAIL_ALLOWLIST_SET,
  isAllowlistedAdminEmail,
} from './adminAllowlist.js';

/**
 * Re-export kept for backwards compatibility with the Phase 1 tests
 * that asserted on `VIC_EMAIL_ALLOWLIST` directly. New code should
 * call `isAllowlistedAdminEmail()` from `./adminAllowlist.js`.
 */
export const VIC_EMAIL_ALLOWLIST: ReadonlySet<string> = ADMIN_EMAIL_ALLOWLIST_SET;

export interface AuthorisedAdmin {
  clerkUserId: string;
  email: string;
  /** 'allowlist' = matched VIC_EMAIL_ALLOWLIST. 'db' = matched admins table. */
  source: 'allowlist' | 'db';
  /** Role from DB row when source='db'; otherwise 'super_admin' for allowlist. */
  role: 'super_admin' | 'reviewer';
}

export type AdminAuthResult =
  | { ok: true; admin: AuthorisedAdmin }
  | { ok: false; status: 401 | 403 | 500; error: string };

interface MinimalHeaders {
  [k: string]: string | string[] | undefined;
}

function extractBearer(headers: MinimalHeaders): string | null {
  const raw = headers['authorization'] ?? headers['Authorization'];
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value) return null;
  const m = /^Bearer\s+(.+)$/i.exec(value.trim());
  return m ? m[1].trim() : null;
}

interface VerifiedClaims {
  sub?: string;
  email?: string;
}

/**
 * Extracted for tests: turn an Authorization header into either an
 * authorised admin or a structured rejection. Tests pass in a
 * verifier+lookup so we don't need a real Clerk JWKS endpoint.
 */
export async function authoriseAdminRequest(
  headers: MinimalHeaders,
  deps: {
    verify: (token: string) => Promise<VerifiedClaims | null>;
    lookupAdmin: (clerkUserId: string) => Promise<{ role: 'super_admin' | 'reviewer' } | null>;
  },
): Promise<AdminAuthResult> {
  const token = extractBearer(headers);
  if (!token) return { ok: false, status: 401, error: 'Missing Authorization Bearer token.' };

  let claims: VerifiedClaims | null;
  try {
    claims = await deps.verify(token);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Token verification failed.';
    return { ok: false, status: 401, error: msg };
  }
  if (!claims || !claims.sub) {
    return { ok: false, status: 401, error: 'Token did not verify.' };
  }

  const email = (claims.email ?? '').toLowerCase();
  if (isAllowlistedAdminEmail(email)) {
    return {
      ok: true,
      admin: {
        clerkUserId: claims.sub,
        email,
        source: 'allowlist',
        role: 'super_admin',
      },
    };
  }

  // DB allowlist fallback.
  const adminRow = await deps.lookupAdmin(claims.sub);
  if (adminRow) {
    return {
      ok: true,
      admin: {
        clerkUserId: claims.sub,
        email,
        source: 'db',
        role: adminRow.role,
      },
    };
  }
  return { ok: false, status: 403, error: 'You are not authorised for the admin area.' };
}

/**
 * Production-wired verify: uses @clerk/backend's verifyToken with
 * CLERK_SECRET_KEY. Returns null if the token is structurally valid
 * but missing expected claims so callers can produce a consistent 401.
 */
export async function verifyClerkSessionToken(token: string): Promise<VerifiedClaims | null> {
  const secret = process.env.CLERK_SECRET_KEY;
  if (!secret) throw new Error('CLERK_SECRET_KEY not configured');
  const payload = await verifyToken(token, { secretKey: secret });
  if (!payload || typeof payload !== 'object') return null;
  // Clerk JWTs carry the user id in `sub` and the primary email in
  // `email` (when the JWT template is enabled) or via a custom claim.
  const claimsRecord = payload as Record<string, unknown>;
  const sub = typeof claimsRecord.sub === 'string' ? claimsRecord.sub : undefined;
  const email =
    typeof claimsRecord.email === 'string'
      ? claimsRecord.email
      : typeof claimsRecord.primary_email === 'string'
        ? claimsRecord.primary_email
        : undefined;
  return { sub, email };
}

/** Production-wired admin lookup against the `admins` table. */
export async function lookupAdminInDb(
  clerkUserId: string,
): Promise<{ role: 'super_admin' | 'reviewer' } | null> {
  const db = getDb();
  const rows = await db
    .select({ role: schema.admins.role })
    .from(schema.admins)
    .where(eq(schema.admins.clerkUserId, clerkUserId))
    .limit(1);
  return rows[0] ?? null;
}

/**
 * Convenience: full production-wired authorise. Vercel handlers call
 * this directly. The Phase 1 stub uses it; Phase 2 can wrap it for
 * caching / rate limiting.
 */
export async function authoriseAdminWithLive(
  headers: MinimalHeaders,
  _store: MerchantStore,
): Promise<AdminAuthResult> {
  void _store; // reserved for Phase 2 audit-log writes
  return authoriseAdminRequest(headers, {
    verify: verifyClerkSessionToken,
    lookupAdmin: lookupAdminInDb,
  });
}
