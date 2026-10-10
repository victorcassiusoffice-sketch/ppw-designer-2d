/** @vitest-environment jsdom */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { FoundationWorkspace } from '../FoundationWorkspace';
import { usePropertyStore } from '../../store/propertyStore';
import { useHistoryStore } from '../../store/historyStore';
import { foundationVolumeM3 } from '../../designer/foundation';
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root, host: HTMLDivElement;
const plan = () => document.querySelector<SVGSVGElement>('[aria-label="Scaled foundation plan"]')!;
const button = (label: string) =>
  [...document.querySelectorAll<HTMLButtonElement>('[role=dialog] button')].find(
    (b) => b.getAttribute('aria-label') === label || b.textContent?.trim() === label,
  )!;
const click = (label: string) => {
  expect(button(label), label).toBeDefined();
  act(() => button(label).click());
};
function point(x: number, y: number) {
  for (const type of ['pointerdown', 'pointerup']) {
    const event = new MouseEvent(type, { bubbles: true, clientX: x, clientY: y });
    Object.defineProperty(event, 'pointerId', { value: 1 });
    act(() => plan().dispatchEvent(event));
  }
}
function number(label: string, value: string) {
  const input = document.querySelector<HTMLInputElement>(`input[aria-label="${label}"]`)!;
  act(() => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value);
    input.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
  });
}
beforeEach(() => {
  localStorage.clear();
  usePropertyStore.getState().resetToDefault();
  useHistoryStore.getState().reset();
  Object.defineProperty(SVGElement.prototype, 'getScreenCTM', {
    configurable: true,
    value: () => ({ a: 1, d: 1, inverse: () => ({}) }),
  });
  Object.defineProperty(SVGElement.prototype, 'setPointerCapture', {
    configurable: true,
    value: () => undefined,
  });
  Object.defineProperty(document, 'elementFromPoint', { configurable: true, value: () => plan() });
  vi.stubGlobal(
    'DOMPoint',
    class {
      constructor(
        public x: number,
        public y: number,
      ) {}
      matrixTransform() {
        return { x: this.x, y: this.y };
      }
    },
  );
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  act(() => root.render(<FoundationWorkspace onBeforeOpen={() => undefined} />));
  act(() => window.dispatchEvent(new Event('ppw:open-foundation')));
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});
describe('foundation editing preserves shared geometry and escape paths', () => {
  it('draws one measured slab and edits depth without resetting the camera', () => {
    click('Zoom foundation in');
    const view = plan().getAttribute('viewBox');
    click('Slab / raft');
    point(1, 1);
    point(5, 4);
    expect(document.querySelector('.foundation-pending')?.textContent).toContain('2.4 m³');
    click('Add concrete');
    expect(usePropertyStore.getState().property.foundation).toMatchObject({
      enabled: true,
      elements: [{ lengthM: 4, widthM: 3, x: 3, y: 2.5, depthM: 0.2 }],
    });
    number('Concrete depth m', '0.4');
    expect(usePropertyStore.getState().property.foundation?.elements[0].depthM).toBe(0.4);
    expect(plan().getAttribute('viewBox')).toBe(view);
    expect(document.querySelector('.foundation-totals')?.textContent).toContain('4.8 m³');
    number('Concrete depth m', '-3');
    expect(usePropertyStore.getState().property.foundation?.elements[0].depthM).toBe(0.4);
  });
  it('cancels a draft before closing and allows details to collapse', () => {
    click('Pad footing');
    point(1, 1);
    act(() =>
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })),
    );
    expect(document.querySelector('[role=dialog]')).not.toBeNull();
    expect(usePropertyStore.getState().property.foundation).toBeUndefined();
    click('Hide foundation details');
    expect(document.querySelector('[aria-label="Foundation details"]')).toBeNull();
    act(() =>
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })),
    );
    expect(document.querySelector('[role=dialog]')).toBeNull();
  });
  it('reuses Materials concrete inputs rather than keeping a second ratio', () => {
    const select = document.querySelector<HTMLSelectElement>('.foundation-details details select')!;
    act(() => {
      select.value = 'site-mix';
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });
    number('Sand parts', '3.5');
    expect(usePropertyStore.getState().property.materials?.concrete).toMatchObject({
      supply: 'site-mix',
      sand: 3.5,
    });
  });
  it('saves clean snapped negative geometry and counts overlapping concrete once', () => {
    click('Slab / raft');
    point(-1.24, -2.61);
    point(10.14, 0.64);
    click('Add concrete');
    const model = () => usePropertyStore.getState().property.foundation!;
    expect(model().elements[0]).toMatchObject({
      x: 4.45,
      y: -0.975,
      lengthM: 11.4,
      widthM: 3.25,
    });
    expect(document.querySelector<HTMLInputElement>('[aria-label="Length m"]')!.value).toBe('11.4');
    expect(foundationVolumeM3(model())).toBeCloseTo(7.41, 10);
    // A second slab wholly inside the first must not add its concrete again.
    click('Slab / raft');
    point(-0.49, -1.49);
    point(0.49, -0.49);
    click('Add concrete');
    expect(model().elements[1]).toMatchObject({ x: 0, y: -1, lengthM: 1, widthM: 1 });
    expect(foundationVolumeM3(model())).toBeCloseTo(7.41, 10);
    expect(document.querySelectorAll('.foundation-totals strong')[1]!.textContent).toBe('7.41 m³');
    // Moving on the grid must preserve a more precise, explicitly typed depth.
    number('Concrete depth m', '0.2345');
    click('Move element');
    point(-3.124, -4.576);
    expect(model().elements[1]).toMatchObject({ x: -3.1, y: -4.6, depthM: 0.2345 });
    expect(foundationVolumeM3(model())).toBeCloseTo(7.6445, 10);
  });
  it('accepts the minimum snapped width despite decimal subtraction noise', () => {
    click('Strip footing');
    point(-0.16, -0.16);
    point(-0.04, -0.04);
    expect(usePropertyStore.getState().property.foundation?.elements[0]).toMatchObject({
      x: -0.1,
      y: -0.1,
      lengthM: 0.1,
      widthM: 0.1,
    });
  });
  it('edits the hole independently and fills from its bottom without resetting the view', () => {
    click('Slab / raft');
    point(0, 0);
    point(10, 8);
    const view = plan().getAttribute('viewBox');
    number('Excavation depth m', '1.5');
    number('Concrete depth m', '0.3');
    expect(usePropertyStore.getState().property.foundation?.elements[0]).toMatchObject({
      depthM: 0.3,
      topElevationM: -1.2,
      excavation: { depthM: 1.5, stage: 'excavated' },
    });
    expect(document.querySelectorAll('.foundation-totals strong')[0]!.textContent).toBe('120 m³');
    expect(document.querySelectorAll('.foundation-totals strong')[1]!.textContent).toBe('0 m³');
    expect(document.querySelector('.foundation-pending')!.textContent).toContain('24 m³');
    click('Add concrete');
    expect(foundationVolumeM3(usePropertyStore.getState().property.foundation)).toBeCloseTo(24);
    expect(document.querySelector('.foundation-pending')).toBeNull();
    expect(plan().getAttribute('viewBox')).toBe(view);
    click('Show excavation only');
    expect(foundationVolumeM3(usePropertyStore.getState().property.foundation)).toBe(0);
    const supply = document.querySelector<HTMLSelectElement>(
      '[aria-label="Concrete product reference"]',
    )!;
    act(() => {
      supply.value = 'premix-classics';
      supply.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(usePropertyStore.getState().property.foundation?.concreteProductId).toBe(
      'premix-classics',
    );
  });
});
