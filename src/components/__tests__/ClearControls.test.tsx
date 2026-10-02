/** @vitest-environment jsdom */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import { ClearControls } from '../ClearControls';
import { usePropertyStore } from '../../store/propertyStore';
import { useHistoryStore, installHistorySubscriptions, __test } from '../../store/historyStore';
import { usePlacementIntentStore } from '../../store/placementIntentStore';
import { useDesignerUIStore } from '../../store/designerUIStore';
import { defaultMaterialsSettings } from '../../designer/materials/settings';
import { useKeyboardShortcuts } from '../../lib/useKeyboardShortcuts';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root;
let host: HTMLDivElement;
let teardown: () => void;
const beforeClear = vi.fn();
beforeEach(() => {
  __test.resetSubscriptions();
  usePropertyStore.getState().resetToDefault();
  const p = usePropertyStore.getState().property;
  usePropertyStore.setState({ property: { ...p, rooms: [{...p.rooms[0], polygon:[{x:0,y:0},{x:6,y:0},{x:6,y:5},{x:0,y:5}], placedItems:[{instanceId:'chair', productId:'flat-bench', x:1,y:1,rotation:0}]}], garden:{surfaces:[{id:'lawn', kind:'lawn', x:0,y:0,widthM:20,depthM:20,elevationM:0}],fences:[]}, materials:defaultMaterialsSettings() } });
  teardown = installHistorySubscriptions({coalesceMs:0});
  beforeClear.mockReset();
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
  act(() => root.render(<ClearControls inline onBeforeClear={beforeClear} />));
});
afterEach(() => { act(() => root.unmount()); host.remove(); teardown(); });
function click(id: string) { act(() => document.querySelector<HTMLButtonElement>(`[data-testid="${id}"]`)!.click()); }
function cancel() { act(() => document.querySelector<HTMLButtonElement>('[data-clear-cancel]')!.click()); }

describe('Clear in the permanent toolbar', () => {
  it('keeps Delete inside the confirmation instead of deleting selected furniture behind it', () => {
    function WithShortcuts() { useKeyboardShortcuts(); return <ClearControls inline />; }
    act(() => { usePropertyStore.getState().selectItem('chair'); root.render(<WithShortcuts />); });
    click('clear-all-button');
    act(() => document.querySelector<HTMLButtonElement>('[data-clear-cancel]')!.dispatchEvent(new KeyboardEvent('keydown', { key:'Delete', bubbles:true })));
    expect(usePropertyStore.getState().property.rooms[0].placedItems).toHaveLength(1);
    expect(document.querySelector('[role="dialog"]')).not.toBeNull();
    cancel();
    expect(usePropertyStore.getState().property.rooms[0].placedItems).toHaveLength(1);
  });
  it('shows a named Clear action and opening/cancelling never changes the design', () => {
    const before = usePropertyStore.getState().property;
    expect(host.textContent).toBe('Clear');
    click('clear-all-button');
    expect(document.querySelector('[role="dialog"]')).not.toBeNull();
    expect(document.activeElement?.hasAttribute('data-clear-cancel')).toBe(true);
    expect(usePropertyStore.getState().property).toBe(before);
    cancel();
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(usePropertyStore.getState().property).toBe(before);
    expect(beforeClear).not.toHaveBeenCalled();
  });
  it('confirms a whole-page clear and restores the building, garden and settings with one Undo', () => {
    const before = structuredClone(usePropertyStore.getState().property);
    const history = useHistoryStore.getState().past.length;
    usePlacementIntentStore.setState({armedProductId:'flat-bench'});
    useDesignerUIStore.getState().setTool('floor');
    click('clear-all-button'); click('clear-controls-confirm');
    expect(beforeClear).toHaveBeenCalledOnce();
    expect(usePropertyStore.getState().property.rooms[0].polygon).toEqual([]);
    expect(usePropertyStore.getState().property.rooms[0].placedItems).toEqual([]);
    expect(usePropertyStore.getState().property.garden?.surfaces ?? []).toEqual([]);
    expect(usePlacementIntentStore.getState().armedProductId).toBeNull();
    expect(useDesignerUIStore.getState().tool).toBe('hand');
    expect(useHistoryStore.getState().past.length).toBe(history + 1);
    act(() => useHistoryStore.getState().undo());
    expect(usePropertyStore.getState().property).toEqual(before);
  });
  it('can clear products alone without clearing the building or garden', () => {
    const before = structuredClone(usePropertyStore.getState().property);
    click('clear-all-button'); click('clear-products-button'); click('clear-controls-confirm');
    const after = usePropertyStore.getState().property;
    expect(after.rooms[0].placedItems).toEqual([]);
    expect(after.rooms[0].polygon).toEqual(before.rooms[0].polygon);
    expect(after.garden).toEqual(before.garden);
  });
  it('closes using Escape or the outside backdrop and inactive view shortcuts do nothing', () => {
    click('clear-all-button');
    act(() => document.querySelector('[role="dialog"]')!.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true})));
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    click('clear-all-button');
    act(() => document.querySelector<HTMLElement>('[data-testid="clear-controls-modal"]')!.click());
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    act(() => root.render(<ClearControls inline enabled={false} />));
    act(() => window.dispatchEvent(new KeyboardEvent('keydown',{key:'X',shiftKey:true})));
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(host.textContent).toBe('');
  });
});
