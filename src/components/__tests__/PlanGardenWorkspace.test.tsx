/** @vitest-environment jsdom */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PlanGardenWorkspace } from '../PlanGardenWorkspace';
import { usePropertyStore } from '../../store/propertyStore';
import { useDesignerUIStore } from '../../store/designerUIStore';
import { useGardenEditorStore } from '../../store/gardenEditorStore';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  usePropertyStore.getState().resetToDefault();
  useGardenEditorStore.getState().close();
  useDesignerUIStore.setState({ viewMode: 'plan', tool: 'hand' });
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
  act(() => root.render(<PlanGardenWorkspace />));
});
afterEach(() => { act(() => root.unmount()); host.remove(); });
const escape = () => act(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', cancelable: true })));
describe('plan garden workspace', () => {
  it('opens from the toolbar, adds a patch and replaces the large inspector with cancellable placement instructions', () => {
    act(() => window.dispatchEvent(new CustomEvent('ppw:open-garden')));
    expect(host.querySelector('[data-testid="garden-panel"]')).not.toBeNull();
    act(() => host.querySelector<HTMLButtonElement>('[data-testid="garden-add-lawn"]')!.click());
    const patch = usePropertyStore.getState().property.garden!.surfaces[0];
    expect(useGardenEditorStore.getState().placement?.id).toBe(patch.id);
    expect(host.querySelector('[data-testid="garden-panel"]')).toBeNull();
    expect(host.querySelector('[role="status"]')?.textContent).toContain('Tap the plan');
    escape();
    expect(host.querySelector('[data-testid="garden-panel"]')).not.toBeNull();
    act(() => host.querySelector<HTMLButtonElement>('[data-testid="garden-resize"]')!.click());
    expect(host.querySelector('[role="status"]')?.textContent).toContain('Drag two corners');
    escape(); escape();
    expect(host.querySelector('[data-testid="plan-garden-workspace"]')).toBeNull();
    expect(usePropertyStore.getState().property.garden?.surfaces[0]).toEqual(patch);
  });
  it('leaves the 3D inspector alone and stops plan editing when a different tool is chosen', () => {
    act(() => useDesignerUIStore.getState().setViewMode('3d'));
    act(() => window.dispatchEvent(new CustomEvent('ppw:open-garden')));
    expect(host.children).toHaveLength(0);
    act(() => useDesignerUIStore.getState().setViewMode('plan'));
    act(() => window.dispatchEvent(new CustomEvent('ppw:open-garden')));
    act(() => useDesignerUIStore.getState().setTool('floor'));
    expect(host.children).toHaveLength(0);
    expect(useGardenEditorStore.getState().placement).toBeNull();
  });
});
