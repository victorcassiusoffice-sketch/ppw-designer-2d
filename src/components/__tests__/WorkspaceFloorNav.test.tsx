/** @vitest-environment jsdom */
import { act, StrictMode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FoundationWorkspace } from '../FoundationWorkspace';
import { ServicesWorkspace } from '../ServicesWorkspace';
import { usePropertyStore } from '../../store/propertyStore';
import { useDesignerUIStore } from '../../store/designerUIStore';
import { activeLevelIdOf, levelsOf } from '../../designer/levels';

vi.mock('../ServicesContextProducts', () => ({ ServicesContextProducts: () => null }));
vi.mock('../ServicesProductShelf', () => ({ ServicesProductShelf: () => null }));
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root, host: HTMLDivElement;
const workspaces = () => <><ServicesWorkspace onBeforeOpen={() => undefined} /><FoundationWorkspace onBeforeOpen={() => undefined} /></>;
const open = (kind: 'foundation' | 'services') => act(() => window.dispatchEvent(new Event(`ppw:open-${kind}`)));
function choose(value: string) {
  const select = document.querySelector<HTMLSelectElement>('[role=dialog] [aria-label="Return to floor"]')!;
  expect(select).not.toBeNull();
  act(() => { select.value = value; select.dispatchEvent(new Event('change', { bubbles: true })); });
}
function back() {
  const button = [...document.querySelectorAll<HTMLButtonElement>('[role=dialog] button')].find(b => b.textContent?.includes('Back'))!;
  expect(button).toBeDefined(); act(() => button.click());
}
beforeEach(() => {
  localStorage.clear(); window.history.replaceState({}, '', '/');
  usePropertyStore.getState().resetToDefault();
  useDesignerUIStore.getState().setViewMode('plan');
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
  act(() => root.render(workspaces()));
});
afterEach(() => {
  act(() => root.unmount()); host.remove();
  window.history.replaceState({}, '', '/');
});

describe('floor navigation returns from specialist workspaces', () => {
  it.each(['plan', '3d'] as const)('keeps the %s origin through the floor selector and allows choosing the current floor', origin => {
    act(() => useDesignerUIStore.getState().setViewMode(origin));
    open('services');
    expect(useDesignerUIStore.getState().viewMode).toBe('plan');
    choose('__foundation');
    expect(document.querySelectorAll('[role=dialog]')).toHaveLength(1);
    expect(document.querySelector('[aria-label="Foundation design"]')).not.toBeNull();
    choose(activeLevelIdOf(usePropertyStore.getState().property));
    expect(document.querySelector('[role=dialog]')).toBeNull();
    expect(useDesignerUIStore.getState().viewMode).toBe(origin);
  });
  it('preserves 3D through event-driven workspace hops without an intermediate exit', () => {
    act(() => useDesignerUIStore.getState().setViewMode('3d'));
    open('services'); open('foundation'); open('services');
    expect(document.querySelectorAll('[role=dialog]')).toHaveLength(1);
    choose('ground');
    expect(useDesignerUIStore.getState().viewMode).toBe('3d');
    expect(document.querySelector('[role=dialog]')).toBeNull();
  });
  it('adds a real floor and returns to it in the original view', () => {
    act(() => useDesignerUIStore.getState().setViewMode('3d'));
    const before = levelsOf(usePropertyStore.getState().property).length;
    open('foundation'); choose('__add');
    const property = usePropertyStore.getState().property;
    expect(levelsOf(property)).toHaveLength(before + 1);
    expect(activeLevelIdOf(property)).not.toBe('ground');
    expect(property.rooms.some(r => r.levelId === activeLevelIdOf(property))).toBe(true);
    expect(useDesignerUIStore.getState().viewMode).toBe('3d');
    expect(document.querySelector('[role=dialog]')).toBeNull();
  });
  it('closes the old workspace on project replacement without carrying its return view', () => {
    act(() => useDesignerUIStore.getState().setViewMode('3d'));
    open('services');
    act(() => usePropertyStore.getState().loadProperty({ ...usePropertyStore.getState().property, id: 'different-project' }));
    expect(document.querySelector('[role=dialog]')).toBeNull();
    expect(useDesignerUIStore.getState().viewMode).toBe('plan');
    open('foundation'); back();
    expect(useDesignerUIStore.getState().viewMode).toBe('plan');
  });
  it('cleans up a mounted workspace return path before remounting elsewhere', () => {
    act(() => useDesignerUIStore.getState().setViewMode('3d'));
    open('services');
    act(() => root.render(null));
    expect(useDesignerUIStore.getState().viewMode).toBe('3d');
    act(() => { useDesignerUIStore.getState().setViewMode('plan'); root.render(workspaces()); });
    open('foundation'); back();
    expect(useDesignerUIStore.getState().viewMode).toBe('plan');
  });
  it('does not carry a return path through an unrelated import or AI workspace', () => {
    act(() => useDesignerUIStore.getState().setViewMode('3d'));
    open('services');
    act(() => window.dispatchEvent(new Event('ppw:open-ai-design')));
    expect(document.querySelector('[role=dialog]')).toBeNull();
    open('foundation'); back();
    expect(useDesignerUIStore.getState().viewMode).toBe('plan');
  });
  it('survives StrictMode effect replay when opening services from a URL', () => {
    act(() => root.render(null));
    window.history.replaceState({}, '', '/demo?panel=services');
    act(() => {
      useDesignerUIStore.getState().setViewMode('3d');
      root.render(<StrictMode>{workspaces()}</StrictMode>);
    });
    expect(document.querySelectorAll('[role=dialog]')).toHaveLength(1);
    back();
    expect(useDesignerUIStore.getState().viewMode).toBe('3d');
  });
});
