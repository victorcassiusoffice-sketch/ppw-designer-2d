import { lazy, Suspense, useEffect, useState } from 'react';
import type { DesignBrief } from '../designer/aiDesignContract';

export interface AiProviderDraftProps {
  brief: DesignBrief;
  onDraft: (draft: unknown) => void;
  onError: (message: string) => void;
  onStart?: () => void;
}
const AuthenticatedAiDraft = lazy(() => import('./AuthenticatedAiDraft'));
type Readiness = 'checking' | 'ready' | 'unconfigured' | 'unavailable';

/** Check real server readiness before asking customers to sign in or loading Clerk. */
export default function AiProviderDraft(props: AiProviderDraftProps) {
  const key = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
  const [readiness, setReadiness] = useState<Readiness>('checking');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!key) return;
    const controller = new AbortController();
    let active = true;
    setReadiness('checking');
    const timeout = window.setTimeout(() => {
      if (!active) return;
      active = false;
      controller.abort();
      setReadiness('unavailable');
    }, 8000);
    void (async () => {
      try {
        const response = await fetch('/api/design-assistant', { method: 'GET', cache: 'no-store', signal: controller.signal });
        if (!response.ok) throw new Error('Readiness unavailable');
        const data: unknown = await response.json();
        if (!data || typeof data !== 'object' || !('aiConfigured' in data) || typeof data.aiConfigured !== 'boolean') throw new Error('Invalid readiness response');
        if (active) setReadiness(data.aiConfigured ? 'ready' : 'unconfigured');
      } catch { if (active) setReadiness('unavailable'); }
      finally { window.clearTimeout(timeout); }
    })();
    return () => { active = false; controller.abort(); window.clearTimeout(timeout); };
  }, [key, attempt]);

  if (!key) return <p className="design-fine" role="status">Connected AI access is not configured on this build. Use Guided layout now, or Connect AI to use your own MCP-compatible assistant.</p>;
  if (readiness === 'checking') return <p className="design-fine" role="status">Checking connected AI availability… Guided layout remains available.</p>;
  if (readiness !== 'ready') return <div>
    <p className="design-fine" role="status">{readiness === 'unconfigured' ? 'Connected AI is not configured on this server.' : 'Connected AI availability could not be verified right now.'} Use Guided layout, or Connect AI to use your own MCP-compatible assistant.</p>
    <button type="button" onClick={() => setAttempt(value => value + 1)}>Retry AI connection</button>
  </div>;
  return <Suspense fallback={<p className="design-fine" role="status">Loading secure AI access…</p>}><AuthenticatedAiDraft {...props} publishableKey={key} /></Suspense>;
}
