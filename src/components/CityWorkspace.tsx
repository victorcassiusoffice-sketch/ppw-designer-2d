import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAppPreferences } from '../i18n/AppPreferences';
import { useDesignerUIStore } from '../store/designerUIStore';
import { usePlacementIntentStore } from '../store/placementIntentStore';
import { usePropertyStore } from '../store/propertyStore';
import { beginWorkspaceNavigation, cancelWorkspaceNavigation, finishWorkspaceNavigation } from '../designer/workspaceNavigation';
import { DEMO_PAGE_READY_EVENT, isDemoPagePending } from '../demo/useDemoMode';
import { StudioIcon } from './StudioIcon';
import './cityWorkspace.css';
export { CityNumber } from './CityNumber';
const CityWorkbench = lazy(() => import('./CityWorkbench'));

export function CityLaunchButton({
  compact = false,
  onBeforeOpen,
}: {
  compact?: boolean;
  onBeforeOpen?: () => void;
}) {
  const { t } = useAppPreferences();
  return (
    <button
      type="button"
      className="city-launch"
      aria-label={t("City Build")}
      title="City Build · roads, utilities and infrastructure"
      onClick={() => {
        onBeforeOpen?.();
        window.dispatchEvent(new Event('ppw:open-city'));
      }}
    >
      <StudioIcon name="city" size={19} />
      <span>{compact ? t("City") : t("City Build")}</span>
    </button>
  );
}
export function CityWorkspace({ onBeforeOpen }: { onBeforeOpen: () => void }) {
  const [initialTab, setInitialTab] = useState<'plan' | 'orders'>('plan');
  const [open, setOpen] = useState(false),
    before = useRef(onBeforeOpen);
  before.current = onBeforeOpen;
  useEffect(() => {
    let routeEntryPending = new URLSearchParams(location.search).get('panel') === 'city';
    const show = (event?: Event) => {
      setInitialTab((event as CustomEvent<{tab?: string}> | undefined)?.detail?.tab === 'orders' ? 'orders' : 'plan');
      routeEntryPending = false;
      beginWorkspaceNavigation('city');
      before.current();
      const ui = useDesignerUIStore.getState();
      ui.setTool('hand');
      ui.setMaterialsPanelOpen(false);
      ui.setEnergyPanelOpen(false);
      usePlacementIntentStore.getState().setArmed(null);
      window.dispatchEvent(new Event('ppw:close-house-details'));
      window.dispatchEvent(new Event('ppw:close-catalog'));
      setOpen(true);
    };
    const hide = () => {
      cancelWorkspaceNavigation('city');
      setOpen(false);
    };
    const close = () => {
      routeEntryPending = false;
      hide();
    };
    const enterRoute = () => {
      if (routeEntryPending && !isDemoPagePending()) show();
    };
    const closeTutorial = () => { finishWorkspaceNavigation('city'); setOpen(false); };
    window.addEventListener('olb:close-workspaces', closeTutorial);
    const others = [
      'olb:open-project',
      'ppw:open-foundation',
      'ppw:open-services',
      'ppw:open-plan-import',
      'ppw:open-ai-design',
    ];
    window.addEventListener('ppw:open-city', show);
    window.addEventListener(DEMO_PAGE_READY_EVENT, enterRoute);
    others.forEach((e) => window.addEventListener(e, close));
    const unsub = usePropertyStore.subscribe((s, old) => {
      if (s.property.id !== old.property.id) {
        // The initial demo swap must not cancel the queued route entry. Later
        // project changes still close City and never reopen it from the URL.
        if (!isDemoPagePending()) routeEntryPending = false;
        hide();
      }
    });
    enterRoute();
    return () => {
      unsub();
      window.removeEventListener('ppw:open-city', show);
      window.removeEventListener(DEMO_PAGE_READY_EVENT, enterRoute);
      window.removeEventListener('olb:close-workspaces', closeTutorial);
      others.forEach((e) => window.removeEventListener(e, close));
      finishWorkspaceNavigation('city');
    };
  }, []);
  return open
    ? createPortal(
        <Suspense fallback={<div role="status" className="city-loading">Opening City Build…</div>}><CityWorkbench initialTab={initialTab}
          onClose={() => {
            finishWorkspaceNavigation('city');
            setOpen(false);
          }}
        /></Suspense>,
        document.body,
      )
    : null;
}
