/**
 * testHooks — PREVIEW-ONLY window.__designer bridge for Playwright /
 * device-emulation verification (Customer-UI 2026-05-31).
 *
 * Gated behind VITE_TEST_HOOKS at the call site (main.tsx) via a dynamic
 * import, so this module is never bundled in a production build (when
 * VITE_TEST_HOOKS is unset the import is tree-shaken). It reads the existing
 * design store and mutates nothing of its own (the selectItem helper just
 * proxies the store action so a test can deselect without a real gesture).
 */
import { useDesignStore } from '../store/designStore';

interface DesignerTestState {
  selectedId: string | null;
  selectedInstanceId: string | null;
  placedItems: ReturnType<typeof useDesignStore.getState>['placedItems'];
  itemCount: number;
}

export interface DesignerTestApi {
  getState: () => DesignerTestState;
  selectItem: (id: string | null) => void;
}

export function installTestHooks(): void {
  if (typeof window === 'undefined') return;
  const api: DesignerTestApi = {
    getState() {
      const s = useDesignStore.getState();
      return {
        selectedId: s.selectedInstanceId,
        selectedInstanceId: s.selectedInstanceId,
        placedItems: s.placedItems,
        itemCount: s.placedItems.length,
      };
    },
    selectItem(id: string | null) {
      useDesignStore.getState().selectItem(id);
    },
  };
  (window as unknown as { __designer?: DesignerTestApi }).__designer = api;
}
