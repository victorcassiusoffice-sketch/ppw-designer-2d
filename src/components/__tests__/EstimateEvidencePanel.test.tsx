/** @vitest-environment jsdom */
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it } from 'vitest';
import { EstimateEvidencePanel } from '../EstimateEvidencePanel';
import type { Property } from '../../store/propertyStore';
import { __setApiProductForTests } from '../../data/apiCatalogAdapter';
import { getAllProducts } from '../../data/products';
import { useCatalogStore } from '../../store/catalogStore';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
describe('estimate evidence panel', () => {
  it('keeps scope collapsed and distinguishes input presence from unavailable independent validation', () => {
    const host = document.createElement('div'), root = createRoot(host);
    const property: Property = { id: 'private', name: 'Private client', activeRoomId: 'r', rooms: [] };
    act(() => root.render(<EstimateEvidencePanel property={property} />));
    const details = host.querySelector<HTMLDetailsElement>('[data-testid="estimate-evidence"]')!;
    expect(details.open).toBe(false);
    expect(host.textContent).toContain('12 modules');
    expect(host.textContent).toContain('Input checks present');
    expect(host.textContent).toContain('Presence only');
    expect(host.textContent).toContain('Independent validation · not available');
    expect(host.textContent).not.toContain('Private client');
    expect(host.textContent).not.toMatch(/\bMUR\b|\bRs\b|Courts Mammouth|Espace Maison|\d+\s*%/);
    expect(host.querySelectorAll('.estimate-engine')).toHaveLength(12);
    act(() => root.unmount());
  });
  it('refreshes source coverage when the merchant catalogue arrives without changing the property', () => {
    const host = document.createElement('div'), root = createRoot(host);
    const product = { ...getAllProducts()[0], id: 'm-evidence-late', source_url: 'https://example.com/verified-location', dimensions_cm: { length: 80, width: 40, height: 20 } };
    const property: Property = { id: 'p', name: 'Project', activeRoomId: 'r', rooms: [{ id: 'r', name: 'Room', polygon: [], placedItems: [{ instanceId: 'i', productId: product.id, x: 1, y: 1, rotation: 0 }] }] };
    act(() => root.render(<EstimateEvidencePanel property={property} />));
    expect(host.textContent).toContain('0 of 1 unique placed products have a recorded web source');
    act(() => { __setApiProductForTests(product.id, product); useCatalogStore.getState().bump(); });
    expect(host.textContent).toContain('1 of 1 unique placed products have a recorded web source');
    expect(host.textContent).toContain('Links have not been independently reverified here');
    act(() => root.unmount()); __setApiProductForTests(product.id, null);
  });
});
