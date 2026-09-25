/** @vitest-environment jsdom */
import { act, type ComponentProps } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HouseWorkspace } from '../HouseWorkspace';
import { BuildingControls } from '../BuildingControls';
import { usePropertyStore } from '../../store/propertyStore';
import { useHistoryStore } from '../../store/historyStore';
import { getAllProducts } from '../../data/products';
import { isRoofLevel, levelsOf } from '../../designer/levels';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let host: HTMLDivElement;
let root: Root;
let props: ComponentProps<typeof HouseWorkspace>;

beforeEach(() => {
  usePropertyStore.getState().resetToDefault();
  useHistoryStore.getState().reset();
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  props = {
    mode: 'build', onMode: vi.fn(), onPlan: vi.fn(), onSave: vi.fn(), onCart: vi.fn(),
    children: <div data-testid="scene">House scene</div>, inspector: <div>Build dimensions</div>,
    externalPanel: false, drawing: false, onDraw: vi.fn(), onSelect: vi.fn(), wallDrawing: false, onWalls: vi.fn(),
  };
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  useHistoryStore.getState().reset();
  vi.restoreAllMocks();
});

function render() { act(() => root.render(<HouseWorkspace {...props} />)); }
function click(element: HTMLElement) { act(() => element.click()); }
function button(label: string) {
  return [...host.querySelectorAll<HTMLButtonElement>('button')].find((node) =>
    node.getAttribute('aria-label') === label || node.textContent?.trim() === label)!;
}

