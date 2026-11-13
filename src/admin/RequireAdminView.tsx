import { decideAdminGate } from './adminGate';
/**
 * RequireAdmin — Clerk role gate for `/admin/*` routes.
 *
 * Three states:
 *   1. Clerk still loading      → spinner
 *   2. Signed out               → Clerk <SignIn /> CTA
 *   3. Signed in but not admin  → "no access" notice
 *   4. Signed in and authorised → children render.
 *
 * Authorisation: the user's primary email is in
 * `ADMIN_EMAIL_ALLOWLIST` OR `user.publicMetadata.role === 'admin'`.
 * Backend `adminAuth.ts` enforces the same allowlist; this client-side
 * gate is UX-only — every API call independently re-verifies.
 *
 * `decideAdminGate()` is exported and pure so we can unit-test the
 * three states without a DOM.
 */

import type { ReactNode } from 'react';
import { SignIn, useUser } from '@clerk/clerk-react';

export interface RequireAdminProps {
  children: ReactNode;
}

export default function RequireAdmin({ children }: RequireAdminProps) {
  const { isLoaded, isSignedIn, user } = useUser();
  const decision = decideAdminGate(isLoaded, isSignedIn, user);

  if (decision.state === 'loading') {
    return (
      <main className="min-h-screen bg-ppw-sand text-ppw-ink flex items-center justify-center">
        <p className="text-sm text-ppw-slate">Loading…</p>
      </main>
    );
  }

  if (decision.state === 'signed-out') {
    return (
      <main className="min-h-screen bg-ppw-sand flex items-center justify-center p-6">
        <div className="rounded-lg bg-white p-6 shadow">
          <p className="text-xs uppercase tracking-widest text-ppw-teal mb-3">
            PPW Marketplace Admin
          </p>
          <SignIn routing="virtual" />
        </div>
      </main>
    );
  }

  if (decision.state === 'no-access') {
    return (
      <main className="min-h-screen bg-ppw-sand flex items-center justify-center p-6">
        <div className="rounded-lg bg-white p-6 shadow max-w-md">
          <h1 className="font-serif text-2xl mb-3 text-ppw-ink">No admin access</h1>
          <p className="text-sm text-ppw-slate mb-3">
            You're signed in as <code>{decision.email ?? '(unknown)'}</code> but this account is
            not authorised for the PPW Marketplace admin area.
          </p>
          <p className="text-xs text-ppw-slate">
            If you should have access, contact Vic at{' '}
            <a className="text-ppw-coral" href="mailto:victor@ppwellness.co">
              victor@ppwellness.co
            </a>
            .
          </p>
        </div>
      </main>
    );
  }

  return <>{children}</>;
}
