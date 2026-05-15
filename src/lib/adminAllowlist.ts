/**
 * Single source of truth for the admin email allowlist.
 *
 * Both the SPA (`src/admin/RequireAdmin.tsx`) and the API
 * (`api/lib/adminAuth.ts` via `api/lib/adminAllowlist.ts`) read from
 * this file so we never drift. Phase 2+ admins beyond Vic land in the
 * `admins` DB table — the allowlist is the hard-coded primary-owner
 * fallback.
 */

export const ADMIN_EMAIL_ALLOWLIST: readonly string[] = [
  'victorcassius.office@gmail.com',
  'victor@ppwellness.co',
];

export function isAllowlistedAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return ADMIN_EMAIL_ALLOWLIST.includes(email.toLowerCase());
}
