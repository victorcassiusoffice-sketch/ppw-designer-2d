/** @vitest-environment jsdom */
import { afterEach, beforeEach, expect, it } from 'vitest';
import { normaliseLoadedProperty, usePropertyStore } from '../propertyStore';
import { __test, installHistorySubscriptions, useHistoryStore } from '../historyStore';
import { defaultFoundationRebar, type FoundationModel } from '../../designer/foundation';
import { applyPage, captureCurrentPage, propertyHasContent } from '../../lib/pages';
import { clearEntireDesign } from '../../lib/clearActions';
import { servicePorts } from '../../designer/serviceConnections';
import type { BuildingServices } from '../../designer/buildingServices';
let stop: (() => void) | undefined;
const model = (): FoundationModel => ({ version: 1, enabled: true, elements: [{ id: 'pad-a', name: 'Pad A', kind: 'pad', x: 2, y: 3, lengthM: 2, widthM: 2, depthM: .4, topElevationM: -.3, rebar: defaultFoundationRebar() }] });
beforeEach(() => { __test.resetSubscriptions(); localStorage.clear(); sessionStorage.clear(); usePropertyStore.getState().resetToDefault(); useHistoryStore.getState().reset(); });
afterEach(() => { stop?.(); stop = undefined; __test.resetSubscriptions(); });

it('counts foundation-only work as content and preserves metres/depth through page and disk reload', async () => {
  const data = model();
  expect(usePropertyStore.getState().setFoundation(data)).toBe(true);
  expect(propertyHasContent(usePropertyStore.getState().property)).toBe(true);
  const page = captureCurrentPage();
  const saved = localStorage.getItem('ppw_property_v2')!;
  usePropertyStore.getState().resetToDefault();
  applyPage(page);
  expect(usePropertyStore.getState().property.foundation).toEqual(data);
  expect(normaliseLoadedProperty(JSON.parse(JSON.stringify(usePropertyStore.getState().property))).foundation).toEqual(data);
  localStorage.setItem('ppw_property_v2', saved);
  await usePropertyStore.persist.rehydrate();
  expect(usePropertyStore.getState().property.foundation).toEqual(data);
});
it('rejects an invalid foundation edit and restores complete work with Clear Undo', () => {
  const data = model();
  usePropertyStore.getState().setFoundation(data);
  expect(usePropertyStore.getState().setFoundation({ ...data, elements: [{ ...data.elements[0], depthM: -1 }] })).toBe(false);
  expect(usePropertyStore.getState().property.foundation).toEqual(data);
  stop = installHistorySubscriptions();
  clearEntireDesign();
  expect(usePropertyStore.getState().property.foundation).toBeUndefined();
  useHistoryStore.getState().undo();
  expect(usePropertyStore.getState().property.foundation).toEqual(data);
});
it('refreshes connected coordinates from fixtures at both the store and saved-property boundary', () => {
  const data: BuildingServices = { version: 1, fixtures: [{ id: 'tap', levelId: 'ground', kind: 'mains-tap', x: 4, y: 6, widthM: .12, depthM: .16, heightM: .6, rotation: 0 }], runs: [{ id: 'r', levelId: 'ground', system: 'cold-water', materialId: 'hpl-aquasafe-upvc-20', diameterMm: 20, points: [{ x: 0, y: 0 }, { x: 9, y: 8 }], startElevationM: 0, endElevationM: -.3, startConnection: { fixtureId: 'tap', portId: 'cold-water' } }] };
  expect(usePropertyStore.getState().setServices(data)).toBe(true);
  const port = servicePorts(data.fixtures[0])[0];
  expect(usePropertyStore.getState().property.services?.runs[0].points[0]).toEqual({ x: port.x, y: port.y });
  const loaded = normaliseLoadedProperty({ ...usePropertyStore.getState().property, services: data });
  expect(loaded.services?.runs[0].startElevationM).toBe(port.elevationM);
});
