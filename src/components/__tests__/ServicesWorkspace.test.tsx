/** @vitest-environment jsdom */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ServicesWorkspace } from '../ServicesWorkspace';
import { usePropertyStore } from '../../store/propertyStore';
import { useDesignerUIStore } from '../../store/designerUIStore';
import { useHistoryStore } from '../../store/historyStore';

vi.mock('../ServicesContextProducts', () => ({ ServicesContextProducts: () => null }));
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root, host: HTMLDivElement;
const beforeOpen = vi.fn();
const plan = () => document.querySelector<SVGSVGElement>('[aria-label="Scaled services floor plan"]')!;
const button = (label: string) => [...document.querySelectorAll<HTMLButtonElement>('[role=dialog] button')].find(b => b.getAttribute('aria-label') === label || b.textContent?.trim() === label)!;
const click = (label: string) => { expect(button(label), label).toBeDefined(); act(() => button(label).click()); };
function point(x: number, y: number) {
  for (const type of ['pointerdown', 'pointerup']) {
    const event = new MouseEvent(type, { bubbles: true, clientX: x, clientY: y });
    Object.defineProperty(event, 'pointerId', { value: 1 });
    act(() => plan().dispatchEvent(event));
  }
}
function input(label: string, value: string) {
  const control = [...document.querySelectorAll<HTMLLabelElement>('[role=dialog] label')].find(l => l.textContent?.startsWith(label))?.querySelector<HTMLInputElement>('input');
  expect(control, label).toBeDefined();
  act(() => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(control, value);
    control!.dispatchEvent(new Event('input', { bubbles: true }));
  });
}
beforeEach(() => {
  localStorage.clear(); usePropertyStore.getState().resetToDefault(); useHistoryStore.getState().reset();
  useDesignerUIStore.getState().setViewMode('3d');
  // Test pointer semantics with an identity SVG screen transform; browser tests cover the actual viewport.
  Object.defineProperty(SVGElement.prototype, 'getScreenCTM', { configurable: true, value: () => ({ a: 1, d: 1, inverse: () => ({}) }) });
  Object.defineProperty(SVGElement.prototype, 'setPointerCapture', { configurable: true, value: () => undefined });
  vi.stubGlobal('DOMPoint', class { constructor(public x: number, public y: number) {} matrixTransform() { return { x: this.x, y: this.y }; } });
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
  act(() => root.render(<ServicesWorkspace onBeforeOpen={beforeOpen} />));
  act(() => window.dispatchEvent(new Event('ppw:open-services')));
});
afterEach(() => { act(() => root.unmount()); host.remove(); vi.unstubAllGlobals(); vi.clearAllMocks(); });

describe('service workspace editing and escape paths', () => {
  it('cancels an unfinished route on Escape before closing the workbench', () => {
    expect(beforeOpen).toHaveBeenCalled(); expect(useDesignerUIStore.getState().viewMode).toBe('plan');
    click('Cold water'); point(1, 1);
    const escape = () => act(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
    escape(); expect(document.querySelector('[role=dialog]')).not.toBeNull(); expect(button('Finish run')).toBeUndefined();
    expect(usePropertyStore.getState().property.services).toBeUndefined();
    escape(); expect(document.querySelector('[role=dialog]')).toBeNull();
  });
  it('saves a route without resetting zoom when changing tools or editing', () => {
    click('Zoom services in'); const viewBox = plan().getAttribute('viewBox');
    click('Cold water'); point(1, 1); point(4, 1); click('Finish run');
    expect(usePropertyStore.getState().property.services?.runs[0]).toMatchObject({ levelId: 'ground', points: [{ x: 1, y: 1 }, { x: 4, y: 1 }] });
    expect(plan().getAttribute('viewBox')).toBe(viewBox);
    click('Sink'); expect(plan().getAttribute('viewBox')).toBe(viewBox);
    point(2, 3); expect(usePropertyStore.getState().property.services?.fixtures[0]).toMatchObject({ kind: 'sink', x: 2, y: 3 });
    expect(plan().getAttribute('viewBox')).toBe(viewBox);
  });
  it('preserves a rejected draft and explains how to correct it', () => {
    const previous = usePropertyStore.getState().property;
    click('Cold water'); point(1, 1); point(10001, 1); click('Finish run');
    expect(usePropertyStore.getState().property).toBe(previous);
    expect(document.querySelector('[role=status]')?.textContent).toContain('previous work is preserved');
    expect(button('Finish run')).toBeDefined();
    click('Back point'); point(4, 1); click('Finish run');
    expect(usePropertyStore.getState().property.services?.runs).toHaveLength(1);
    expect(document.querySelector('[role=status]')?.textContent).not.toContain('invalid route');
  });
  it('can create a vertical-only riser with two points at the same plan position', () => {
    click('Cold water'); input('Start elevation', '0'); input('End elevation', '3');
    point(2, 2); point(2, 2); click('Finish run');
    expect(usePropertyStore.getState().property.services?.runs[0]).toMatchObject({ startElevationM: 0, endElevationM: 3, points: [{ x: 2, y: 2 }, { x: 2, y: 2 }] });
    expect(document.querySelector('[aria-label="Services details"]')?.textContent).toContain('3.00 m');
  });
  it('shows only the chosen floor while retaining all floors in the saved property', () => {
    click('Sink'); point(2, 2);
    let upper = ''; act(() => { upper = usePropertyStore.getState().addLevel('First floor'); });
    expect(plan().querySelectorAll('[data-service-id]')).toHaveLength(0);
    click('Toilet'); point(3, 3);
    expect(plan().querySelectorAll('[data-service-id]')).toHaveLength(1);
    const select = document.querySelector<HTMLSelectElement>('[aria-label="Services floor"]')!;
    act(() => { select.value = 'ground'; select.dispatchEvent(new Event('change', { bubbles: true })); });
    const fixtures = usePropertyStore.getState().property.services!.fixtures;
    expect(fixtures.map(f => f.levelId)).toEqual(['ground', upper]);
    expect(plan().querySelector('[data-service-id]')?.getAttribute('data-service-id')).toBe(fixtures[0].id);
  });
  it('fits the full rotated fixture footprint rather than just its centre point', () => {
    click('Sink'); point(2, 3); input('Width', '5'); input('Depth', '4'); click('Rotate 90°'); click('Fit');
    const [x, y, width, height] = plan().getAttribute('viewBox')!.split(' ').map(Number);
    // A 5 × 4 m rectangle rotated 90° around (2,3) occupies x=0..4, y=.5..5.5.
    expect(x).toBeLessThanOrEqual(0); expect(x + width).toBeGreaterThanOrEqual(4);
    expect(y).toBeLessThanOrEqual(.5); expect(y + height).toBeGreaterThanOrEqual(5.5);
  });
  it('lets the user collapse details, return to Select and close with Back', () => {
    click('Close services details'); expect(document.querySelector('[aria-label="Services details"]')).toBeNull();
    click('Cold water'); click('Select');
    expect(button('Select').getAttribute('aria-pressed')).toBe('true');
    click('Back'); expect(document.querySelector('[role=dialog]')).toBeNull();
  });
});
