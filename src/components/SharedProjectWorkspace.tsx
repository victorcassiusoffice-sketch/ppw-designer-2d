import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { usePropertyStore } from '../store/propertyStore';
import { useDesignerUIStore } from '../store/designerUIStore';
import { usePlacementIntentStore } from '../store/placementIntentStore';
import { DEMO_PAGE_READY_EVENT, isDemoPagePending } from '../demo/useDemoMode';
import {
  beginWorkspaceNavigation,
  finishWorkspaceNavigation,
} from '../designer/workspaceNavigation';

const Workbench = lazy(() => import('./SharedProjectWorkbench'));
export function SharedProjectWorkspace({ onBeforeOpen }: { onBeforeOpen: () => void }) {
  const [open, setOpen] = useState(false),
    [started, setStarted] = useState(false),
    before = useRef(onBeforeOpen);
  before.current = onBeforeOpen;
  useEffect(() => {
    let pending = new URLSearchParams(location.search).get('panel') === 'shared';
    const show = () => {
      const approval = new Event('olb:before-workspace-switch', { cancelable: true });
      if (!window.dispatchEvent(approval)) return;
      window.dispatchEvent(new Event('olb:close-workspaces'));
      beginWorkspaceNavigation('shared');
      before.current();
      useDesignerUIStore.getState().setTool('hand');
      useDesignerUIStore.getState().setMaterialsPanelOpen(false);
      useDesignerUIStore.getState().setEnergyPanelOpen(false);
      usePlacementIntentStore.getState().setArmed(null);
      window.dispatchEvent(new Event('ppw:close-catalog'));
      pending = false;
      setStarted(true);
      setOpen(true);
    };
    const ready = () => {
      if (pending && !isDemoPagePending()) show();
    };
    const close = () => {
      setOpen(false);
      finishWorkspaceNavigation('shared');
    };
    window.addEventListener('olb:open-shared-project', show);
    window.addEventListener(DEMO_PAGE_READY_EVENT, ready);
    window.addEventListener('olb:close-workspaces', close);
    const unsubscribe = usePropertyStore.subscribe((s, previous) => {
      if (s.property.id !== previous.property.id && !isDemoPagePending()) close();
    });
    ready();
    return () => {
      unsubscribe();
      window.removeEventListener('olb:open-shared-project', show);
      window.removeEventListener(DEMO_PAGE_READY_EVENT, ready);
      window.removeEventListener('olb:close-workspaces', close);
    };
  }, []);
  return started
    ? createPortal(
        <Suspense
          fallback={
            open ? (
              <div className="shared-loading" role="status">
                Loading shared project…
                <button
                  onClick={() => {
                    setOpen(false);
                    finishWorkspaceNavigation('shared');
                  }}
                >
                  Back to build
                </button>
              </div>
            ) : null
          }
        >
          <Workbench
            open={open}
            onClose={() => {
              setOpen(false);
              finishWorkspaceNavigation('shared');
            }}
          />
        </Suspense>,
        document.body,
      )
    : null;
}
