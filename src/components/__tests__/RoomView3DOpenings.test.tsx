/** @vitest-environment jsdom */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RoomView3D } from '../RoomView3D';
import { usePropertyStore } from '../../store/propertyStore';
import { useDesignerUIStore } from '../../store/designerUIStore';
import { usePlacementIntentStore } from '../../store/placementIntentStore';
import type { ThreeStageHandle, ThreeStageProps } from '../three/ThreeStage';

vi.mock('../three/ThreeStage', async () => {
  const React = await import('react');
  return { default: React.forwardRef<Pick<ThreeStageHandle, 'wallPoint' | 'floorPoint' | 'projectPoint' | 'hitItem'>, ThreeStageProps>(function TestOpeningStage(_props, ref) {
    React.useImperativeHandle(ref, () => ({ wallPoint: () => null, floorPoint: (x, y) => ({ x: x / 100, y: y / 100 }), projectPoint: (x, y) => ({ x: x * 100, y: y * 100 }), hitItem: () => null }));
    return <div data-testid="test-opening-stage" />;
  }) };
});
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let host: HTMLDivElement;
let root: Root;
const onClose = vi.fn();
beforeEach(async () => {
  onClose.mockReset();
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ x: 0, y: 0, left: 0, top: 0, right: 640, bottom: 400, width: 640, height: 400, toJSON: () => ({}) });
  usePropertyStore.getState().resetToDefault();
  const store = usePropertyStore.getState();
  store.setRoomPolygon(store.property.activeRoomId, [{ x: 0, y: 0 }, { x: 6, y: 0 }, { x: 6, y: 5 }, { x: 0, y: 5 }]);
  useDesignerUIStore.setState({ tool: 'hand', energyPanelOpen: false, viewMode: '3d', doorDraft: { kind: 'door', widthM: 0.838, flipFacing: false, flipHand: false } });
  usePlacementIntentStore.setState({ armedProductId: null, intent: null });
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
  await act(async () => { root.render(<RoomView3D variant="overlay" onClose={onClose} />); });
});
afterEach(() => { act(() => root.unmount()); host.remove(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });
function button(text: string) { return [...host.querySelectorAll<HTMLButtonElement>('.house-opening-tools button')].find(b => b.textContent === text)!; }
function click(text: string) { act(() => button(text).click()); }
function pointer(type: string, x: number, y: number, pointerId = 1, pointerType = 'touch') {
  const canvas = host.querySelector<HTMLDivElement>('[data-testid="wallpaint-3d-canvas"]')!;
  canvas.setPointerCapture = vi.fn();
  const event = new MouseEvent(type, { clientX: x, clientY: y, bubbles: true, button: 0 });
  Object.defineProperties(event, { pointerId: { value: pointerId }, pointerType: { value: pointerType } });
  act(() => canvas.dispatchEvent(event));
}
const openings = () => usePropertyStore.getState().property.rooms.flatMap(room => room.openings ?? []);
describe('3D wall-hosted opening gestures', () => {
  it('slides a snapped preview, commits only on release, and remains armed for another door', () => {
    click('Door');
    pointer('pointerdown', 200, 10); pointer('pointermove', 320, 10);
    expect(openings()).toHaveLength(0);
    expect(host.querySelector('[data-testid="opening-3d-preview"]')?.getAttribute('data-valid')).toBe('true');
    pointer('pointerup', 320, 10);
    expect(openings()).toHaveLength(1);
    expect(openings()[0]).toMatchObject({ edgeIndex: 0, offsetM: 3.2, widthM: 0.838, kind: 'door' });
    expect(button('Door').getAttribute('aria-pressed')).toBe('true');
    pointer('pointerdown', 100, 10); pointer('pointerup', 100, 10);
    expect(openings()).toHaveLength(2);
    click('Done');
    expect(host.querySelector('[aria-label="Opening placement options"]')).toBeNull();
  });
  it('uses Plan width and swing settings and changes to a window with the correct defaults', () => {
    click('Door');
    act(() => useDesignerUIStore.getState().setDoorDraft({ widthM: 0.914, flipFacing: true, flipHand: true }));
    pointer('pointerdown', 200, 10); pointer('pointerup', 200, 10);
    expect(openings()[0]).toMatchObject({ widthM: 0.914, flipFacing: true, flipHand: true });
    click('Window');
    pointer('pointerdown', 400, 10); pointer('pointerup', 400, 10);
    expect(openings()[1]).toMatchObject({ kind: 'window', sillM: 0.9 });
  });
  it('does not place on interrupted, second-finger or Escape-cancelled drags', () => {
    click('Door');
    pointer('pointerdown', 200, 10); pointer('pointercancel', 200, 10);
    pointer('pointerdown', 200, 10); pointer('pointerdown', 300, 10, 2); pointer('pointerup', 300, 10, 2); pointer('pointerup', 200, 10);
    pointer('pointerdown', 200, 10);
    act(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', cancelable: true })));
    pointer('pointerup', 200, 10);
    expect(openings()).toHaveLength(0);
    expect(host.querySelector('[data-testid="opening-3d-preview"]')).toBeNull();
    expect(onClose).not.toHaveBeenCalled();
    act(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', cancelable: true })));
    expect(button('Door').getAttribute('aria-pressed')).toBe('false');
    expect(onClose).not.toHaveBeenCalled();
  });
  it('shows blocked placement and refuses overlapping doors without removing the existing one', () => {
    click('Door');
    pointer('pointerdown', 200, 10); pointer('pointerup', 200, 10);
    pointer('pointermove', 220, 10, 1, 'mouse');
    expect(host.querySelector('[data-testid="opening-3d-preview"]')?.getAttribute('data-valid')).toBe('false');
    pointer('pointerdown', 220, 10); pointer('pointerup', 220, 10);
    expect(openings()).toHaveLength(1);
  });
  it('cancels a held door when the user switches floors', () => {
    click('Door'); pointer('pointerdown', 200, 10);
    act(() => usePropertyStore.getState().addLevel('First'));
    pointer('pointerup', 200, 10);
    expect(openings()).toHaveLength(0);
    expect(host.querySelector('[data-testid="opening-3d-preview"]')).toBeNull();
  });
});
