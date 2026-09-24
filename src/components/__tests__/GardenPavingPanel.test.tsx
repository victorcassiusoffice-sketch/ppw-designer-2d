/** @vitest-environment jsdom */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GardenPanel } from '../GardenPanel';
import { usePropertyStore } from '../../store/propertyStore';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  usePropertyStore.getState().resetToDefault();
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});
afterEach(() => { act(() => root.unmount()); host.remove(); });

describe('GardenPanel sourced paving', () => {
  it('adds the selected slab as a saved path and updates measured quantity after resizing', () => {
    const place = vi.fn();
    act(() => root.render(<GardenPanel architectural onRequestPlacement={place} />));
    const product = host.querySelector<HTMLSelectElement>('[aria-label="New paving product"]')!;
    act(() => { product.value = 'em-ubp-rusclaord001'; product.dispatchEvent(new Event('change', { bubbles: true })); });
    act(() => host.querySelector<HTMLButtonElement>('[data-testid="garden-add-paving"]')!.click());
    const patch = usePropertyStore.getState().property.garden!.surfaces[0];
    expect(patch).toMatchObject({ kind: 'path', pavingProductId: 'em-ubp-rusclaord001', widthM: 1.2, depthM: 4 });
    expect(place).toHaveBeenCalledWith({ kind: 'surface', id: patch.id });
    expect(host.querySelector('[data-testid="garden-paving-estimate"]')?.textContent).toContain('48 pieces');
    act(() => usePropertyStore.getState().updateGardenSurface(patch.id, { widthM: 2, depthM: 1 }));
    expect(host.querySelector('[data-testid="garden-paving-estimate"]')?.textContent).toContain('16 pieces');
    expect(host.querySelector('[data-testid="garden-paving-total"]')?.textContent).toContain('2,976.00');
    expect(host.querySelector('a[href="https://www.espacemaison.mu/products/grey-rustic-pavement-50-25-cm-1"]')).not.toBeNull();
    const saved = JSON.parse(JSON.stringify(usePropertyStore.getState().property));
    act(() => usePropertyStore.getState().loadProperty(saved));
    expect(usePropertyStore.getState().property.garden?.surfaces[0].pavingProductId).toBe('em-ubp-rusclaord001');
  });

  it('removes product pricing when a patch becomes generic concrete', () => {
    act(() => root.render(<GardenPanel />));
    act(() => host.querySelector<HTMLButtonElement>('[data-testid="garden-add-paving"]')!.click());
    const surface = host.querySelector<HTMLSelectElement>('[aria-label="Surface material"]')!;
    act(() => { surface.value = 'concrete'; surface.dispatchEvent(new Event('change', { bubbles: true })); });
    expect(usePropertyStore.getState().property.garden?.surfaces[0]).toMatchObject({ kind: 'concrete' });
    expect(usePropertyStore.getState().property.garden?.surfaces[0].pavingProductId).toBeUndefined();
    expect(host.querySelector('[data-testid="garden-paving-estimate"]')).toBeNull();
    expect(host.querySelector('[data-testid="garden-paving-total"]')).toBeNull();
  });
});
