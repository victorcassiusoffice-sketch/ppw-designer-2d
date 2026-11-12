import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import type { DrawingView } from './BoundaryEditor';
import { usePropertyStore } from '../../store/propertyStore';

const Editor = lazy(() => import('./BoundaryEditor'));
export function BoundaryTools({
  view,
  beforeOpen,
}: {
  view: DrawingView;
  beforeOpen?: () => void;
}) {
  const [open, setOpen] = useState(false),
    [initialId, setInitialId] = useState('');
  const hasComponents = usePropertyStore((s) => !!s.property.boundaryComponents?.length);
  const actions = useRef({ view, beforeOpen });
  actions.current = { view, beforeOpen };
  useEffect(() => {
    const element = actions.current.view.element();
    if (!hasComponents || !element) return;
    let active = true;
    let remove: (() => void) | undefined;
    void import('../../designer/componentEditing').then(({ componentOnRay }) => {
      if (!active) return;
      const menu = (event: MouseEvent) => {
        const ray = actions.current.view.ray(event.clientX, event.clientY);
        if (!ray) return;
        const hit = componentOnRay(
          usePropertyStore.getState().property.boundaryComponents ?? [],
          ray.origin,
          ray.direction,
        );
        if (!hit) return;
        event.preventDefault();
        event.stopPropagation();
        actions.current.beforeOpen?.();
        setInitialId(hit.id);
        setOpen(true);
      };
      element.addEventListener('contextmenu', menu, true);
      remove = () => element.removeEventListener('contextmenu', menu, true);
    });
    return () => {
      active = false;
      remove?.();
    };
  }, [hasComponents]);
  return (
    <>
      <button
        type="button"
        data-testid="open-component-tools"
        onClick={() => {
          beforeOpen?.();
          setInitialId('');
          setOpen((v) => !v);
        }}
        aria-expanded={open}
      >
        Components
      </button>
      {open && (
        <Suspense fallback={null}>
          <Editor view={view} initialId={initialId} onClose={() => setOpen(false)} />
        </Suspense>
      )}
    </>
  );
}
