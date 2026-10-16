/** @vitest-environment jsdom */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { GardenPanel } from '../GardenPanel';
import { usePropertyStore } from '../../store/propertyStore';
import { useGardenEditorStore } from '../../store/gardenEditorStore';
import { useMeasuredPathToolStore } from '../../store/measuredPathToolStore';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let host: HTMLDivElement, root: Root;
beforeEach(() => {
  usePropertyStore.getState().resetToDefault(); useGardenEditorStore.getState().close();
  useMeasuredPathToolStore.getState().cancel();
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
  act(() => root.render(<GardenPanel />));
});
afterEach(() => { act(() => root.unmount()); host.remove(); });
const click = (testId: string) => act(() => host.querySelector<HTMLButtonElement>(`[data-testid="${testId}"]`)!.click());
const select = (label: string, value: string) => act(() => { const node = host.querySelector<HTMLSelectElement>(`[aria-label="${label}"]`)!; node.value = value; node.dispatchEvent(new Event('change', { bubbles: true })); });
function number(label: string, value: string) {
  const node = host.querySelector<HTMLInputElement>(`[aria-label="${label} in metres"]`)!;
  act(() => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(node, value); node.dispatchEvent(new Event('input', { bubbles: true })); });
  act(() => node.dispatchEvent(new FocusEvent('focusout', { bubbles: true })));
}
describe('reachable outdoor building tools', () => {
  it('adds a real tarmac surface and edits thickness without changing plan dimensions', () => {
    click('garden-add-tarmac'); number('Material thickness', '.08'); number('Sub-base depth', '.2');
    const s = usePropertyStore.getState().property.garden!.surfaces[0];
    expect(s).toMatchObject({ kind: 'tarmac', widthM: 4, depthM: 4, thicknessM: .08, subBaseDepthM: .2 });
    expect(host.querySelector('[data-testid="outdoor-layer-quantities"]')?.textContent).toContain('1.280 m³');
  });
  it('adds and sizes a pool, preserves it across stage changes and keeps supplier data explicitly separate', () => {
    click('garden-add-pool'); number('Basin depth', '2'); number('Water depth', '1.8');
    const before = host.querySelector('[data-testid="pool-quantities"]')!.textContent;
    select('Pool construction stage', 'excavation');
    expect(host.querySelector('[data-testid="pool-quantities"]')!.textContent).toBe(before);
    select('Mauritius pool reference', 'nabridas-diamond-10');
    expect(usePropertyStore.getState().property.garden!.surfaces[0].pool).toMatchObject({ shellDepthM: 2, waterDepthM: 1.8, stage: 'excavation', productReferenceId: 'nabridas-diamond-10' });
    expect(host.querySelector('[data-testid="pool-supplier-reference"]')!.textContent).toContain('supplier volume 42 m³');
    expect(host.querySelector('[data-testid="pool-quantities"]')!.textContent).toContain('Water 28.80 m³');
    number('Water depth', '3');
    expect(usePropertyStore.getState().property.garden!.surfaces[0].pool?.waterDepthM).toBe(1.8);
  });
  it('arms the shared curved outdoor tool without saving a phantom surface', () => {
    select('Outdoor outline material', 'tarmac'); click('garden-outline-quadratic');
    expect(useMeasuredPathToolStore.getState()).toMatchObject({ target: 'garden', surfaceKind: 'tarmac', segmentKind: 'quadratic' });
    expect(usePropertyStore.getState().property.garden).toBeUndefined();
  });
});
