/** @vitest-environment jsdom */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TopBar } from '../TopBar';
import { useDesignerUIStore, type BuildTool } from '../../store/designerUIStore';
import { usePropertyStore } from '../../store/propertyStore';

vi.mock('../RoomView3D', () => ({ RoomView3D: () => <div data-testid="test-scene" /> }));
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let host: HTMLDivElement;
let opener: HTMLButtonElement;
let root: Root;

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: 1366 });
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: query.includes('min-width') ? 1366 >= Number(query.match(/\d+/)?.[0] ?? 0) : false,
    media: query, onchange: null, addEventListener() {}, removeEventListener() {},
  }));
  usePropertyStore.getState().resetToDefault();
  useDesignerUIStore.setState({ viewMode: '3d', tool: 'hand', energyPanelOpen: false });
  host = document.createElement('div');
  opener = document.createElement('button');
  opener.textContent = 'Project tools';
  document.body.append(host, opener);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove(); opener.remove();
  vi.restoreAllMocks(); vi.unstubAllGlobals();
});
function render() {
  act(() => root.render(<MemoryRouter><TopBar drawMode={false} setDrawMode={vi.fn()} roomsMenuOpen={false} setRoomsMenuOpen={vi.fn()} /></MemoryRouter>));
}
function openProjects() {
  opener.focus();
  act(() => window.dispatchEvent(new CustomEvent('ppw:open-menu')));
}
function button(label: string, container: ParentNode = document) {
  return [...container.querySelectorAll<HTMLButtonElement>('button')].find((node) => node.getAttribute('aria-label') === label || node.textContent?.trim() === label)!;
}
function click(node: HTMLElement) { act(() => node.click()); }
function escape() {
  act(() => (document.activeElement ?? document).dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
}

describe('3D project sheet and panel dismissal', () => {
  it('dismisses paint when clicking other chrome but keeps canvas paint clicks available', () => {
    useDesignerUIStore.setState({ tool: 'wallpaint' });
    render();
    const canvas = document.createElement('div');
    canvas.dataset.testid = 'wallpaint-3d-canvas';
    document.body.append(canvas);
    act(() => canvas.dispatchEvent(new Event('pointerdown', { bubbles: true })));
    expect(document.getElementById('ppw-wallpaint-panel')).not.toBeNull();
    act(() => opener.dispatchEvent(new Event('pointerdown', { bubbles: true })));
    expect(document.getElementById('ppw-wallpaint-panel')).toBeNull();
    expect(useDesignerUIStore.getState().viewMode).toBe('3d');
    canvas.remove();
  });
  it('opens the project sheet at desktop width outside inert chrome and returns focus to its actual opener', () => {
    render(); openProjects();
    const sheet = document.getElementById('ppw-sheet')!;
    expect(sheet).not.toBeNull();
    expect(sheet.closest('[inert]')).toBeNull();
    expect(sheet.parentElement?.classList.contains('md:hidden')).toBe(false);
    expect(document.body.style.overflow).toBe('hidden');
    expect(document.activeElement).toBe(button('Close menu', sheet));
    click(button('Close menu', sheet));
    expect(document.getElementById('ppw-sheet')).toBeNull();
    expect(document.body.style.overflow).not.toBe('hidden');
    expect(document.activeElement).toBe(opener);
  });

  it('portals New confirmation outside the inert header and Cancel preserves the property', () => {
    usePropertyStore.getState().addRoom({ name: 'Second room', polygon: [{ x: 10, y: 0 }, { x: 12, y: 0 }, { x: 12, y: 2 }, { x: 10, y: 2 }] });
    render(); openProjects();
    click(button('New property', document.getElementById('ppw-sheet')!));
    const dialog = document.querySelector('[data-testid="new-property-dialog"]')!;
    expect(dialog).not.toBeNull();
    expect(dialog.closest('[inert]')).toBeNull();
    expect(dialog.closest('header')).toBeNull();
    expect(document.activeElement).toBe(button('Cancel', dialog));
    click(button('Cancel', dialog));
    expect(document.querySelector('[data-testid="new-property-dialog"]')).toBeNull();
    expect(usePropertyStore.getState().property.rooms).toHaveLength(2);
    expect(useDesignerUIStore.getState().viewMode).toBe('3d');
  });

  it.each([
    ['floor', 'floor-paint-close', 'ppw-floor-panel'],
    ['wallpaint', 'wallpaint-close', 'ppw-wallpaint-panel'],
    ['cladding', 'cladding-close', 'ppw-cladding-panel'],
  ] as const)('closes %s from a header outside its scrolling product body and stays in 3D', (tool, closeId, panelId) => {
    useDesignerUIStore.setState({ tool: tool as BuildTool });
    render();
    const panel = document.getElementById(panelId)!;
    const close = panel.querySelector<HTMLButtonElement>(`[data-testid="${closeId}"]`)!;
    expect(close).not.toBeNull();
    expect(panel.querySelector('.house-tool-panel-body')?.contains(close)).toBe(false);
    expect(close.closest('.house-tool-panel-header')?.parentElement).toBe(panel);
    click(close);
    expect(document.getElementById(panelId)).toBeNull();
    expect(useDesignerUIStore.getState().tool).toBe('hand');
    expect(useDesignerUIStore.getState().viewMode).toBe('3d');
  });

  it('keeps the paint tool open when Escape dismisses the foreground menu, then closes it on the next Escape', () => {
    useDesignerUIStore.setState({ tool: 'wallpaint' });
    render(); openProjects(); escape();
    expect(document.getElementById('ppw-sheet')).toBeNull();
    expect(document.getElementById('ppw-wallpaint-panel')).not.toBeNull();
    escape();
    expect(document.getElementById('ppw-wallpaint-panel')).toBeNull();
    expect(useDesignerUIStore.getState().viewMode).toBe('3d');
  });

  it('keeps Energy behind a dismissed foreground menu and exposes its persistent Close', () => {
    useDesignerUIStore.setState({ energyPanelOpen: true });
    render(); openProjects(); escape();
    expect(document.getElementById('ppw-sheet')).toBeNull();
    const energy = document.getElementById('ppw-energy-panel')!;
    expect(energy).not.toBeNull();
    const close = energy.querySelector<HTMLButtonElement>('[data-testid="energy-close"]')!;
    expect(energy.querySelector('.house-tool-panel-body')?.contains(close)).toBe(false);
    click(close);
    expect(useDesignerUIStore.getState().energyPanelOpen).toBe(false);
    expect(useDesignerUIStore.getState().viewMode).toBe('3d');
  });
});
