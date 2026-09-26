/**
 * EnergySummary — the per-item watts field and the "self-powered · set
 * watts" rows (electrics fix 2026-09-20, E-03). A customer could not see or
 * correct an item's wattage before: 0 W items vanished from the list and
 * there was no watt input.
 *
 * Raw react-dom/client render pattern (no @testing-library), as
 * RoomEstimatePanel.test.tsx. Input events go through the native value
 * setter so React's value tracker notices them.
 *
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { act } from 'react';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { EnergySummary } from '../EnergyPanel';
import { usePropertyStore, type Property } from '../../store/propertyStore';
import { usePlacementIntentStore } from '../../store/placementIntentStore';
import { useDesignerUIStore } from '../../store/designerUIStore';
import { useToastStore } from '../../store/toastStore';
import { isRoofRoom } from '../../designer/levels';

const RECT = [
  { x: 0, y: 0 },
  { x: 6, y: 0 },
  { x: 6, y: 5 },
  { x: 0, y: 5 },
];

function seed(items: Array<[instanceId: string, productId: string]>): void {
  const property: Property = {
    id: 'p',
    name: 'T',
    activeRoomId: 'r1',
    rooms: [{ id: 'r1', name: 'Gym', polygon: RECT, placedItems: items.map(([instanceId, productId]) => ({ instanceId, productId, x: 1, y: 1, rotation: 0 })) }],
  };
  usePropertyStore.setState({ property });
}

let container: HTMLDivElement;
let root: Root;

function render(): void {
  act(() => {
    flushSync(() => {
      root.render(<EnergySummary />);
    });
  });
}

function $(testId: string): HTMLElement | null {
  return container.querySelector(`[data-testid="${testId}"]`);
}

/** Type into a React-controlled input the way a browser would, then commit. */
function typeAndCommit(input: HTMLInputElement, text: string, how: 'enter' | 'blur' = 'enter'): void {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
  act(() => {
    setter.call(input, text);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  act(() => {
    if (how === 'enter') input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    else input.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
  });
}

function powerWOf(instanceId: string): number | undefined {
  return usePropertyStore
    .getState()
    .property.rooms.flatMap((r) => r.placedItems)
    .find((i) => i.instanceId === instanceId)?.powerW;
}

beforeEach(() => {
  usePlacementIntentStore.getState().consume();
  usePlacementIntentStore.getState().setArmed(null);
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

describe('solar and water placement shortcuts', () => {
  it('opens a real roof and requests one known 3D panel through the shared placement path', () => {
    seed([]);
    useDesignerUIStore.getState().setEnergyPanelOpen(true);
    render();
    act(() => $('energy-add-panel')!.click());
    expect(usePropertyStore.getState().property.rooms.some(isRoofRoom)).toBe(true);
    expect(usePropertyStore.getState().property.activeLevelId).toBe('roof');
    expect(usePlacementIntentStore.getState().intent).toMatchObject({ productId: 'emcar-jinko-475', target: 'center' });
    expect(useDesignerUIStore.getState().energyPanelOpen).toBe(false);
  });
  it('does not create a panel when the building has no drawn footprint', () => {
    seed([]);
    usePropertyStore.setState(state => ({ property: { ...state.property, rooms: [] } }));
    render();
    act(() => $('energy-add-panel')!.click());
    expect(usePlacementIntentStore.getState().intent).toBeNull();
  });
  it('arms the tank on the ground instead of leaving it on a roof, and quotes the retailers\' list price', () => {
    seed([]);
    usePropertyStore.getState().ensureRoofLevel();
    useToastStore.getState().clear();
    render();
    act(() => $('energy-add-tank')!.click());
    expect(usePropertyStore.getState().property.activeLevelId).toBe('ground');
    expect(usePlacementIntentStore.getState().armedProductId).toBe('duraco-water-tank-1000');
    const toasts = useToastStore.getState().toasts;
    expect(toasts[toasts.length - 1]?.message).toBe('Tap the ground to place the Duraco tank. Rs 11,500 list price at Mauritian retailers; delivery and installation not included.');
  });
});
afterEach(() => {
  act(() => {
    root.unmount();
  });
  container.remove();
});

describe('EnergySummary — watts per item', () => {
  it('a counted item shows its watts in a field and says where the typical figure comes from', () => {
    seed([['t1', 'k1-nordictrack-2450']]);
    render();
    const row = $('energy-item-t1');
    expect(row).not.toBeNull();
    const watts = $('energy-watts-t1') as HTMLInputElement;
    expect(watts).not.toBeNull();
    expect(watts.value).toBe('350');
    expect(watts.getAttribute('aria-label')).toBe('NordicTrack Commercial 2450 Treadmill watts');
    const figure = $('energy-figure-t1')!;
    expect(figure.textContent).toContain('typical');
    // The reference row's provenance rides on the tooltip.
    expect(figure.getAttribute('title')).toMatch(/WalkingPad \+ SOLE/);
    expect($('energy-unpowered')).toBeNull();
  });

  it('a self-powered item is listed greyed with a "set watts" field, and typing watts counts it', () => {
    seed([
      ['t1', 'k1-nordictrack-2450'],
      ['s1', 'k1-vision-smith'],
    ]);
    render();
    expect($('energy-item-s1')).toBeNull();
    const grey = $('energy-unpowered-s1');
    expect(grey).not.toBeNull();
    expect(grey!.textContent).toContain('Vision Fitness Smith Machine');
    expect(grey!.textContent).toContain('self-powered · set watts');
    const field = $('energy-watts-s1') as HTMLInputElement;
    expect(field.value).toBe('');
    expect(field.getAttribute('aria-label')).toBe('Vision Fitness Smith Machine watts');

    typeAndCommit(field, '120');
    expect(powerWOf('s1')).toBe(120);
    render();
    expect($('energy-unpowered-s1')).toBeNull();
    const counted = $('energy-item-s1');
    expect(counted).not.toBeNull();
    expect(($('energy-watts-s1') as HTMLInputElement).value).toBe('120');
    expect($('energy-figure-s1')!.textContent).toContain('your figure');
    // 350 × 1 h + 120 × 1 h (strength row default) = 470 Wh/day.
    expect($('energy-load')!.textContent).toContain('470 Wh');
  });

  it('overriding a counted item wins, and clearing the field goes back to the typical figure', () => {
    seed([['t1', 'k1-nordictrack-2450']]);
    render();
    typeAndCommit($('energy-watts-t1') as HTMLInputElement, '500', 'blur');
    expect(powerWOf('t1')).toBe(500);
    render();
    expect(($('energy-watts-t1') as HTMLInputElement).value).toBe('500');
    expect($('energy-figure-t1')!.textContent).toContain('your figure');
    expect($('energy-load')!.textContent).toContain('500 Wh');

    typeAndCommit($('energy-watts-t1') as HTMLInputElement, '', 'blur');
    expect(powerWOf('t1')).toBeUndefined();
    render();
    expect(($('energy-watts-t1') as HTMLInputElement).value).toBe('350');
    expect($('energy-figure-t1')!.textContent).toContain('typical');
  });

  it('an empty plan reads "Nothing using power yet"', () => {
    seed([]);
    render();
    expect($('energy-status')!.textContent).toContain('Nothing using power yet');
    expect($('energy-meter')).not.toBeNull();
    expect($('energy-meter')!.getAttribute('aria-valuenow')).toBe('0');
  });
});
