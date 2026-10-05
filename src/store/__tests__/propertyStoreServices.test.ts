/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { normaliseLoadedProperty, usePropertyStore } from '../propertyStore';
import { __test, installHistorySubscriptions, useHistoryStore } from '../historyStore';
import { DRAFT_ID, useDesignsStore } from '../designsStore';
import { applyPage, captureCurrentPage, createPage, propertyHasContent, switchToPage } from '../../lib/pages';
import { clearEntireDesign } from '../../lib/clearActions';
import type { BuildingServices, ServiceRun } from '../../designer/buildingServices';

const route = (id: string, levelId = 'ground'): ServiceRun => ({ id, levelId, system: 'cold-water', materialId: 'hpl-aquasafe-upvc-20', diameterMm: 20, points: [{ x: 1, y: 1 }, { x: 4, y: 1 }], startElevationM: -.3, endElevationM: -.3 });
const fixture = (levelId = 'ground') => ({ id: 'toilet-1', levelId, kind: 'toilet' as const, x: 2, y: 3, widthM: .4, depthM: .7, heightM: .78, rotation: 90 });
const services = (): BuildingServices => ({ version: 1, runs: [route('ground-pipe')], fixtures: [fixture()] });
let unsubscribe: (() => void) | undefined;
beforeEach(() => {
  __test.resetSubscriptions(); localStorage.clear(); sessionStorage.clear();
  usePropertyStore.getState().resetToDefault(); useHistoryStore.getState().reset();
  useDesignsStore.setState({ designs: {}, currentId: null });
});
afterEach(() => { unsubscribe?.(); unsubscribe = undefined; __test.resetSubscriptions(); });

describe('service persistence and floor ownership', () => {
  it('retains distinct ground and upper-floor routes through JSON and page bundle loading', () => {
    const store = usePropertyStore.getState(), upper = store.addLevel('First floor');
    const data: BuildingServices = { version: 1, runs: [route('ground-pipe'), route('upper-pipe', upper)], fixtures: [fixture(upper)] };
    store.setServices(data);
    const saved = JSON.parse(JSON.stringify(usePropertyStore.getState().property));
    expect(normaliseLoadedProperty(saved).services).toEqual(data);
    const page = captureCurrentPage();
    store.resetToDefault(); expect(usePropertyStore.getState().property.services).toBeUndefined();
    applyPage(page); expect(usePropertyStore.getState().property.services).toEqual(data);
    store.setActiveLevel('ground'); expect(usePropertyStore.getState().property.services).toEqual(data);
    store.setActiveLevel(upper); expect(usePropertyStore.getState().property.services).toEqual(data);
  });
  it('round-trips current-version localStorage including services on their original levels', async () => {
    const data = services();
    usePropertyStore.getState().setServices(data);
    const saved = localStorage.getItem('ppw_property_v2'); expect(saved).not.toBeNull();
    usePropertyStore.getState().resetToDefault();
    localStorage.setItem('ppw_property_v2', saved!);
    await usePropertyStore.persist.rehydrate();
    expect(usePropertyStore.getState().property.services).toEqual(data);
  });
  it('does not add services to old saved properties and removes ghost floors on load', () => {
    const old = usePropertyStore.getState().property;
    expect(normaliseLoadedProperty(old).services).toBeUndefined();
    expect(normaliseLoadedProperty({ ...old, services: { version: 1, runs: [route('valid'), route('ghost', 'missing')], fixtures: [fixture('missing')] } }).services).toEqual({ version: 1, runs: [route('valid')], fixtures: [] });
  });
  it('prevents floor deletion when only service routes or fixtures remain', () => {
    const store = usePropertyStore.getState(), upper = store.addLevel('Empty upper floor');
    store.setServices({ version: 1, runs: [route('upper-only', upper)], fixtures: [] });
    expect(store.removeLevel(upper)).toBe(false);
    store.setServices({ version: 1, runs: [], fixtures: [fixture(upper)] });
    expect(store.removeLevel(upper)).toBe(false);
    store.setServices({ version: 1, runs: [], fixtures: [] });
    expect(store.removeLevel(upper)).toBe(true);
  });
  it.each([
    (data: BuildingServices) => ({ ...data, runs: [...data.runs, route('bad-floor', 'missing')] }),
    (data: BuildingServices) => ({ ...data, runs: [...data.runs, { ...route('bad-points'), points: [{ x: 1, y: 1 }] }] }),
    (data: BuildingServices) => ({ ...data, runs: [...data.runs, { ...route('bad-coordinate'), points: [{ x: 1, y: 1 }, { x: 10001, y: 1 }] }] }),
    (data: BuildingServices) => ({ ...data, fixtures: [...data.fixtures, { ...fixture(), id: 'invalid', widthM: -1 }] }),
    (data: BuildingServices) => ({ ...data, runs: [...data.runs, { ...data.runs[0] }] }),
  ])('rejects the complete UI edit rather than silently storing partial content', invalid => {
    const store = usePropertyStore.getState(); store.setServices(services());
    const previous = usePropertyStore.getState().property;
    store.setServices(invalid(services()));
    expect(usePropertyStore.getState().property).toBe(previous);
  });
});

describe('service history, Clear and separate plans', () => {
  it('restores all service geometry in a single undo/redo frame', () => {
    unsubscribe = installHistorySubscriptions({ coalesceMs: 0 });
    usePropertyStore.getState().setServices(services());
    useHistoryStore.getState().undo(); expect(usePropertyStore.getState().property.services).toBeUndefined();
    useHistoryStore.getState().redo(); expect(usePropertyStore.getState().property.services).toEqual(services());
    const moved = services(); moved.fixtures[0].x = 5;
    usePropertyStore.getState().setServices(moved);
    useHistoryStore.getState().undo(); expect(usePropertyStore.getState().property.services).toEqual(services());
  });
  it('Clear all removes services and undo brings the complete services plan back', () => {
    usePropertyStore.getState().setServices(services());
    unsubscribe = installHistorySubscriptions({ coalesceMs: 0 });
    clearEntireDesign(); expect(usePropertyStore.getState().property.services).toBeUndefined();
    useHistoryStore.getState().undo(); expect(usePropertyStore.getState().property.services).toEqual(services());
    useHistoryStore.getState().redo(); expect(usePropertyStore.getState().property.services).toBeUndefined();
  });
  it('promotes a services-only draft so starting a fresh plan cannot strand it', () => {
    usePropertyStore.getState().renameProperty('Plumbing study');
    usePropertyStore.getState().setServices(services());
    expect(propertyHasContent(usePropertyStore.getState().property)).toBe(true);
    const next = createPage('Another client');
    expect(usePropertyStore.getState().property.services).toBeUndefined();
    const saved = Object.values(useDesignsStore.getState().designs).find(d => d.id !== DRAFT_ID && d.id !== next && d.name === 'Plumbing study');
    expect(saved).toBeDefined();
    expect(switchToPage(saved!.id)).toBe(true);
    expect(usePropertyStore.getState().property.services).toEqual(services());
    switchToPage(next); expect(usePropertyStore.getState().property.services).toBeUndefined();
  });
  it('preserves edited services independently when switching between named client plans', () => {
    const first = createPage('Client A'); usePropertyStore.getState().setServices(services());
    const second = createPage('Client B');
    const different = services(); different.runs[0].points[1].x = 8;
    usePropertyStore.getState().setServices(different);
    switchToPage(first); expect(usePropertyStore.getState().property.services).toEqual(services());
    switchToPage(second); expect(usePropertyStore.getState().property.services).toEqual(different);
    expect(useHistoryStore.getState().past).toEqual([]);
  });
});
