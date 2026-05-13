/**
 * Layout wrapper for `/admin/*` routes.
 *
 * - Mounts `<ClerkProvider>` lazily — only when an admin route is
 *   actually visited — so the public storefront bundle doesn't pull
 *   in Clerk for unauthenticated visitors.
 * - Surfaces SignIn / SignedOut state with Clerk's hosted components.
 * - Falls back to a clear "Clerk not configured" notice if
 *   `VITE_CLERK_PUBLISHABLE_KEY` is missing — better than a blank screen.
 */

import { ClerkProvider, SignIn, SignedIn, SignedOut } from '@clerk/clerk-react';
import { Outlet } from 'react-router-dom';

// Vite inlines the value at build time when accessed directly on
// `import.meta.env.<VAR>` — keep the dotted reference verbatim so
// production builds embed the key (same lesson as Hotfix 3 for
// VITE_STRIPE_PUBLISHABLE_KEY).
const CLERK_PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

export default function AdminLayout() {
  if (!CLERK_PUBLISHABLE_KEY) {
    return (
      <main className="min-h-screen bg-ppw-sand text-ppw-ink p-8">
        <div className="mx-auto max-w-xl rounded-lg bg-white p-6 shadow">
          <h1 className="font-serif text-2xl mb-3">Admin unavailable</h1>
          <p className="text-sm text-ppw-ink/80">
            Clerk authentication is not configured (missing{' '}
            <code>VITE_CLERK_PUBLISHABLE_KEY</code>). Set it in the Vercel project
            environment variables and redeploy.
          </p>
        </div>
      </main>
    );
  }

  return (
    <ClerkProvider publishableKey={CLERK_PUBLISHABLE_KEY}>
      <SignedIn>
        <Outlet />
      </SignedIn>
      <SignedOut>
        <main className="min-h-screen bg-ppw-sand flex items-center justify-center p-6">
          <div className="rounded-lg bg-white p-6 shadow">
            <p className="text-xs uppercase tracking-widest text-ppw-teal mb-3">
              PPW Marketplace Admin
            </p>
            {/*
             * `routing="virtual"` keeps the SignIn flow self-contained
             * — no nested sub-routes required from React Router. After
             * sign-in completes Clerk re-renders this tree and SignedIn
             * takes over, rendering the merchant queue via <Outlet />.
             */}
            <SignIn routing="virtual" />
          </div>
        </main>
      </SignedOut>
    </ClerkProvider>
  );
}
