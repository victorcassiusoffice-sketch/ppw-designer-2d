import { isAllowlistedAdminEmail } from '../lib/adminAllowlist';
export type AdminGateState =
  | { state: 'loading' }
  | { state: 'signed-out' }
  | { state: 'no-access'; email: string | null }
  | { state: 'authorised'; email: string; via: 'allowlist' | 'metadata' };

interface UserShape {
  primaryEmailAddress?: { emailAddress?: string | null } | null;
  emailAddresses?: ReadonlyArray<{ emailAddress?: string | null }>;
  publicMetadata?: Record<string, unknown> | null;
}

export function decideAdminGate(
  isLoaded: boolean,
  isSignedIn: boolean | undefined,
  user: UserShape | null | undefined,
): AdminGateState {
  if (!isLoaded) return { state: 'loading' };
  if (!isSignedIn || !user) return { state: 'signed-out' };

  const primary =
    user.primaryEmailAddress?.emailAddress?.toLowerCase() ??
    user.emailAddresses?.[0]?.emailAddress?.toLowerCase() ??
    null;

  if (isAllowlistedAdminEmail(primary)) {
    return { state: 'authorised', email: primary ?? '', via: 'allowlist' };
  }

  const role = user.publicMetadata?.['role'];
  if (typeof role === 'string' && role.toLowerCase() === 'admin') {
    return { state: 'authorised', email: primary ?? '', via: 'metadata' };
  }

  return { state: 'no-access', email: primary };
}
