/** @vitest-environment jsdom */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ServicesWorkspace } from '../ServicesWorkspace';
import { usePropertyStore } from '../../store/propertyStore';
import { useDesignerUIStore } from '../../store/designerUIStore';

const startup = vi.hoisted(() => ({ pending: false }));
vi.mock('../../demo/useDemoMode', () => ({
  DEMO_PAGE_READY_EVENT: 'ppw:demo-page-ready',
  isDemoPagePending: () => startup.pending,
}));
vi.mock('../ServicesContextProducts', () => ({ ServicesContextProducts: () => null }));
vi.mock('../ServicesThreeEditor', () => ({
  default: () => <div data-testid="services-3d-editor" />,
}));
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root, host: HTMLDivElement;
const dialog = () => document.querySelector('[role=dialog][aria-labelledby="services-title"]');
const button = (text: string) =>
  [...document.querySelectorAll<HTMLButtonElement>('[role=dialog] button')].find(
    (b) => b.textContent?.trim() === text,
  )!;
const mount = async () => {
  await act(async () => root.render(<ServicesWorkspace onBeforeOpen={() => undefined} />));
};
beforeEach(() => {
  localStorage.clear();
  startup.pending = false;
  history.replaceState(null, '', '/designer');
  usePropertyStore.getState().resetToDefault();
  useDesignerUIStore.getState().setViewMode('plan');
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  history.replaceState(null, '', '/');
});

describe('services public demo entry', () => {
  it('waits for the demo page swap, opens 3D once, and does not reopen a later project', async () => {
    startup.pending = true;
    history.replaceState(null, '', '/demo?panel=services&view=3d');
    await mount();
    expect(dialog()).toBeNull();
    act(() =>
      usePropertyStore.setState((state) => ({
        property: { ...state.property, id: 'loaded-demo' },
      })),
    );
    expect(dialog()).toBeNull();
    await act(async () => {
      startup.pending = false;
      window.dispatchEvent(new Event('ppw:demo-page-ready'));
    });
    expect(dialog()).not.toBeNull();
    expect(button('3D edit').getAttribute('aria-pressed')).toBe('true');
    expect(document.querySelector('[data-testid="services-3d-editor"]')).not.toBeNull();
    act(() =>
      usePropertyStore.setState((state) => ({
        property: { ...state.property, id: 'another-project' },
      })),
    );
    act(() => window.dispatchEvent(new Event('ppw:demo-page-ready')));
    expect(dialog()).toBeNull();
  });
  it('starts in 3D from the building view and restores that view on Back', async () => {
    useDesignerUIStore.getState().setViewMode('3d');
    await mount();
    await act(async () => window.dispatchEvent(new Event('ppw:open-services')));
    expect(button('3D edit').getAttribute('aria-pressed')).toBe('true');
    expect(useDesignerUIStore.getState().viewMode).toBe('plan');
    act(() => button('Back').click());
    expect(useDesignerUIStore.getState().viewMode).toBe('3d');
  });
  it('honours an explicit 2D route even when the previous building view was 3D', async () => {
    useDesignerUIStore.getState().setViewMode('3d');
    history.replaceState(null, '', '/demo?panel=services&view=2d');
    await mount();
    expect(button('2D plan').getAttribute('aria-pressed')).toBe('true');
    expect(document.querySelector('[data-testid="services-3d-editor"]')).toBeNull();
  });
  it('cancels pending demo entry when another workspace is requested', async () => {
    startup.pending = true;
    history.replaceState(null, '', '/demo?panel=services&view=3d');
    await mount();
    act(() => window.dispatchEvent(new Event('ppw:open-foundation')));
    await act(async () => {
      startup.pending = false;
      window.dispatchEvent(new Event('ppw:demo-page-ready'));
    });
    expect(dialog()).toBeNull();
  });
});
