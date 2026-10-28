import { useEffect, useRef, useState } from 'react';
import { useWorkspaceFocus } from '../hooks/useWorkspaceFocus';
import SiteWorkspace from './SiteWorkspace';
import { clearPreviewLive, previewLiveRequested, verifyPreviewLive } from './previewMode';
import { hydrateCurrentSite, siteHydrationWarning } from './hydration';

function WaitingForSite({ checking, onClose }: { checking: boolean; onClose: () => void }) {
  const host = useRef<HTMLDivElement>(null);
  useWorkspaceFocus(host, onClose, { fallbackFocusSelector: '[aria-label="Site from the map"]' });
  return (
    <div
      ref={host}
      className="site-loading"
      role="dialog"
      aria-modal="true"
      aria-label="Opening Site"
    >
      <span role="status">
        {checking ? 'Checking preview map access…' : 'Preparing saved Site data…'}
      </span>{' '}
      <button onClick={onClose}>Cancel</button>
    </div>
  );
}

/** Environment check happens only after an explicit Site click, never during first picture. */
export default function SiteEntry({ onClose, demo }: { onClose: () => void; demo: boolean }) {
  const [hydrated, setHydrated] = useState(false);
  const [warning, setWarning] = useState<string>();
  useEffect(() => {
    hydrateCurrentSite();
    setWarning(siteHydrationWarning());
    setHydrated(true);
  }, []);
  const requested = demo && previewLiveRequested(window.location.pathname, window.location.search);
  const [mode, setMode] = useState<'checking' | 'live' | 'offline'>(
    requested ? 'checking' : 'offline',
  );
  useEffect(() => {
    if (!requested) return;
    const controller = new AbortController();
    void verifyPreviewLive(controller.signal).then((allowed) => {
      if (!controller.signal.aborted) setMode(allowed ? 'live' : 'offline');
    });
    return () => {
      controller.abort();
      clearPreviewLive();
    };
  }, [requested]);
  if (!hydrated || mode === 'checking')
    return <WaitingForSite checking={mode === 'checking'} onClose={onClose} />;
  return (
    <SiteWorkspace
      onClose={onClose}
      demo={demo && mode !== 'live'}
      previewLive={mode === 'live'}
      initialWarning={warning}
    />
  );
}
