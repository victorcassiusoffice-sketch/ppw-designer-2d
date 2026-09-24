/** @vitest-environment jsdom */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RoomView3D } from '../RoomView3D';
import { usePropertyStore } from '../../store/propertyStore';
import { useDesignerUIStore } from '../../store/designerUIStore';
import { usePlacementIntentStore } from '../../store/placementIntentStore';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let host: HTMLDivElement;
let root: Root;
let phone = false;
const close = vi.fn();
beforeEach(() => {
  phone = false;
  close.mockClear();
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: phone, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
  usePropertyStore.getState().resetToDefault();
  useDesignerUIStore.setState({ tool: 'hand', energyPanelOpen: false, viewMode: '3d' });
  usePlacementIntentStore.getState().setArmed(null);
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});
afterEach(() => { act(() => root.unmount()); host.remove(); vi.unstubAllGlobals(); });
function mount() { act(() => root.render(<RoomView3D variant="overlay" onClose={close} />)); }
function click(selector: string) { act(() => host.querySelector<HTMLButtonElement>(selector)!.click()); }
function escape(target: EventTarget = window) {
  act(() => target.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })));
}

describe('3D wall tool keyboard ownership', () => {
  it('cancels an armed product before leaving 3D', () => {
    usePlacementIntentStore.getState().setArmed('test-product');
    mount(); escape();
    expect(usePlacementIntentStore.getState().armedProductId).toBeNull();
    expect(close).not.toHaveBeenCalled();
  });
  it('keeps camera controls outside the measured scene and dismisses View before leaving 3D', () => {
    mount();
    const canvas = host.querySelector('[data-testid="wallpaint-3d"]')!;
    expect(canvas.querySelector('[aria-label="Camera navigation"]')).toBeNull();
    expect(host.querySelector('[data-testid="house-view-dock"]')).not.toBeNull();
    click('[data-testid="house-view-settings"]');
    expect(host.querySelector('[data-testid="house-view-options"]')).not.toBeNull();
    escape();
    expect(host.querySelector('[data-testid="house-view-options"]')).toBeNull();
    expect(close).not.toHaveBeenCalled();
  });

  it('consumes the first scene click when dismissing View settings', () => {
    mount(); click('[data-testid="house-view-settings"]');
    const away = new CustomEvent('ppw:house-scene-pointer', { cancelable: true });
    act(() => window.dispatchEvent(away));
    expect(away.defaultPrevented).toBe(true);
    expect(host.querySelector('[data-testid="house-view-options"]')).toBeNull();
    expect(close).not.toHaveBeenCalled();
  });
  it('yields Escape to a foreground dialog without leaving 3D or changing tools', () => {
    mount(); click('[data-testid="house-draw-walls"]');
    const dialog = document.createElement('div');
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    document.body.append(dialog);
    const onEscape = vi.fn();
    document.addEventListener('keydown', onEscape);
    try {
      escape(dialog);
      expect(onEscape).toHaveBeenCalledOnce();
      expect(close).not.toHaveBeenCalled();
      expect(host.querySelector('[data-testid="house-wall-build-strip"]')).not.toBeNull();
    } finally { document.removeEventListener('keydown', onEscape); dialog.remove(); }
  });

  it('deselects an item on Escape before closing the workspace', () => {
    usePropertyStore.setState({ selectedInstanceId: 'selected-item' });
    mount();
    escape();
    expect(usePropertyStore.getState().selectedInstanceId).toBeNull();
    expect(close).not.toHaveBeenCalled();
    escape();
    expect(close).toHaveBeenCalledOnce();
  });

  it('closes the phone Solar sheet first, then leaves Solar without leaving 3D', () => {
    phone = true; mount();
    click('[data-testid="house-mode-energy"]');
    expect(host.querySelector('.house-inspector.is-open')).not.toBeNull();
    escape();
    expect(host.querySelector('.house-inspector.is-open')).toBeNull();
    expect(useDesignerUIStore.getState().energyPanelOpen).toBe(true);
    escape();
    expect(useDesignerUIStore.getState().energyPanelOpen).toBe(false);
    expect(close).not.toHaveBeenCalled();
  });
  it('leaves wall mode before closing 3D even when the permanent sidebar has the inspector ID', () => {
    mount();
    click('[data-testid="house-draw-walls"]');
    host.querySelector('[data-testid="building-details"]')!.id = 'building-details';
    expect(host.querySelector('[data-testid="house-wall-build-strip"]')).not.toBeNull();
    escape();
    expect(host.querySelector('[data-testid="house-wall-build-strip"]')).toBeNull();
    expect(close).not.toHaveBeenCalled();
    escape();
    expect(close).toHaveBeenCalledOnce();
  });

  it('closes phone details first and keeps the wall tool ready', () => {
    phone = true; mount();
    click('[data-testid="house-draw-walls"]');
    click('.house-details-button');
    expect(host.querySelector('.house-inspector.is-open')).not.toBeNull();
    escape();
    expect(host.querySelector('.house-inspector.is-open')).toBeNull();
    expect(host.querySelector('[data-testid="house-wall-build-strip"]')).not.toBeNull();
    expect(close).not.toHaveBeenCalled();
    escape();
    expect(host.querySelector('[data-testid="house-wall-build-strip"]')).toBeNull();
  });

  it('lets focused controls handle Enter instead of consuming their activation', () => {
    mount(); click('[data-testid="house-draw-walls"]');
    const done = [...host.querySelectorAll<HTMLButtonElement>('.house-wall-build-strip button')].find((button) => button.textContent === 'Done')!;
    const enter = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
    act(() => done.dispatchEvent(enter));
    expect(enter.defaultPrevented).toBe(false);
    act(() => done.click());
    expect(host.querySelector('[data-testid="house-wall-build-strip"]')).toBeNull();
    expect(close).not.toHaveBeenCalled();
  });
});
