/** @vitest-environment jsdom */
import { act, StrictMode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CityWorkspace } from '../CityWorkspace';
import { DEMO_PAGE_READY_EVENT, useDemoMode } from '../../demo/useDemoMode';
import { __resetDemosForTests } from '../../demo/demoCatalog';
import { usePropertyStore } from '../../store/propertyStore';
import { useDesignsStore } from '../../store/designsStore';
import { useDesignerUIStore } from '../../store/designerUIStore';

vi.mock('../CityOrdersPanel', () => ({ CityOrdersPanel: () => null }));
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root, host: HTMLDivElement;
function DemoApp({
  onBeforeOpen,
  showCity = true,
}: {
  onBeforeOpen: () => void;
  showCity?: boolean;
}) {
  // Match App's parent hook / child workspace effect ordering.
  useDemoMode();
  return showCity ? <CityWorkspace onBeforeOpen={onBeforeOpen} /> : null;
}
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
});

describe('City route entry after demo startup', () => {
  it('opens on the demo project, then closes on later project changes without reopening', () => {
    window.history.replaceState({}, '', '/demo?panel=city&view=2d');
    const initialId = usePropertyStore.getState().property.id;
    const openIds: string[] = [];
    act(() =>
      root.render(
        <DemoApp onBeforeOpen={() => openIds.push(usePropertyStore.getState().property.id)} />,
      ),
    );
    const demoProperty = usePropertyStore.getState().property;
    expect(demoProperty.id).not.toBe(initialId);
    expect(openIds).toEqual([demoProperty.id]);
    expect(document.querySelector('[data-testid="city-workspace"]')).not.toBeNull();

    act(() => usePropertyStore.getState().loadProperty({ ...demoProperty, id: 'later-project' }));
    expect(document.querySelector('[data-testid="city-workspace"]')).toBeNull();
    act(() => window.dispatchEvent(new Event(DEMO_PAGE_READY_EVENT)));
    expect(document.querySelector('[data-testid="city-workspace"]')).toBeNull();
    expect(openIds).toHaveLength(1);
  });

  it('opens when a lazy workspace mounts after the demo is already ready', () => {
    window.history.replaceState({}, '', '/demo?panel=city&view=2d');
    const before = vi.fn();
    act(() => root.render(<DemoApp onBeforeOpen={before} showCity={false} />));
    expect(document.querySelector('[data-testid="city-workspace"]')).toBeNull();
    act(() => root.render(<DemoApp onBeforeOpen={before} />));
    expect(document.querySelector('[data-testid="city-workspace"]')).not.toBeNull();
    expect(before).toHaveBeenCalledOnce();
  });

  it('survives strict effect replay and does not reopen after the visitor closes City', () => {
    window.history.replaceState({}, '', '/demo?panel=city&view=2d');
    act(() =>
      root.render(
        <StrictMode>
          <DemoApp onBeforeOpen={() => undefined} />
        </StrictMode>,
      ),
    );
    const workspace = document.querySelector('[data-testid="city-workspace"]');
    expect(workspace).not.toBeNull();
    const back = [...workspace!.querySelectorAll('button')].find(
      (b) => b.textContent?.trim() === 'Back to building',
    )!;
    act(() => back.click());
    act(() => window.dispatchEvent(new Event(DEMO_PAGE_READY_EVENT)));
    expect(document.querySelector('[data-testid="city-workspace"]')).toBeNull();
  });

  it('keeps ordinary designer route entry immediate and a demo without panel closed', () => {
    window.history.replaceState({}, '', '/designer?demo=off&panel=city');
    const before = vi.fn();
    act(() => root.render(<DemoApp onBeforeOpen={before} />));
    expect(document.querySelector('[data-testid="city-workspace"]')).not.toBeNull();
    expect(before).toHaveBeenCalledOnce();
    act(() => root.render(null));
    window.history.replaceState({}, '', '/demo?view=2d');
    act(() => root.render(<DemoApp onBeforeOpen={before} />));
    expect(document.querySelector('[data-testid="city-workspace"]')).toBeNull();
    expect(before).toHaveBeenCalledOnce();
  });
});
