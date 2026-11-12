import { useToolPanel } from '../hooks/useToolPanel';
import { lazy, Suspense, useEffect } from 'react';
const Panel = lazy(() => import('./SharedBuildPanel'));
export function SharedBuildButton() {
  const [open, setOpen] = useToolPanel();
  useEffect(() => {
    try {
      if (sessionStorage.getItem('olb-live-build-v1'))
        void import('./client').then((m) => m.resume());
    } catch {
      /* Storage is optional for a visit. */
    }
  }, []);
  return (
    <>
      <button type="button" aria-expanded={open} onClick={() => setOpen(!open)}>
        Shared build
      </button>
      {open && (
        <Suspense fallback={null}>
          <Panel close={() => setOpen(false)} />
        </Suspense>
      )}
    </>
  );
}
