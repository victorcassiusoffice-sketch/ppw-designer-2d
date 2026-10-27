import { lazy, Suspense, useState } from 'react';
import { createPortal } from 'react-dom';
const SiteWorkspace = lazy(() => import('./SiteWorkspace'));
/** Only this small launcher is on the initial plan path. */
export function SiteLaunchButton() {
  const [open, setOpen] = useState(false);
  const demo = /^\/demo(?:\/|$)/.test(window.location.pathname);
  if (demo && new URLSearchParams(window.location.search).get('site') !== '1') return null;
  return (
    <>
      <button
        type="button"
        className="city-launch"
        aria-label="Site from the map"
        onClick={() => setOpen(true)}
      >
        <span aria-hidden="true">⌖</span>
        <span>Site</span>
      </button>
      {open &&
        createPortal(
          <Suspense
            fallback={
              <div role="status" className="site-loading">
                Opening Site… <button onClick={() => setOpen(false)}>Cancel</button>
              </div>
            }
          >
            <SiteWorkspace onClose={() => setOpen(false)} demo={demo} />
          </Suspense>,
          document.body,
        )}
    </>
  );
}
