/** @vitest-environment jsdom */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { RoomView3D } from '../RoomView3D';
import { usePropertyStore } from '../../store/propertyStore';
import { useDesignerUIStore } from '../../store/designerUIStore';
import { usePlacementIntentStore } from '../../store/placementIntentStore';
import { useHistoryStore, installHistorySubscriptions, __test } from '../../store/historyStore';
import type { ThreeStageHandle, ThreeStageProps } from '../three/ThreeStage';

const renderer = vi.hoisted(() => ({ preview: vi.fn(), reset: vi.fn(), hit: 'bench' as string | null, camera: null as ThreeStageProps['camera'] | null }));
vi.mock('../three/ThreeStage', async () => {
  const React = await import('react');
  return { default: React.forwardRef<Partial<ThreeStageHandle>, ThreeStageProps>(function Stage(props, ref) {
    renderer.camera = props.camera;
    React.useImperativeHandle(ref, () => ({ floorPoint: (x, y) => ({ x: x / 100, y: y / 100 }),
      hitItem: () => renderer.hit ? { instanceId: renderer.hit } : null, hitTest: () => null,
      projectPoint: (x, y) => ({ x: x * 100, y: y * 100 }), moveItemPreview: renderer.preview, resetItemPreview: renderer.reset }));
    return <div />;
  }) };
});
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root, host: HTMLDivElement, historyCleanup: () => void;
beforeEach(async () => {
  vi.stubGlobal('matchMedia', vi.fn((query: string) => ({ matches: query.includes('prefers-reduced-motion'), addEventListener: vi.fn(), removeEventListener: vi.fn() })));
  HTMLElement.prototype.setPointerCapture = vi.fn(); SVGElement.prototype.setPointerCapture = vi.fn();
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({ width: 960, height: 640, x: 0, y: 0, left: 0, top: 0, right: 960, bottom: 640, toJSON: () => ({}) });
  usePropertyStore.getState().resetToDefault();
  const property = usePropertyStore.getState().property;
  usePropertyStore.setState({ property: { ...property, id: 'rotation-test', activeRoomId: 'room', activeLevelId: 'ground', rooms: [{ id: 'room', name: 'Room', polygon: [{ x: 0, y: 0 }, { x: 8, y: 0 }, { x: 8, y: 8 }, { x: 0, y: 8 }], placedItems: [{ instanceId: 'bench', productId: 'demo-console-table', x: 3, y: 3, rotation: 0 }] }] }, selectedInstanceId: 'bench' });
  useDesignerUIStore.setState({ tool: 'hand', viewMode: '3d', foundationView: false, energyPanelOpen: false });
  usePlacementIntentStore.setState({ armedProductId: null, intent: null });
  __test.resetSubscriptions(); historyCleanup = installHistorySubscriptions({ coalesceMs: 0 }); useHistoryStore.getState().reset();
  renderer.preview.mockClear(); renderer.reset.mockClear(); renderer.hit = 'bench';
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
  await act(async () => root.render(<RoomView3D variant="overlay" onClose={() => {}} />));
});
afterEach(() => { act(() => root.unmount()); host.remove(); historyCleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
function pointer(type: string, id: number, x: number, y: number, target = '[data-testid="wallpaint-3d-canvas"]', shift = false) {
  act(() => {
    const event = new MouseEvent(type, { bubbles: true, clientX: x, clientY: y, buttons: type === 'pointerup' ? 0 : 1, shiftKey: shift });
    Object.defineProperties(event, { pointerId: { value: id }, pointerType: { value: 'touch' }, isPrimary: { value: id === 1 } });
    host.querySelector(target)!.dispatchEvent(event);
  });
}
const saved = () => usePropertyStore.getState().property.rooms[0].placedItems[0];
describe('3D ring and twist preserve the edit transaction', () => {
  it('twists the selected item, keeps the camera fixed and commits only on release', () => {
    const before = { ...saved() }, camera = structuredClone(renderer.camera);
    pointer('pointerdown', 1, 100, 100); pointer('pointerdown', 2, 200, 100); pointer('pointermove', 2, 100, 200);
    expect(saved()).toEqual(before); expect(renderer.preview.mock.lastCall?.[3]).toBe(90);
    expect(renderer.camera).toEqual(camera); expect(useHistoryStore.getState().past).toHaveLength(0);
    pointer('pointerup', 2, 100, 200); expect(saved().rotation).toBe(90); expect(useHistoryStore.getState().past).toHaveLength(1);
    act(() => useHistoryStore.getState().undo()); expect(saved()).toEqual(before);
  });
  it('a cancelled touch or Escape leaves the original pose and no history', () => {
    pointer('pointerdown', 1, 100, 100); pointer('pointerdown', 2, 200, 100); pointer('pointermove', 2, 100, 200);
    pointer('pointercancel', 2, 100, 200); expect(saved().rotation).toBe(0); expect(useHistoryStore.getState().past).toHaveLength(0);
    pointer('pointerdown', 1, 100, 100); pointer('pointerdown', 2, 200, 100); pointer('pointermove', 2, 100, 200);
    act(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
    pointer('pointerup', 2, 100, 200); expect(saved().rotation).toBe(0); expect(useHistoryStore.getState().past).toHaveLength(0);
  });
  it('ring captures pointer drag, previews a snap, and commits the same angle', () => {
    const ring = '[data-testid="view3d-rotation-ring"]';
    pointer('pointerdown', 1, 480, 220, ring); pointer('pointermove', 1, 580, 320, ring);
    expect(saved().rotation).toBe(0); expect(renderer.preview.mock.lastCall?.[3]).toBe(90);
    pointer('pointerup', 1, 580, 320, ring); expect(saved().rotation).toBe(90);
  });
  it('two fingers beginning on the floor still pan/zoom the camera, never rotate selection', () => {
    renderer.hit = null;
    pointer('pointerdown', 1, 100, 100); pointer('pointerdown', 2, 200, 100); pointer('pointermove', 2, 100, 200);
    pointer('pointerup', 2, 100, 200); expect(saved().rotation).toBe(0); expect(renderer.preview).not.toHaveBeenCalled();
  });
});
