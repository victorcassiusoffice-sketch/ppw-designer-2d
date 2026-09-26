/** @vitest-environment jsdom */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BuildingControls, type BuildingControlsProps } from '../BuildingControls';
import { usePropertyStore } from '../../store/propertyStore';
import { isRoofLevel, levelsOf } from '../../designer/levels';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;
let props: BuildingControlsProps;

beforeEach(() => {
  usePropertyStore.getState().resetToDefault();
  const store = usePropertyStore.getState();
  store.setRoomPolygon(store.property.activeRoomId, [{ x: 0, y: 0 }, { x: 8, y: 0 }, { x: 8, y: 8 }, { x: 0, y: 8 }]);
  props = {
    view: 'building', onViewChange: vi.fn(), showRoof: false, onShowRoofChange: vi.fn(),
    tool: 'select', onToolChange: vi.fn(), gardenOpen: false, onGardenToggle: vi.fn(),
  };
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

function render() { act(() => root.render(<BuildingControls {...props} />)); }
function byTestId(id: string) { return container.querySelector<HTMLElement>(`[data-testid="${id}"]`)!; }
function click(element: HTMLElement) { act(() => element.click()); }

describe('BuildingControls house tools', () => {
  it('adds a real copied floor from the floor selector and leaves the roof showing when returning to a floor', () => {
    // 2026-09-26: choosing a floor or adding one no longer hides the roof —
    // that took a placed solar panel with it. Only the Roof toggle hides it.
    const roofId = usePropertyStore.getState().ensureRoofLevel();
    usePropertyStore.getState().setActiveLevel(roofId);
    props.showRoof = true;
    render();
    const select = byTestId('building-floor-select') as HTMLSelectElement;
    act(() => { select.value = '__add-floor'; select.dispatchEvent(new Event('change', { bubbles: true })); });
    const property = usePropertyStore.getState().property;
    const floors = levelsOf(property).filter(level => !isRoofLevel(level));
    expect(floors).toHaveLength(2);
    expect(property.activeLevelId).toBe(floors[1].id);
    expect(property.rooms.some(room => room.levelId === floors[1].id && room.polygon.length === 4)).toBe(true);
    expect(props.onShowRoofChange).not.toHaveBeenCalled();
    act(() => { select.value = roofId; select.dispatchEvent(new Event('change', { bubbles: true })); });
    expect(props.onShowRoofChange).toHaveBeenLastCalledWith(true);
    act(() => { select.value = 'ground'; select.dispatchEvent(new Event('change', { bubbles: true })); });
    expect(usePropertyStore.getState().property.activeLevelId).toBe('ground');
    expect(props.onShowRoofChange).toHaveBeenCalledTimes(1);
    expect(props.onShowRoofChange).not.toHaveBeenCalledWith(false);
  });

  it('shows a selected roof, then returns to the highest floor when hiding it without deleting the roof', () => {
    const upperId = usePropertyStore.getState().addLevel('Upper', 'ground');
    usePropertyStore.getState().setRoofConfig({ style: 'gable', material: 'felt', pitchDeg: 25, overhangM: 0.2 });
    usePropertyStore.getState().setActiveLevel('ground');
    const roofId = levelsOf(usePropertyStore.getState().property).find(isRoofLevel)!.id;
    render();
    const select = byTestId('building-floor-select') as HTMLSelectElement;
    act(() => { select.value = roofId; select.dispatchEvent(new Event('change', { bubbles: true })); });
    expect(usePropertyStore.getState().property.activeLevelId).toBe(roofId);
    expect(props.onShowRoofChange).toHaveBeenLastCalledWith(true);
    props.showRoof = true;
    render();
    click(byTestId('building-roof-toggle'));
    expect(usePropertyStore.getState().property.activeLevelId).toBe(upperId);
    expect(props.onShowRoofChange).toHaveBeenLastCalledWith(false);
    expect(usePropertyStore.getState().property.roof?.material).toBe('felt');
    expect(levelsOf(usePropertyStore.getState().property).some(isRoofLevel)).toBe(true);
  });

  it('keeps out-of-room stair edits rejected and displays the reason in the contextual inspector', () => {
    const upperId = usePropertyStore.getState().addLevel('Upper', 'ground');
    const stairId = usePropertyStore.getState().addStair({ fromLevelId: 'ground', toLevelId: upperId, x: 4, y: 4, widthM: 1, runM: 3, rotation: 0 });
    expect(stairId).not.toBeNull();
    render();
    click(byTestId('building-details-toggle'));
    const stairsCategory = [...container.querySelectorAll<HTMLButtonElement>('[aria-label="Build setting category"] button')].find((button) => button.textContent === 'Stairs')!;
    click(stairsCategory);
    const input = byTestId('building-stair-x') as HTMLInputElement;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
    act(() => { setter.call(input, '100'); input.dispatchEvent(new Event('input', { bubbles: true })); });
    act(() => input.dispatchEvent(new FocusEvent('focusout', { bubbles: true })));
    expect(usePropertyStore.getState().property.stairs?.find((stair) => stair.id === stairId)?.x).toBe(4);
    expect(container.textContent).toContain('Fit the stairs inside a room on both floors');
    expect(input.getAttribute('aria-invalid')).toBe('true');
  });

  it('keeps floor navigation and building views reachable while settings are closed', () => {
    const upperId = usePropertyStore.getState().addLevel('Upper', 'ground');
    render();
    expect(byTestId('building-details')).toBeNull();
    click(container.querySelector<HTMLButtonElement>('[aria-label="Floor below"]')!);
    expect(usePropertyStore.getState().property.activeLevelId).toBe('ground');
    click(container.querySelector<HTMLButtonElement>('[aria-label="Floor above"]')!);
    expect(usePropertyStore.getState().property.activeLevelId).toBe(upperId);
    click(byTestId('building-view-floor'));
    expect(props.onViewChange).toHaveBeenLastCalledWith('floor');
    expect(byTestId('building-details')).toBeNull();
  });
});
