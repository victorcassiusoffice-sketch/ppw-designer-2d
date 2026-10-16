/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { normaliseLoadedProperty, usePropertyStore } from '../propertyStore';
import { __test, installHistorySubscriptions, useHistoryStore } from '../historyStore';
import { emptyCity, sampleCity } from '../../designer/city';
import { applyPage, captureCurrentPage, propertyHasContent } from '../../lib/pages';
import { clearEntireDesign } from '../../lib/clearActions';
import { defaultFoundationRebar } from '../../designer/foundation';
let stop: (() => void) | undefined;
beforeEach(() => {
  __test.resetSubscriptions();
  localStorage.clear();
  sessionStorage.clear();
  usePropertyStore.getState().resetToDefault();
  useHistoryStore.getState().reset();
});
afterEach(() => {
  stop?.();
  stop = undefined;
  __test.resetSubscriptions();
});

describe('saved City Build and existing house coexistence', () => {
  it('round-trips city-only content through pages, loading and local persistence', async () => {
    const data = sampleCity();
    expect(usePropertyStore.getState().setCity(data)).toBe(true);
    expect(propertyHasContent(usePropertyStore.getState().property)).toBe(true);
    const page = captureCurrentPage();
    const saved = localStorage.getItem('ppw_property_v2')!;
    usePropertyStore.getState().resetToDefault();
    expect(usePropertyStore.getState().property.city).toBeUndefined();
    applyPage(page);
    expect(usePropertyStore.getState().property.city).toEqual(data);
    expect(
      normaliseLoadedProperty(JSON.parse(JSON.stringify(usePropertyStore.getState().property)))
        .city,
    ).toEqual(data);
    usePropertyStore.getState().resetToDefault();
    localStorage.setItem('ppw_property_v2', saved);
    await usePropertyStore.persist.rehydrate();
    expect(usePropertyStore.getState().property.city).toEqual(data);
  });
  it('does not create a city or overwrite dimensions when loading legacy house projects', () => {
    const before = usePropertyStore.getState().property;
    const loaded = normaliseLoadedProperty(JSON.parse(JSON.stringify(before)));
    expect(loaded.city).toBeUndefined();
    expect(loaded.rooms).toMatchObject(before.rooms);
    expect(loaded.site).toEqual(before.site);
  });
  it('preserves house rooms, furniture, garden, measured foundation and household services during city edits', () => {
    const store = usePropertyStore.getState();
    store.addGardenSurface({ kind: 'lawn', x: 3, y: 5, widthM: 4, depthM: 3, elevationM: 0 });
    store.setFoundation({
      version: 1,
      enabled: true,
      elements: [
        {
          id: 'pad',
          name: 'Pad',
          kind: 'pad',
          x: 2,
          y: 2,
          lengthM: 2,
          widthM: 2,
          depthM: 0.4,
          topElevationM: 0,
          rebar: defaultFoundationRebar(),
        },
      ],
    });
    store.setServices({
      version: 1,
      fixtures: [
        {
          id: 'tap',
          levelId: 'ground',
          kind: 'mains-tap',
          x: 3,
          y: 3,
          widthM: 0.2,
          depthM: 0.2,
          heightM: 0.6,
          rotation: 0,
        },
      ],
      runs: [],
    });
    const before = JSON.parse(JSON.stringify(usePropertyStore.getState().property));
    expect(store.setCity(sampleCity())).toBe(true);
    const withCity = usePropertyStore.getState().property;
    const { city: cityData, ...house } = withCity;
    expect(cityData).toEqual(sampleCity());
    expect(house).toEqual(before);
    expect(
      store.setCity({
        ...sampleCity(),
        site: { originM: { x: -100, y: -100 }, widthM: 1000, lengthM: 800 },
      }),
    ).toBe(true);
    expect(usePropertyStore.getState().property.rooms).toEqual(before.rooms);
    expect(usePropertyStore.getState().property.site).toEqual(before.site);
  });
  it('rejects invalid city edits atomically without deleting previous work', () => {
    const store = usePropertyStore.getState();
    store.setCity(sampleCity());
    const before = usePropertyStore.getState().property;
    expect(
      store.setCity({ ...sampleCity(), roads: [{ ...sampleCity().roads[0], widthM: -5 }] }),
    ).toBe(false);
    expect(usePropertyStore.getState().property).toBe(before);
    expect(
      store.setCity({ ...emptyCity(), assets: [{ ...sampleCity().assets[0], widthM: Infinity }] }),
    ).toBe(false);
    expect(usePropertyStore.getState().property).toBe(before);
  });
  it('undoes and redoes city changes alongside all house content', () => {
    const before = JSON.parse(JSON.stringify(usePropertyStore.getState().property));
    stop = installHistorySubscriptions();
    usePropertyStore.getState().setCity(sampleCity());
    useHistoryStore.getState().flush();
    useHistoryStore.getState().undo();
    expect(usePropertyStore.getState().property).toEqual(before);
    useHistoryStore.getState().redo();
    expect(usePropertyStore.getState().property.city).toEqual(sampleCity());
    expect(usePropertyStore.getState().property.rooms).toEqual(before.rooms);
  });
  it('clear-all remains reversible and restores the complete city', () => {
    usePropertyStore.getState().setCity(sampleCity());
    const before = JSON.parse(JSON.stringify(usePropertyStore.getState().property));
    stop = installHistorySubscriptions();
    clearEntireDesign();
    expect(usePropertyStore.getState().property.city).toBeUndefined();
    useHistoryStore.getState().undo();
    expect(usePropertyStore.getState().property).toEqual(before);
  });
  it('counts each city-only content family, including a data-centre scenario', () => {
    const base = usePropertyStore.getState().property;
    const emptyHouse = { ...base, rooms: [] };
    expect(propertyHasContent({ ...emptyHouse, city: emptyCity() })).toBe(false);
    for (const patch of [
      { roads: sampleCity().roads },
      { networks: sampleCity().networks },
      { assets: sampleCity().assets },
      { dataCentre: sampleCity().dataCentre },
    ]) {
      expect(propertyHasContent({ ...emptyHouse, city: { ...emptyCity(), ...patch } })).toBe(true);
    }
  });
});
