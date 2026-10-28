import { useEffect, useState } from 'react';
import SiteWorkspace from './SiteWorkspace';
import { clearPreviewLive, previewLiveRequested, verifyPreviewLive } from './previewMode';
import { hydrateCurrentSite, siteHydrationWarning } from './hydration';

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
    return (
      <div className="site-loading" role="status">
        {mode === 'checking' ? 'Checking preview map access…' : 'Preparing saved Site data…'}{' '}
        <button onClick={onClose}>Cancel</button>
      </div>
    );
  return (
    <SiteWorkspace
      onClose={onClose}
      demo={demo && mode !== 'live'}
      previewLive={mode === 'live'}
      initialWarning={warning}
    />
  );
}
