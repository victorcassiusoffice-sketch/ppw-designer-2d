/** @vitest-environment jsdom */
import { act, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CityWorkspace } from '../CityWorkspace';
import { usePropertyStore } from '../../store/propertyStore';
import { useCityProcurementStore } from '../../store/cityProcurementStore';
import { useDesignerUIStore } from '../../store/designerUIStore';
import { sampleCity } from '../../designer/city';

vi.mock('../CityOrdersPanel', () => ({
  CityOrdersPanel: ({ onDirtyChange }: { onDirtyChange?: (dirty: boolean) => void }) => {
    useEffect(() => () => onDirtyChange?.(false), [onDirtyChange]);
    return (
      <section aria-label="Test supplier editor">
        <button onClick={() => onDirtyChange?.(true)}>Edit supplier draft</button>
        <button onClick={() => onDirtyChange?.(false)}>Save supplier draft</button>
      </section>
    );
  },
}));
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root, host: HTMLDivElement;
const button = (text: string) =>
  [...document.querySelectorAll<HTMLButtonElement>('[data-testid="city-workspace"] button')].find(
    (b) => b.textContent?.trim() === text,
  )!;
function click(text: string) {
  expect(button(text), text).toBeDefined();
  act(() => button(text).click());
}
function type(label: string, value: string) {
  const input = document.querySelector<HTMLInputElement>(`input[aria-label="${label}"]`)!;
  expect(input, label).not.toBeNull();
  act(() => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  act(() => input.dispatchEvent(new FocusEvent('focusout', { bubbles: true })));
  return input;
}
beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  window.history.replaceState({}, '', '/designer');
  usePropertyStore.getState().resetToDefault();
  useCityProcurementStore.setState({ plans: {}, cloud: {} });
  useDesignerUIStore.getState().setViewMode('plan');
  const property = usePropertyStore.getState().property;
  usePropertyStore.getState().loadProperty({
    ...property,
    rooms: [
      {
        id: 'main-room',
        name: 'House',
        polygon: [
          { x: 0, y: 0 },
          { x: 6, y: 0 },
          { x: 6, y: 4 },
          { x: 0, y: 4 },
        ],
        placedItems: [],
      },
    ],
  });
  usePropertyStore.getState().setCity(sampleCity());
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  act(() => root.render(<CityWorkspace onBeforeOpen={() => undefined} />));
  act(() => window.dispatchEvent(new Event('ppw:open-city')));
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.restoreAllMocks();
});

describe('City workspace integration protections', () => {
  it('keeps the same plan instance across catalogue and overview tabs', () => {
    const plan = document.querySelector('[data-testid="city-plan"]');
    click('Infrastructure');
    expect(document.querySelector('[data-testid="city-plan"]')).toBe(plan);
    expect(plan?.closest('[hidden]')).not.toBeNull();
    click('Overview');
    click('Plan');
    expect(document.querySelector('[data-testid="city-plan"]')).toBe(plan);
    expect(plan?.closest('[hidden]')).toBeNull();
  });
  it('blocks parent tabs, Back and Escape while a supplier draft has unsaved changes', () => {
    click('Orders');
    click('Edit supplier draft');
    click('Overview');
    expect(document.querySelector('[aria-label="Test supplier editor"]')).not.toBeNull();
    expect(document.querySelector('[role="status"]')?.textContent).toContain(
      'Save the supplier package',
    );
    click('Back to building');
    expect(document.querySelector('[data-testid="city-workspace"]')).not.toBeNull();
    act(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
    expect(document.querySelector('[aria-label="Test supplier editor"]')).not.toBeNull();
    click('Save supplier draft');
    expect(document.querySelector('[role="status"]')?.textContent ?? '').not.toContain(
      'Save the supplier package',
    );
    click('Overview');
    expect(document.querySelector('[aria-label="Test supplier editor"]')).toBeNull();
    click('Back to building');
    expect(document.querySelector('[data-testid="city-workspace"]')).toBeNull();
  });
  it('keeps accepted geometry in the editor when a cross-field pipe dimension is rejected', () => {
    click('Water main — proposed corridor');
    const input = type('Outside diameter (mm)', '1000');
    expect(usePropertyStore.getState().property.city!.networks[0].diameterMm).toBe(100);
    expect(input.value).toBe('100');
    expect(document.querySelector('[role="status"]')?.textContent).toContain(
      'last valid design is kept',
    );
  });
  it('refreshes measured building dimensions without deleting supplier or performance metadata', () => {
    const before = usePropertyStore.getState().property.city!;
    const linked = {
      ...before.assets[0],
      name: 'My connected building',
      supplierRef: 'supplier-reference',
      powerW: 5000,
      hoursPerDay: 8,
    };
    act(() =>
      usePropertyStore
        .getState()
        .setCity({ ...before, assets: [linked, ...before.assets.slice(1)] }),
    );
    const rooms = usePropertyStore.getState().property.rooms;
    click('Refresh building envelope');
    const after = usePropertyStore
      .getState()
      .property.city!.assets.find((a) => a.buildingLink === 'current')!;
    expect(after).toMatchObject({
      id: linked.id,
      name: linked.name,
      supplierRef: 'supplier-reference',
      powerW: 5000,
      hoursPerDay: 8,
      widthM: 6,
      lengthM: 4,
      x: 3,
      y: 2,
    });
    expect(usePropertyStore.getState().property.rooms).toEqual(rooms);
  });
  it('reports package-limit failures without throwing or removing the existing schedule', () => {
    click('Main access — edit section');
    const upsert = vi
      .spyOn(useCityProcurementStore.getState(), 'upsertPackage')
      .mockImplementation(() => {
        throw new Error('Package limit');
      });
    click('Prepare order');
    expect(upsert).toHaveBeenCalledOnce();
    expect(document.querySelector('[role="status"]')?.textContent).toContain(
      'existing schedule is kept',
    );
    expect(document.querySelector('[data-testid="city-plan"]')?.closest('[hidden]')).toBeNull();
  });
});
