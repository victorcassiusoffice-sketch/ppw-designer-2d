import { ClerkProvider, SignIn, useAuth } from '@clerk/clerk-react';
import { useEffect, useMemo, useState } from 'react';
import { sharedSpecsApi, type SharedSpecsApi } from '../lib/sharedSpecsApi';

export interface SharedSession {
  api: SharedSpecsApi;
  userId: string;
}
export default function SharedProjectConnection({
  onSession,
}: {
  onSession: (session: SharedSession | null) => void;
}) {
  const key = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
  if (!key)
    return (
      <p className="shared-notice">
        Shared sign-in is not configured on this deployment. The local pilot remains available; it
        is not a shared database.
      </p>
    );
  return (
    <ClerkProvider publishableKey={key}>
      <Connection onSession={onSession} />
    </ClerkProvider>
  );
}
function Connection({ onSession }: { onSession: (session: SharedSession | null) => void }) {
  const { isLoaded, isSignedIn, userId, getToken, signOut } = useAuth();
  const [login, setLogin] = useState(false);
  const api = useMemo(() => sharedSpecsApi(getToken), [getToken]);
  useEffect(() => {
    onSession(isSignedIn && userId ? { api, userId } : null);
    return () => onSession(null);
  }, [api, isSignedIn, userId, onSession]);
  if (!isLoaded) return <p>Loading sign-in…</p>;
  if (isSignedIn)
    return (
      <div className="shared-inline">
        <span>Signed in · {userId}</span>
        <button onClick={() => void signOut()}>Sign out</button>
      </div>
    );
  return (
    <div>
      <button onClick={() => setLogin(!login)}>
        {login ? 'Close sign-in' : 'Sign in to shared projects'}
      </button>
      {login && <SignIn routing="virtual" />}
    </div>
  );
}
