/** @vitest-environment jsdom */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BuildingControls, type BuildingControlsProps } from '../BuildingControls';
import { usePropertyStore } from '../../store/propertyStore';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let host: HTMLDivElement;
let root: Root;
let props: BuildingControlsProps;

beforeEach(() => {
  usePropertyStore.getState().resetToDefault();
  const store = usePropertyStore.getState();
  store.setRoomPolygon(store.property.activeRoomId, [{ x: 0, y: 0 }, { x: 6, y: 0 }, { x: 6, y: 5 }, { x: 0, y: 5 }]);
  props = {
    layout: 'sidebar', view: 'building', onViewChange: vi.fn(), showRoof: false, onShowRoofChange: vi.fn(),
    tool: 'select', onToolChange: vi.fn(), gardenOpen: false, onGardenToggle: vi.fn(),
  };
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});
afterEach(() => { act(() => root.unmount()); host.remove(); });
function render() { act(() => root.render(<BuildingControls {...props} />)); }
function click(element: HTMLElement) { act(() => element.click()); }

describe('BuildingControls sidebar', () => {
  it('keeps dimensions available inline while a new storey copies the current layout', () => {
    render();
    expect(host.querySelector('[data-layout="sidebar"]')).not.toBeNull();
    expect(host.querySelector('[role="region"][aria-label="Build inspector"]')).not.toBeNull();
    expect(host.querySelector('[data-testid="building-floor-height"]')).not.toBeNull();
    const polygon = usePropertyStore.getState().property.rooms[0].polygon;
    click(host.querySelector<HTMLElement>('[data-testid="building-add-floor"]')!);
    const property = usePropertyStore.getState().property;
    expect(property.levels?.length).toBe(2);
    expect(property.rooms.find((room) => room.levelId === property.activeLevelId)?.polygon).toEqual(polygon);
    expect(props.onViewChange).toHaveBeenLastCalledWith('building');
    expect(props.onShowRoofChange).toHaveBeenLastCalledWith(false);
    expect(host.querySelector('[data-testid="building-floor-height"]')).not.toBeNull();
  });

  it('keeps roof finishes editable in the inline inspector without a settings popup', () => {
    render();
    const category = [...host.querySelectorAll<HTMLButtonElement>('[aria-label="Build setting category"] button')].find((button) => button.textContent === 'Roof')!;
    click(category);
    const finish = host.querySelector<HTMLSelectElement>('[data-testid="building-roof-material"]')!;
    act(() => { finish.value = 'felt'; finish.dispatchEvent(new Event('change', { bubbles: true })); });
    expect(usePropertyStore.getState().property.roof?.material).toBe('felt');
    expect(props.onShowRoofChange).toHaveBeenLastCalledWith(true);
    expect(props.onViewChange).toHaveBeenLastCalledWith('building');
    expect(host.querySelectorAll('[data-testid="building-details"]').length).toBe(1);
  });
});
