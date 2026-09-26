/** @vitest-environment jsdom */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TopBar } from '../TopBar';
import { useDesignerUIStore } from '../../store/designerUIStore';
import { usePropertyStore } from '../../store/propertyStore';
import { activeLevelIdOf, isRoofLevel, levelsOf } from '../../designer/levels';
import { COURTS_DEMO } from '../../demo/courts';
import { activeDemo, registerDemo, setActiveDemo } from '../../demo/demoCatalog';

vi.mock('../RoomView3D', () => ({ RoomView3D: () => <div data-testid="test-scene" /> }));
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let host: HTMLDivElement;
let root: Root;

function viewport(width: number) {
  vi.stubGlobal('innerWidth', width);
  vi.stubGlobal('matchMedia', (query: string) => ({ matches: query.includes('min-width') ? width >= Number(query.match(/\d+/)?.[0] ?? 0) : false, media: query, onchange: null, addEventListener() {}, removeEventListener() {} }));
}
beforeEach(() => {
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  viewport(1280);
  usePropertyStore.getState().resetToDefault();
  useDesignerUIStore.setState({ viewMode: 'plan', tool: 'hand', energyPanelOpen: false, precision: 'full' });
  setActiveDemo(null);
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(() => { act(() => root.unmount()); host.remove(); setActiveDemo(null); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
function render() { act(() => root.render(<MemoryRouter><TopBar drawMode={false} setDrawMode={vi.fn()} roomsMenuOpen={false} setRoomsMenuOpen={vi.fn()} /></MemoryRouter>)); }
const byId = (id: string) => document.querySelector<HTMLElement>(`[data-testid="${id}"]`)!;
const click = (node: HTMLElement) => act(() => node.click());
const escape = () => act(() => (document.activeElement ?? document).dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })));

describe('direct Plan controls', () => {
  it.each([360, 768, 1280])('keeps Roof, Plot and Snap directly in the reserved toolbar at %ipx', (width) => {
    viewport(width); render();
    const row = byId('plan-navigation');
    for (const id of ['roof-toggle', 'land-toggle', 'snap-unit-toggle', 'levels-toggle']) {
      expect(row.contains(byId(id))).toBe(true);
      expect(byId(id).closest('[data-ppw-popover]')).toBeNull();
    }
    expect(host.querySelector('[aria-controls="ppw-pop-room"]')).toBeNull();
    expect(host.querySelector('[aria-controls="ppw-pop-view"]')).toBeNull();
    expect(host.querySelector('[class*="overflow-x-auto"]')).toBeNull();
    expect(byId(width < 768 ? 'view-mode-3d-phone' : 'view-mode-3d')).not.toBeNull();
  });

  it('changes snap directly and closes its in-flow options without opening a menu', () => {
    viewport(390); render(); click(byId('snap-unit-toggle'));
    const panel = document.getElementById('ppw-pop-snap')!;
    expect(byId('plan-options-host').contains(panel)).toBe(true);
    expect(panel.style.position).not.toBe('fixed');
    const option = panel.querySelector<HTMLButtonElement>('button[data-testid^="snap-unit-"]')!;
    const expected = option.dataset.testid!.slice('snap-unit-'.length);
    click(option);
    expect(useDesignerUIStore.getState().precision).toBe(expected);
    expect(document.getElementById('ppw-pop-snap')).toBeNull();
    expect(document.getElementById('ppw-sheet')).toBeNull();
  });

  it('opens one option panel at a time and dismisses with Escape or the first canvas tap', () => {
    render(); click(byId('land-toggle'));
    expect(document.getElementById('ppw-pop-land')).not.toBeNull();
    click(byId('levels-toggle'));
    expect(document.getElementById('ppw-pop-land')).toBeNull();
    expect(document.getElementById('ppw-pop-levels')).not.toBeNull();
    escape();
    expect(document.getElementById('ppw-pop-levels')).toBeNull();
    expect(document.activeElement).toBe(byId('levels-toggle'));
    click(byId('land-toggle'));
    const scene = document.createElement('div'); scene.dataset.testid = 'plan-workspace'; document.body.append(scene);
    const pointer = new Event('pointerdown', { bubbles: true, cancelable: true });
    act(() => scene.dispatchEvent(pointer));
    expect(pointer.defaultPrevented).toBe(true);
    expect(document.getElementById('ppw-pop-land')).toBeNull();
    scene.remove();
  });

  it('locks and clears the real site from the directly accessible Plot panel', () => {
    viewport(360); render(); click(byId('land-toggle'));
    const width = Number((byId('land-width') as HTMLInputElement).value);
    const depth = Number((byId('land-depth') as HTMLInputElement).value);
    click(byId('land-apply'));
    expect(usePropertyStore.getState().property.site).toMatchObject({ widthM: width, depthM: depth });
    expect(document.getElementById('ppw-pop-land')).toBeNull();
    click(byId('land-toggle')); click(byId('land-clear'));
    expect(usePropertyStore.getState().property.site).toBeUndefined();
  });

  it('keeps real Roof switching and 3D entry connected to the existing stores', () => {
    viewport(390); render(); click(byId('roof-toggle'));
    const property = usePropertyStore.getState().property;
    expect(isRoofLevel(levelsOf(property).find((level) => level.id === activeLevelIdOf(property)))).toBe(true);
    click(byId('roof-toggle'));
    expect(activeLevelIdOf(usePropertyStore.getState().property)).toBe('ground');
    click(byId('view-mode-3d-phone'));
    expect(useDesignerUIStore.getState().viewMode).toBe('3d');
  });

  it('opens the garden editor from the construction rail and stops an armed tool', () => {
    useDesignerUIStore.setState({ tool: 'floor' });
    const listener = vi.fn();
    window.addEventListener('ppw:open-garden', listener);
    render(); click(byId('plan-garden-toggle'));
    expect(listener).toHaveBeenCalledTimes(1);
    expect(useDesignerUIStore.getState().tool).toBe('hand');
    expect(byId('plan-garden-toggle').closest('[aria-label="Construction tools"]')).not.toBeNull();
    window.removeEventListener('ppw:open-garden', listener);
  });

  it('shows a short Demo badge while preserving merchant and product attribution', () => {
    registerDemo(COURTS_DEMO); setActiveDemo(COURTS_DEMO.slug); render();
    const badge = byId('demo-pill');
    expect(badge.querySelector('span')?.textContent).toBe('Demo');
    expect(badge.textContent).not.toContain('Courts Mammouth');
    expect(activeDemo()?.merchant).toBe(COURTS_DEMO.merchant);
    expect(activeDemo()?.products[0].supplier).toBe(COURTS_DEMO.products[0].supplier);
    expect(byId('demo-pill-exit').getAttribute('aria-label')).toBe('Leave demo mode');
  });
});
