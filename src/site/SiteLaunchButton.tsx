import { lazy, Suspense, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { usePropertyStore } from '../store/propertyStore';
import { useDesignerUIStore } from '../store/designerUIStore';
const SiteWorkspace = lazy(() => import('./SiteEntry'));
/** Only this small launcher is on the initial plan path. */
export function SiteLaunchButton() {
  const [open, setOpen] = useState(false);
  const pending = usePropertyStore((s) => s.property.site?.world !== undefined);
  const view = useDesignerUIStore((s) => s.viewMode);
  useEffect(() => {
    if (!pending) return;
    let stopped = false;
    let scheduled = false;
    let dispose: (() => void) | undefined;
    const waitFor3D =
      view === '3d' || new URLSearchParams(window.location.search).get('view') === '3d';
    const start = () => {
      if (scheduled || stopped || (waitFor3D && !document.querySelector('[data-first-picture-ms]')))
        return;
      scheduled = true;
      observer.disconnect();
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          if (!stopped)
            void import('./hydration')
              .then((module) => {
                if (!stopped) dispose = module.startSiteHydration();
              })
              .catch(() => {
                /* Keep opaque data withheld; explicit Site entry can retry. */
              });
        }),
      );
    };
    const observer = new MutationObserver(start);
    if (waitFor3D)
      observer.observe(document.body, {
        subtree: true,
        attributes: true,
        attributeFilter: ['data-first-picture-ms'],
      });
    start();
    return () => {
      stopped = true;
      observer.disconnect();
      dispose?.();
    };
  }, [pending, view]);
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
