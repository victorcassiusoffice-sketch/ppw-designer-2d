/** @vitest-environment jsdom */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TopBar } from '../../components/TopBar';
import { HouseCostPanel } from '../../components/HouseCostPanel';
import { CartDrawer } from '../../components/cart/CartDrawer';
import { usePropertyStore } from '../../store/propertyStore';
import { useDesignsStore } from '../../store/designsStore';
import { useDesignerUIStore } from '../../store/designerUIStore';
import { useCartUIStore } from '../../store/cartUIStore';
import { HOME_DEMO } from '../generic';
import { activateDemoFromUrl, useDemoMode } from '../useDemoMode';
import { getProductById } from '../../data/products';

vi.mock('../../components/RoomView3D', () => ({ RoomView3D: ({ onCart }: { onCart: () => void }) => <button onClick={onCart}>3D product estimate</button> }));
vi.mock('../../lib/showcaseSafety', () => ({ isShowcaseReadOnly: () => true, DEMO_NOTICE: 'Preview only — no orders.' }));
const cloud = vi.hoisted(() => ({ save: vi.fn(), lead: vi.fn() }));
vi.mock('../../lib/designsApi', async importOriginal => ({ ...await importOriginal<typeof import('../../lib/designsApi')>(), saveDesignToApi: cloud.save, submitLead: cloud.lead }));
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  window.history.replaceState({}, '', '/demo');
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  vi.stubGlobal('innerWidth', 390);
  vi.stubGlobal('matchMedia', (query: string) => ({ matches: query.includes('min-width') ? 390 >= Number(query.match(/\d+/)?.[0] ?? 0) : false, media: query, onchange: null, addEventListener() {}, removeEventListener() {} }));
  activateDemoFromUrl('', '/demo');
  usePropertyStore.getState().loadProperty(HOME_DEMO.buildProperty());
  useDesignsStore.setState({ designs: {}, currentId: null });
  useDesignerUIStore.setState({ viewMode: 'plan', tool: 'hand', energyPanelOpen: false });
  useCartUIStore.getState().close();
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
  cloud.save.mockClear(); cloud.lead.mockClear();
});
afterEach(() => { act(() => root.unmount()); host.remove(); window.history.replaceState({}, '', '/'); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
function renderBar() { act(() => root.render(<MemoryRouter><TopBar drawMode={false} setDrawMode={vi.fn()} roomsMenuOpen={false} setRoomsMenuOpen={vi.fn()} /></MemoryRouter>)); }
const click = (node: HTMLElement) => act(() => node.click());
const button = (text: string) => [...document.querySelectorAll<HTMLButtonElement>('button')].find(node => node.textContent?.trim() === text)!;
const openProjects = () => act(() => window.dispatchEvent(new CustomEvent('ppw:open-menu')));

describe('designer-only Demo controls', () => {
  it.each([['2d', 'plan'], ['3d', '3d']] as const)('opens the actual embedded paint scene in requested %s view', (query, expected) => {
    window.history.replaceState({}, '', `/embed/designer?scene=paint&view=${query}`);
    function DemoHarness() { useDemoMode(); return null; }
    act(() => root.render(<DemoHarness />));
    expect(usePropertyStore.getState().property.id).toBe('generic-demo-paint');
    expect(useDesignerUIStore.getState().viewMode).toBe(expected);
    expect(Object.values(useDesignsStore.getState().designs).some(page => page.property.id === HOME_DEMO.propertyId)).toBe(true);
  });

  it.each(['/demo', '/embed/designer'])('keeps phone design controls on %s without Studio, shop, cloud or checkout exits', path => {
    window.history.replaceState({}, '', path);
    renderBar(); openProjects();
    expect(document.querySelector('[data-testid="view-mode-3d-phone"]')).not.toBeNull();
    expect(document.querySelector('[data-testid="demo-pill-exit"]')).toBeNull();
    expect(document.querySelector('[aria-label="Request quote"]')).toBeNull();
    expect(button('Save as…')).toBeDefined();
    for (const route of ['/studio', '/cart', '/checkout', '/products', '/my-designs']) expect(document.querySelector(`a[href="${route}"]`)).toBeNull();
    expect(host.querySelector('img[alt="PPWellness"]')?.closest('a')).toBeNull();
    expect(document.body.textContent).toContain('no orders');
  });

  it('retains the Studio return link on the standard designer preview', () => {
    window.history.replaceState({}, '', '/designer');
    renderBar(); openProjects();
    expect(document.querySelector('a[href="/studio"]')).not.toBeNull();
    expect(document.querySelector('a[href="/products"]')).toBeNull();
  });

  it('saves locally without calling cloud or lead APIs', () => {
    vi.spyOn(window, 'prompt').mockReturnValue('My local demo');
    renderBar(); openProjects(); click(button('Save as…'));
    expect(Object.values(useDesignsStore.getState().designs).some(page => page.name === 'My local demo')).toBe(true);
    expect(cloud.save).not.toHaveBeenCalled(); expect(cloud.lead).not.toHaveBeenCalled();
  });

  it('opens a local estimate from the phone menu, retains prices, and dismisses with Escape', () => {
    renderBar(); openProjects();
    const estimate = [...document.querySelectorAll<HTMLAnchorElement>('a')].find(node => node.textContent?.includes('Product estimate'))!;
    click(estimate);
    const dialog = document.querySelector('[aria-label="Demo product estimate"]')!;
    expect(dialog).not.toBeNull();
    expect(dialog.querySelector('[data-testid="house-cost-total"]')?.textContent).toMatch(/\d/);
    expect(dialog.querySelector('a')).toBeNull();
    act(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', cancelable: true })));
    expect(document.querySelector('[aria-label="Demo product estimate"]')).toBeNull();
  });

  it('preserves the genuine product description and estimate while hiding 3D checkout', () => {
    const id = HOME_DEMO.buildProperty().rooms.flatMap(room => room.placedItems)[0].productId;
    const checkout = vi.fn();
    act(() => root.render(<HouseCostPanel productId={id} onCart={checkout} />));
    expect(host.textContent).toContain(getProductById(id)!.name);
    expect(host.querySelector('[data-testid="house-cost-total"]')?.textContent).toMatch(/\d/);
    expect(host.querySelector('.house-review-cart')).toBeNull();
    expect(checkout).not.toHaveBeenCalled();
  });

  it('keeps the existing plan basket usable without its checkout button', () => {
    useCartUIStore.getState().open();
    act(() => root.render(<MemoryRouter><CartDrawer /></MemoryRouter>));
    expect(host.querySelector('[data-testid="cart-drawer-total"]')).not.toBeNull();
    expect(host.querySelector('[data-testid="cart-drawer-checkout"]')).toBeNull();
    click(button('Keep designing'));
    expect(useCartUIStore.getState().isDrawerOpen).toBe(false);
  });
});