describe('HouseWorkspace controls', () => {
  it('adds a real copied floor from the main floor selector and can select the roof', () => {
    const store = usePropertyStore.getState();
    store.setRoomPolygon(store.property.activeRoomId, [{x:0,y:0},{x:6,y:0},{x:6,y:5},{x:0,y:5}]);
    props.onFloorAdded = vi.fn();
    render();
    const select = host.querySelector<HTMLSelectElement>('[aria-label="View floor"]')!;
    act(() => { select.value = '__add-floor'; select.dispatchEvent(new Event('change', { bubbles:true })); });
    const added = usePropertyStore.getState().property;
    expect(levelsOf(added).filter(level => !isRoofLevel(level))).toHaveLength(2);
    expect(added.rooms.find(room => room.id === added.activeRoomId)?.polygon).toHaveLength(4);
    expect(props.onFloorAdded).toHaveBeenCalledOnce();
    act(() => { select.value = '__roof'; select.dispatchEvent(new Event('change', { bubbles:true })); });
    expect(levelsOf(usePropertyStore.getState().property).find(level => level.id === usePropertyStore.getState().property.activeLevelId)?.kind).toBe('roof');
  });

  it('shows selected product descriptions and shared basket, then collapses without clearing selection', () => {
    const product = getAllProducts()[0];
    const id = usePropertyStore.getState().addItem({productId:product.id,x:2,y:2,rotation:0});
    props.selection = {id,productId:product.id,name:product.name,onDeselect:vi.fn()};
    render();
    expect(host.querySelector('[aria-label="Selected product description"]')?.textContent).toContain(product.name);
    expect(host.querySelector('[aria-label="Selected product description"]')?.textContent).toContain(product.supplier);
    expect(host.querySelector('.house-cost-lines')?.textContent).toContain(`1 × ${product.name}`);
    expect(host.querySelector('[data-testid="house-cost-total"]')?.textContent).toBe(host.querySelector('.house-cost-pill strong')?.textContent);
    click(button('Products and cost'));
    expect(host.querySelector('.house-inspector.is-open')).toBeNull();
    expect(props.selection.onDeselect).not.toHaveBeenCalled();
    click(button('Products and cost'));
    const away = new CustomEvent('ppw:house-scene-pointer', {cancelable:true});
    act(() => window.dispatchEvent(away));
    expect(away.defaultPrevented).toBe(true);
    expect(host.querySelector('.house-inspector.is-open')).toBeNull();
    expect(host.querySelector('.house-cost-pill strong')).not.toBeNull();
  });

  it('exposes direct door/window tools and enables stairs only with another floor', () => {
    props.onBuildTool = vi.fn();
    render();
    expect(button('Stairs').disabled).toBe(true);
    click(button('Door')); click(button('Window'));
    expect(props.onBuildTool).toHaveBeenNthCalledWith(1,'door');
    expect(props.onBuildTool).toHaveBeenNthCalledWith(2,'window');
    act(() => usePropertyStore.getState().addLevel('First','ground'));
    expect(button('Stairs').disabled).toBe(false);
    click(button('Stairs'));
    expect(props.onBuildTool).toHaveBeenLastCalledWith('stair');
  });
  it('dismisses open build options on a scene click without forwarding a destructive gesture', () => {
    render();
    click(button('Details'));
    const away = new CustomEvent('ppw:house-scene-pointer', { cancelable: true });
    act(() => window.dispatchEvent(away));
    expect(away.defaultPrevented).toBe(true);
    expect(host.querySelector('.house-inspector.is-open')).toBeNull();
    const next = new CustomEvent('ppw:house-scene-pointer', { cancelable: true });
    act(() => window.dispatchEvent(next));
    expect(next.defaultPrevented).toBe(false);
  });

  it('keeps the scene available when a click outside closes house details', () => {
    render(); click(button('Details'));
    act(() => button('Project tools').dispatchEvent(new Event('pointerdown', { bubbles: true })));
    expect(host.querySelector('.house-inspector.is-open')).toBeNull();
    expect(host.querySelector('[data-testid="scene"]')).not.toBeNull();
  });
  it('exposes every design mode including Solar and tracks the controlled active mode', () => {
    render();
    expect(host.querySelector('nav[aria-label="House design tools"]')).not.toBeNull();
    for (const mode of ['build', 'furnish', 'paint', 'floor', 'garden', 'energy'] as const) {
      const control = host.querySelector<HTMLButtonElement>(`[data-testid="house-mode-${mode}"]`)!;
      click(control);
      expect(props.onMode).toHaveBeenLastCalledWith(mode);
      props.mode = mode;
      render();
      expect(control.getAttribute('aria-pressed')).toBe('true');
      expect(host.querySelectorAll('nav button[aria-pressed="true"]').length).toBe(1);
    }
    expect(button('Solar')).toBeDefined();
  });

  it('routes plan, save, draw, select and project tools to the existing actions', () => {
    const menu = vi.fn();
    window.addEventListener('ppw:open-menu', menu);
    render();
    click(button('2D Plan'));
    click(button('Save'));
    click(host.querySelector<HTMLElement>('[data-testid="house-draw-room"]')!);
    click(button('Select'));
    click(button('Project tools'));
    click(button('Products and cost'));
    click(button('Review cart & checkout ↗'));
    click(button('Close house details'));
    click(button('View products & quantities ↗'));
    expect(props.onPlan).toHaveBeenCalledOnce();
    expect(props.onSave).toHaveBeenCalledOnce();
    expect(props.onDraw).toHaveBeenCalledOnce();
    expect(props.onSelect).toHaveBeenCalledOnce();
    expect(menu).toHaveBeenCalledOnce();
    expect(props.onCart).toHaveBeenCalledTimes(2);
    props.drawing = true;
    render();
    expect(host.querySelector('[data-testid="house-draw-room"]')?.getAttribute('aria-pressed')).toBe('true');
    expect(button('Select').getAttribute('aria-pressed')).toBe('false');
    window.removeEventListener('ppw:open-menu', menu);
  });

  it('updates Undo/Redo availability and restores the actual property snapshots', () => {
    const originalName = usePropertyStore.getState().property.name;
    render();
    expect(button('Undo').disabled).toBe(true);
    expect(button('Redo').disabled).toBe(true);
    act(() => {
      useHistoryStore.getState().recordSnapshot('Rename house');
      usePropertyStore.getState().renameProperty('Courtyard home');
    });
    expect(button('Undo').disabled).toBe(false);
    click(button('Undo'));
    expect(usePropertyStore.getState().property.name).toBe(originalName);
    expect(button('Redo').disabled).toBe(false);
    click(button('Redo'));
    expect(usePropertyStore.getState().property.name).toBe('Courtyard home');
    expect(button('Redo').disabled).toBe(true);
  });

  it('closes the phone details sheet when choosing walls and keeps the drawing mode explicit', () => {
    render();
    click(button('Details'));
    click(button('Walls'));
    expect(props.onWalls).toHaveBeenCalledOnce();
    expect(button('Details').getAttribute('aria-expanded')).toBe('false');
    props.wallDrawing = true;
    render();
    expect(button('Walls').getAttribute('aria-pressed')).toBe('true');
    expect(button('Select').getAttribute('aria-pressed')).toBe('false');
    expect(host.querySelector('[data-testid="house-draw-room"]')?.getAttribute('aria-pressed')).toBe('false');
  });

  it('keeps selected-item actions in details with explicit edit and deselect controls', () => {
    props.selection = { id: 'sofa-1', name: 'Three seat sofa', onDeselect: vi.fn() };
    props.inspector = <div data-testid="selected-actions">Rotate / duplicate</div>;
    render();
    expect(host.querySelector('aside [data-testid="selected-actions"]')).not.toBeNull();
    expect(host.querySelector('[data-testid="scene"] [data-testid="selected-actions"]')).toBeNull();
    expect(host.querySelector('.house-metrics')).toBeNull();
    click(button('Edit item'));
    expect(host.querySelector('.house-inspector.is-open')).not.toBeNull();
    click(button('Clear selected item'));
    expect(props.selection.onDeselect).toHaveBeenCalledOnce();
    expect(host.querySelector('.house-inspector.is-open')).toBeNull();
  });

  it('counts real interior rooms and storeys without adding garden or roof slab area', () => {
    const property = usePropertyStore.getState().property;
    const room = property.rooms[0];
    const polygon = [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 3 }, { x: 0, y: 3 }];
    usePropertyStore.setState({ property: {
      ...property, activeLevelId: 'upper',
      levels: [{ id: 'ground', name: 'Ground', index: 0 }, { id: 'upper', name: 'First floor', index: 1 }, { id: 'roof', name: 'Roof', index: 2, kind: 'roof' }],
      rooms: [
        { ...room, id: 'living', polygon }, { ...room, id: 'bedroom', polygon, levelId: 'upper' },
        { ...room, id: 'outside', polygon, kind: 'outdoor' }, { ...room, id: 'slab', polygon, kind: 'roof', levelId: 'roof' },
        { ...room, id: 'unfinished', polygon: [] },
      ],
    } });
    render();
    expect([...host.querySelectorAll('.house-metrics strong')].map((node) => node.textContent)).toEqual(['24.0', '2', '2']);
    expect(host.querySelector('.house-scene-bar strong')?.textContent).toBe('First floor');
  });

  it('exposes the phone details expanded state and closes the sheet when placement starts', () => {
    render();
    const details = button('Details');
    expect(details.getAttribute('aria-expanded')).toBe('false');
    click(details);
    expect(details.getAttribute('aria-expanded')).toBe('true');
    expect(host.querySelector('aside[aria-label="House details"]')?.classList.contains('is-open')).toBe(true);
    act(() => window.dispatchEvent(new CustomEvent('ppw:close-house-details')));
    expect(details.getAttribute('aria-expanded')).toBe('false');
    click(details);
    click(button('Close house details'));
    expect(details.getAttribute('aria-expanded')).toBe('false');
    expect(host.querySelector('[data-testid="scene"]')).not.toBeNull();
  });

  it('removes the building inspector when paint, floor or solar owns the contextual panel', () => {
    props.externalPanel = true;
    props.onSave = undefined;
    props.onCart = undefined;
    render();
    expect(host.querySelector('aside[aria-label="House details"]')).toBeNull();
    expect(button('Details')).toBeUndefined();
    expect(button('Save')).toBeUndefined();
    expect(button('Products and cost')).toBeUndefined();
    expect(button('Project tools')).toBeDefined();
    expect(host.querySelector('[data-testid="scene"]')).not.toBeNull();
  });

  it('returns to the scene when the inline building inspector requests placement', () => {
    props.inspector = <BuildingControls layout="sidebar" view="building" onViewChange={vi.fn()}
      showRoof={false} onShowRoofChange={vi.fn()} tool="window" onToolChange={vi.fn()}
      gardenOpen={false} onGardenToggle={vi.fn()} />;
    render();
    click(button('Details'));
    expect(button('Details').getAttribute('aria-expanded')).toBe('true');
    click(button('Place in scene'));
    expect(button('Details').getAttribute('aria-expanded')).toBe('false');
    expect(host.querySelector('aside')?.classList.contains('is-open')).toBe(false);
  });
});
