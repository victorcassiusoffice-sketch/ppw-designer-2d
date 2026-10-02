import { ClerkProvider, SignIn, useAuth } from '@clerk/clerk-react';
import { useEffect, useRef, useState } from 'react';
import type { AiProviderDraftProps } from './AiProviderDraft';

type Props = AiProviderDraftProps;
export default function AuthenticatedAiDraft({ publishableKey, ...props }: Props & { publishableKey: string }) {
  return <ClerkProvider publishableKey={publishableKey}><AuthenticatedDraft {...props} /></ClerkProvider>;
}
function AuthenticatedDraft({ brief, onDraft, onError, onStart }: Props) {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const [busy, setBusy] = useState(false);
  const [signInOpen, setSignInOpen] = useState(false);
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => { const previous = request.current; request.current = null; previous?.abort(); }, []);
  useEffect(() => { const previous = request.current; request.current = null; previous?.abort(); setBusy(false); }, [brief, isSignedIn]);
  async function generate() {
    if (request.current || !isSignedIn) return;
    onStart?.();
    setBusy(true); const controller = new AbortController(); request.current = controller;
    const timer = window.setTimeout(() => {
      if (request.current !== controller) return;
      request.current = null; controller.abort(); setBusy(false);
      onError('The AI request timed out. Try again, or use Guided layout.');
    }, 28_000);
    try {
      const token = await getToken();
      if (request.current !== controller || controller.signal.aborted) return;
      if (!token) throw new Error('Sign in to use connected AI.');
      const response = await fetch('/api/design-assistant',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify({mode:'ai',brief}),signal:controller.signal});
      const data = await response.json() as {draft?:unknown;error?:string;message?:string};
      if (request.current !== controller || controller.signal.aborted) return;
      if (!response.ok || !data.draft) throw new Error(data.message || data.error || 'AI drafting is unavailable. Your current plan has not changed.');
      onDraft(data.draft);
    } catch (error) { if (request.current===controller) onError(error instanceof Error && error.name==='AbortError' ? 'The AI request timed out or was cancelled. Try again, or use Guided layout.' : error instanceof Error ? error.message : 'AI drafting failed.'); }
    finally { window.clearTimeout(timer); if (request.current===controller) {request.current=null;setBusy(false);} }
  }
  if (!isLoaded) return <p>Loading sign-in…</p>;
  if (!isSignedIn) return <div>{signInOpen ? <><button onClick={()=>setSignInOpen(false)}>Close sign-in</button><SignIn routing="virtual" /></> : <button className="design-primary" onClick={()=>setSignInOpen(true)}>Sign in for AI drafting</button>}<p className="design-fine">Your brief is sent to the configured AI service only when you request a draft.</p></div>;
  return <><button className="design-primary" disabled={busy || !brief.brief.trim()} onClick={()=>void generate()}>{busy?'Preparing your proposal…':'Generate AI proposal'}</button><p className="design-fine">Sends this brief and plot dimensions to the configured AI service. Availability depends on the connected account; your existing plan is not sent.</p></>;
}

