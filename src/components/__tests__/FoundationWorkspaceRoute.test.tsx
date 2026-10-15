/** @vitest-environment jsdom */
import { act, StrictMode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { FoundationWorkspace } from '../FoundationWorkspace';
import { DEMO_PAGE_READY_EVENT, useDemoMode } from '../../demo/useDemoMode';
import { __resetDemosForTests } from '../../demo/demoCatalog';
import { usePropertyStore } from '../../store/propertyStore';
import { useDesignsStore } from '../../store/designsStore';
import { useDesignerUIStore } from '../../store/designerUIStore';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root, host: HTMLDivElement;
function DemoApp({
  before = () => undefined,
  show = true,
}: {
  before?: () => void;
  show?: boolean;
}) {
  useDemoMode();
  return show ? <FoundationWorkspace onBeforeOpen={before} /> : null;
}
const workspace = () => document.querySelector('[aria-label="Foundation design"]');
beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  __resetDemosForTests();
  usePropertyStore.getState().resetToDefault();
  useDesignsStore.setState({ designs: {}, currentId: null });
  useDesignerUIStore.getState().setViewMode('plan');
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  __resetDemosForTests();
  window.history.replaceState({}, '', '/');
});

describe('foundation deep-link lifecycle', () => {
  it('opens only after the demo project loads and does not reopen on later projects', () => {
    window.history.replaceState({}, '', '/demo?panel=foundation&view=2d');
    const initialId = usePropertyStore.getState().property.id;
    const ids: string[] = [];
    act(() =>
      root.render(<DemoApp before={() => ids.push(usePropertyStore.getState().property.id)} />),
    );
    const property = usePropertyStore.getState().property;
    expect(property.id).not.toBe(initialId);
    expect(ids).toEqual([property.id]);
    expect(workspace()).not.toBeNull();
    act(() => usePropertyStore.getState().loadProperty({ ...property, id: 'another-project' }));
    act(() => window.dispatchEvent(new Event(DEMO_PAGE_READY_EVENT)));
    expect(workspace()).toBeNull();
    expect(ids).toHaveLength(1);
  });
  it('handles late mounting, then Back preserves the original 3D view', () => {
    window.history.replaceState({}, '', '/demo?panel=foundation&view=3d');
    const before = vi.fn();
    act(() => root.render(<DemoApp before={before} show={false} />));
    act(() => root.render(<DemoApp before={before} />));
    expect(workspace()).not.toBeNull();
    expect(before).toHaveBeenCalledOnce();
    const back = [...workspace()!.querySelectorAll('button')].find((b) =>
      b.textContent?.includes('Back'),
    )!;
    act(() => back.click());
    act(() => window.dispatchEvent(new Event(DEMO_PAGE_READY_EVENT)));
    expect(workspace()).toBeNull();
    expect(useDesignerUIStore.getState().viewMode).toBe('3d');
  });
  it('survives StrictMode startup and stays closed after workspace handover', () => {
    window.history.replaceState({}, '', '/demo?panel=foundation&view=2d');
    act(() =>
      root.render(
        <StrictMode>
          <DemoApp />
        </StrictMode>,
      ),
    );
    expect(workspace()).not.toBeNull();
    act(() => window.dispatchEvent(new Event('ppw:open-services')));
    act(() => window.dispatchEvent(new Event(DEMO_PAGE_READY_EVENT)));
    expect(workspace()).toBeNull();
  });
  it('opens ordinary explicit foundation links immediately but not an ordinary demo', () => {
    window.history.replaceState({}, '', '/designer?demo=off&panel=foundation');
    act(() => root.render(<DemoApp />));
    expect(workspace()).not.toBeNull();
    act(() => root.render(null));
    window.history.replaceState({}, '', '/demo?view=2d');
    act(() => root.render(<DemoApp />));
    expect(workspace()).toBeNull();
  });
});
