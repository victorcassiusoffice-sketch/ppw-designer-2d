/**
 * Server-side mirror of `src/lib/adminAllowlist.ts`.
 *
 * The Vercel `api/` directory is compiled with a separate tsconfig
 * that can't reach into `src/`, so we keep a tiny mirror here. The
 * Vitest suite (`api/__tests__/adminAllowlist.test.ts`) asserts that
 * both arrays contain the same emails — drift will fail CI before it
 * ships.
 *
 * Add new primary-owner admin emails here AND in
 * `src/lib/adminAllowlist.ts`. Anyone else lands in the `admins` DB
 * table (managed by Vic via `/admin`).
 */

export const ADMIN_EMAIL_ALLOWLIST: readonly string[] = [
  'victorcassius.office@gmail.com',
  'victor@ppwellness.co',
];

export const ADMIN_EMAIL_ALLOWLIST_SET: ReadonlySet<string> = new Set(ADMIN_EMAIL_ALLOWLIST);

export function isAllowlistedAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return ADMIN_EMAIL_ALLOWLIST_SET.has(email.toLowerCase());
}
