// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { WallHeightControl } from '../WallHeightControl';
import { usePropertyStore } from '../../store/propertyStore';

let container: HTMLDivElement;
let root: Root;
beforeEach(() => {
  usePropertyStore.getState().resetToDefault();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});
const render = () => act(() => root.render(<WallHeightControl idPrefix="height" />));
const clickUp = () => act(() => (container.querySelector('[data-testid="height-up"]') as HTMLButtonElement).click());

describe('active-floor wall height controls', () => {
  it('keeps single-floor buttons wired to the existing global property height', () => {
    render();
    expect(container.textContent).toContain('2.7 m');
    clickUp();
    expect(usePropertyStore.getState().property.wallHeightM).toBe(2.8);
    expect(usePropertyStore.getState().property.levels).toBeUndefined();
  });

  it('changes only the selected storey and reads its explicit height', () => {
    const store = usePropertyStore.getState();
    store.setWallHeight(2.8);
    const upper = store.addLevel();
    store.setLevelHeight(upper, 3.2);
    render();
    expect(container.textContent).toContain('3.2 m');
    clickUp();
    const property = usePropertyStore.getState().property;
    expect(property.levels?.find((level) => level.id === upper)?.heightM).toBe(3.3);
    expect(property.wallHeightM).toBe(2.8);
    expect(property.levels?.find((level) => level.id === 'ground')?.heightM).toBeUndefined();
  });

  it('shows no wall controls on the roof and retains a ground override after other floors are removed', () => {
    const store = usePropertyStore.getState();
    store.setLevelHeight('ground', 3.4);
    store.ensureRoofLevel();
    render();
    expect(container.querySelector('[data-testid="height-control"]')).toBeNull();
    act(() => { store.setActiveLevel('ground'); store.removeLevel('roof'); });
    clickUp();
    expect(usePropertyStore.getState().property.levels?.[0].heightM).toBe(3.5);
    expect(usePropertyStore.getState().property.wallHeightM).toBeUndefined();
  });
});
