/** @vitest-environment jsdom */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RoomView3D } from '../RoomView3D';
import { usePropertyStore } from '../../store/propertyStore';
import { useDesignerUIStore } from '../../store/designerUIStore';
import { usePlacementIntentStore } from '../../store/placementIntentStore';
import { useGardenEditorStore } from '../../store/gardenEditorStore';
import { installHistorySubscriptions, useHistoryStore, __test as historyTest } from '../../store/historyStore';
import type { ThreeStageHandle, ThreeStageProps } from '../three/ThreeStage';

vi.mock('../three/ThreeStage', async () => {
  const React = await import('react');
  return { default: React.forwardRef<Pick<ThreeStageHandle, 'floorPoint' | 'projectPoint'>, ThreeStageProps>(function TestGardenStage(_props, ref) {
    React.useImperativeHandle(ref, () => ({ floorPoint: (x, y) => ({ x: x / 10, y: y / 10 }), projectPoint: (x, y) => ({ x: x * 10, y: y * 10 }) }));
    return <div data-testid="test-garden-stage" />;
  }) };
});
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let host: HTMLDivElement;
let root: Root;
let stopHistory: (() => void) | undefined;
const onClose = vi.fn();
beforeEach(async () => {
  historyTest.resetSubscriptions();
  onClose.mockReset();
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ x: 0, y: 0, left: 0, top: 0, right: 640, bottom: 400, width: 640, height: 400, toJSON: () => ({}) });
  usePropertyStore.getState().resetToDefault();
  useDesignerUIStore.setState({ tool: 'hand', energyPanelOpen: false, viewMode: '3d' });
  usePlacementIntentStore.setState({ armedProductId: null, intent: null });
  useGardenEditorStore.getState().close();
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
  await act(async () => { root.render(<RoomView3D variant="overlay" onClose={onClose} />); });
});
afterEach(() => { stopHistory?.(); stopHistory = undefined; act(() => root.unmount()); host.remove(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });
function click(selector: string) { act(() => host.querySelector<HTMLButtonElement>(selector)!.click()); }
function pointer(type: string, x: number, y: number, pointerId = 1) {
  const canvas = host.querySelector<HTMLDivElement>('[data-testid="wallpaint-3d-canvas"]')!;
  canvas.setPointerCapture = vi.fn();
  const event = new MouseEvent(type, { clientX: x, clientY: y, bubbles: true, button: 0 });
  Object.defineProperties(event, { pointerId: { value: pointerId }, pointerType: { value: 'touch' } });
  act(() => canvas.dispatchEvent(event));
}
function armResize() {
  click('[data-testid="house-mode-garden"]');
  act(() => {
    const id = usePropertyStore.getState().addGardenSurface({ kind: 'lawn', x: 6, y: 0, widthM: 4, depthM: 4, elevationM: 0 });
    useGardenEditorStore.getState().select(id);
  });
  click('[data-testid="garden-resize"]');
}
describe('3D garden drawing', () => {
  it('opening Garden and arming or cancelling a surface keeps an active ground room and creates no undo entry', () => {
    act(() => usePropertyStore.getState().addRoom({ name: 'Second room' }));
    const before = usePropertyStore.getState().property;
    stopHistory = installHistorySubscriptions({ coalesceMs: 0 });
    click('[data-testid="house-mode-garden"]');
    click('[data-testid="garden-add-concrete"]');
    act(() => [...host.querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent === 'Cancel')!.click());
    expect(usePropertyStore.getState().property).toEqual(before);
    expect(useHistoryStore.getState().past).toHaveLength(0);
  });
  it('selects an existing patch on the ground and resizes from its visible corner in one undo', () => {
    click('[data-testid="house-mode-garden"]');
    let id: string | null = null;
    act(() => {
      id = usePropertyStore.getState().addGardenSurface({ kind: 'lawn', x: 6, y: 0, widthM: 4, depthM: 4, elevationM: 0 });
      window.dispatchEvent(new CustomEvent('ppw:close-house-details'));
    });
    pointer('pointerdown', 80, 20); pointer('pointerup', 80, 20);
    expect(useGardenEditorStore.getState().selectedId).toBe(id);
    expect(host.querySelectorAll('[data-testid="garden-corner-handles"] circle')).toHaveLength(4);
    const before = usePropertyStore.getState().property.garden!.surfaces[0];
    stopHistory = installHistorySubscriptions({ coalesceMs: 0 });
    pointer('pointerdown', 100, 40); pointer('pointermove', 140, 80);
    expect(host.querySelector('.house-inspector.is-open')).not.toBeNull();
    expect(host.querySelector('.house-room-preview:not(.house-garden-selection)')?.textContent).toContain('8.0 × 8.0 m');
    expect(usePropertyStore.getState().property.garden!.surfaces[0]).toEqual(before);
    pointer('pointerup', 140, 80);
    expect(usePropertyStore.getState().property.garden!.surfaces[0]).toMatchObject({ x: 6, y: 0, widthM: 8, depthM: 8 });
    expect(useHistoryStore.getState().past).toHaveLength(1);
    act(() => useHistoryStore.getState().undo());
    expect(usePropertyStore.getState().property.garden!.surfaces[0]).toEqual(before);
  });
  it('draws a new garden surface in one gesture, with no saved patch before release', () => {
    click('[data-testid="house-mode-garden"]');
    click('[data-testid="garden-add-concrete"]');
    expect(usePropertyStore.getState().property.garden).toBeUndefined();
    stopHistory = installHistorySubscriptions({ coalesceMs: 0 });
    pointer('pointerdown', 50, 80); pointer('pointermove', 10, 20);
    expect(usePropertyStore.getState().property.garden).toBeUndefined();
    expect(host.querySelector('.house-room-preview')?.textContent).toContain('24.0 m²');
    pointer('pointerup', 10, 20);
    expect(usePropertyStore.getState().property.garden?.surfaces).toHaveLength(1);
    expect(usePropertyStore.getState().property.garden?.surfaces[0]).toMatchObject({ kind: 'concrete', x: 1, y: 2, widthM: 4, depthM: 6 });
    expect(useHistoryStore.getState().past).toHaveLength(1);
    act(() => useHistoryStore.getState().undo());
    expect(usePropertyStore.getState().property.garden).toBeUndefined();
  });
  it('Cancel and switching to Furnish leave a new draft unsaved and clear the tool', () => {
    click('[data-testid="house-mode-garden"]');
    click('[data-testid="garden-add-lawn"]');
    pointer('pointerdown', 50, 80); pointer('pointermove', 10, 20);
    act(() => [...host.querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent === 'Cancel')!.click());
    pointer('pointerup', 10, 20);
    expect(usePropertyStore.getState().property.garden).toBeUndefined();
    click('[data-testid="garden-add-lawn"]');
    pointer('pointerdown', 50, 80); pointer('pointermove', 10, 20);
    click('[data-testid="house-mode-furnish"]');
    pointer('pointerup', 10, 20);
    expect(usePropertyStore.getState().property.garden).toBeUndefined();
    expect(host.querySelector('.garden-draw-instruction')).toBeNull();
  });
  it('previews a floor-style rectangle and commits its size once on release to the shared plan', () => {
    armResize();
    const before = usePropertyStore.getState().property.garden!.surfaces[0];
    stopHistory = installHistorySubscriptions({ coalesceMs: 0 });
    pointer('pointerdown', 50, 80); pointer('pointermove', 10, 20);
    expect(usePropertyStore.getState().property.garden!.surfaces[0]).toEqual(before);
    expect(host.querySelector('.house-room-preview')?.textContent).toContain('4.0 × 6.0 m');
    pointer('pointerup', 10, 20);
    expect(usePropertyStore.getState().property.garden!.surfaces[0]).toMatchObject({ id: before.id, x: 1, y: 2, widthM: 4, depthM: 6 });
    expect(host.querySelector('.house-room-preview:not(.house-garden-selection)')).toBeNull();
    expect(useHistoryStore.getState().past).toHaveLength(1);
    act(() => useHistoryStore.getState().undo());
    expect(usePropertyStore.getState().property.garden!.surfaces[0]).toEqual(before);
  });
  it('cancels an interrupted resize without changing the surface', () => {
    armResize();
    const before = usePropertyStore.getState().property.garden!.surfaces[0];
    pointer('pointerdown', 50, 80); pointer('pointermove', 10, 20); pointer('pointercancel', 10, 20);
    expect(usePropertyStore.getState().property.garden!.surfaces[0]).toEqual(before);
    expect(host.querySelector('.house-room-preview:not(.house-garden-selection)')).toBeNull();
  });
  it('discards a resize when a second finger starts navigation', () => {
    armResize();
    const before = usePropertyStore.getState().property.garden!.surfaces[0];
    pointer('pointerdown', 50, 80); pointer('pointermove', 10, 20);
    pointer('pointerdown', 80, 80, 2); pointer('pointerup', 80, 80, 2); pointer('pointerup', 10, 20);
    expect(usePropertyStore.getState().property.garden!.surfaces[0]).toEqual(before);
    expect(host.querySelector('.house-room-preview:not(.house-garden-selection)')).toBeNull();
  });
  it('cancels on Escape and on floor changes without modifying the saved surface', () => {
    armResize();
    const before = usePropertyStore.getState().property.garden!.surfaces[0];
    pointer('pointerdown', 50, 80); pointer('pointermove', 10, 20);
    act(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', cancelable: true })));
    pointer('pointerup', 10, 20);
    expect(onClose).not.toHaveBeenCalled();
    expect(host.querySelector('.house-room-preview:not(.house-garden-selection)')).toBeNull();
    expect(usePropertyStore.getState().property.garden!.surfaces[0]).toEqual(before);
    click('[data-testid="garden-resize"]');
    pointer('pointerdown', 50, 80); pointer('pointermove', 10, 20);
    act(() => usePropertyStore.getState().addLevel('Upper floor'));
    pointer('pointerup', 10, 20);
    expect(host.querySelector('.house-room-preview')).toBeNull();
    expect(host.querySelector('[data-testid="garden-panel"]')).toBeNull();
    expect(usePropertyStore.getState().property.garden!.surfaces[0]).toEqual(before);
  });
});
