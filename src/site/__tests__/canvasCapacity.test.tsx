// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RoomCanvas } from '../../components/RoomCanvas';
import { installCanvasSiteAdapter } from '../../components/canvasSiteBridge';
import { usePropertyStore } from '../../store/propertyStore';
import { hydrateCurrentSite } from '../hydration';
import { makeSite, toLonLat } from '../geometry';

// Only the canvas drawing host is absent in jsdom. The actual RoomCanvas DOM
// capacity readout, selectors, opaque guard and canonical area remain real.
vi.mock('react-konva', async () => {
  const { forwardRef } = await import('react');
  return {
    Stage: forwardRef(() => null), Layer: forwardRef(() => null), Line: () => null, Group: () => null,
    Text: () => null, Circle: () => null, Rect: () => null, Shape: () => null, Image: () => null,
  };
});
const original = usePropertyStore.getState().property;
const legacy = { widthM: 10, depthM: 10, originM: { x: 0, y: 0 } };
let host: HTMLDivElement;
let root: Root;
function capacityText() {
  return host.querySelector('[data-testid="plot-capacity"]')?.textContent;
}
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} unobserve() {} });
  installCanvasSiteAdapter(undefined);
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  installCanvasSiteAdapter(undefined);
  usePropertyStore.setState({ property: original });
  vi.unstubAllGlobals();
});
describe('actual RoomCanvas capacity readout', () => {
  it('shows the legacy rectangular quantity but no pending-world quantity, then shows canonical concave area', async () => {
    await act(async () => {
      usePropertyStore.setState({ property: { ...original, site: legacy } });
      root.render(<MemoryRouter><RoomCanvas /></MemoryRouter>);
    });
    expect(capacityText()).toContain('Plot 100 m²');
    const world = makeSite([
      { x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 4 },
      { x: 4, y: 4 }, { x: 4, y: 10 }, { x: 0, y: 10 },
    ].map(point => toLonLat(point, [57.3776792, -20.3292161])), 'Concave plot', { x: 0, y: 0 });
    await act(async () => usePropertyStore.setState({ property: { ...original, site: { ...legacy, world } } }));
    expect(capacityText()).toBeUndefined();
    await act(async () => hydrateCurrentSite());
    expect(capacityText()).toContain('Plot 64 m²');
    expect(capacityText()).not.toContain('Plot 100 m²');
  });
});
