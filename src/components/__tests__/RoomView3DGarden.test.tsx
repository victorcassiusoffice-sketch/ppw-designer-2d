/** @vitest-environment jsdom */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RoomView3D } from '../RoomView3D';
import { usePropertyStore } from '../../store/propertyStore';
import { useDesignerUIStore } from '../../store/designerUIStore';
import { usePlacementIntentStore } from '../../store/placementIntentStore';
import { useGardenEditorStore } from '../../store/gardenEditorStore';
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
beforeEach(async () => {
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ x: 0, y: 0, left: 0, top: 0, right: 640, bottom: 400, width: 640, height: 400, toJSON: () => ({}) });
  usePropertyStore.getState().resetToDefault();
  useDesignerUIStore.setState({ tool: 'hand', energyPanelOpen: false, viewMode: '3d' });
  usePlacementIntentStore.setState({ armedProductId: null, intent: null });
  useGardenEditorStore.getState().close();
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
  await act(async () => { root.render(<RoomView3D variant="overlay" />); });
});
afterEach(() => { act(() => root.unmount()); host.remove(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });
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
  click('[data-testid="garden-add-lawn"]');
  act(() => [...host.querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent === 'Cancel')!.click());
  click('[data-testid="garden-resize"]');
}
describe('3D garden drawing', () => {
  it('previews a floor-style rectangle and commits its size once on release to the shared plan', () => {
    armResize();
    const before = usePropertyStore.getState().property.garden!.surfaces[0];
    pointer('pointerdown', 50, 80); pointer('pointermove', 10, 20);
    expect(usePropertyStore.getState().property.garden!.surfaces[0]).toEqual(before);
    expect(host.querySelector('.house-room-preview')?.textContent).toContain('4.0 × 6.0 m');
    pointer('pointerup', 10, 20);
    expect(usePropertyStore.getState().property.garden!.surfaces[0]).toMatchObject({ id: before.id, x: 1, y: 2, widthM: 4, depthM: 6 });
    expect(host.querySelector('.house-room-preview')).toBeNull();
  });
  it('cancels an interrupted resize without changing the surface', () => {
    armResize();
    const before = usePropertyStore.getState().property.garden!.surfaces[0];
    pointer('pointerdown', 50, 80); pointer('pointermove', 10, 20); pointer('pointercancel', 10, 20);
    expect(usePropertyStore.getState().property.garden!.surfaces[0]).toEqual(before);
    expect(host.querySelector('.house-room-preview')).toBeNull();
  });
});
