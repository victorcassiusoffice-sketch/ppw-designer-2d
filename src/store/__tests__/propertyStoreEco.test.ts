/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { normaliseLoadedProperty, usePropertyStore } from '../propertyStore';
import { __test, installHistorySubscriptions, useHistoryStore } from '../historyStore';
import { applyPage, captureCurrentPage, propertyHasContent } from '../../lib/pages';
import { emptyEco, type EcoModel } from '../../designer/eco';
import { clearEntireDesign } from '../../lib/clearActions';

const eco = (): EcoModel => ({
  version: 1,
  trees: [
    {
      id: 'tree',
      name: 'Surveyed tree',
      x: 8,
      y: -2,
      heightM: 6,
      canopyRadiusM: 2.3,
      status: 'existing',
      protectionMethod: 'surveyed',
      protectionRadiusM: 3.1,
      surveyRef: 'Survey T1',
    },
  ],
  greenRoofs: [],
});
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

describe('eco inputs persist with the canonical project', () => {
  it('round-trips tree-only work and engineering references through pages, import and rehydration', async () => {
    const store = usePropertyStore.getState(),
      before = store.property;
    expect(store.setEco(eco())).toBe(true);
    expect(store.setEngineering({ version: 1, structuralDesignRef: 'S-101' })).toBe(true);
    expect(propertyHasContent(usePropertyStore.getState().property)).toBe(true);
    const page = captureCurrentPage(),
      persisted = localStorage.getItem('ppw_property_v2')!;
    store.resetToDefault();
    applyPage(page);
    expect(usePropertyStore.getState().property.eco).toEqual(eco());
    const loaded = normaliseLoadedProperty(
      JSON.parse(JSON.stringify(usePropertyStore.getState().property)),
    );
    expect(loaded.eco).toEqual(eco());
    expect(loaded.engineering).toEqual({ version: 1, structuralDesignRef: 'S-101' });
    expect(loaded.rooms).toMatchObject(before.rooms);
    store.resetToDefault();
    localStorage.setItem('ppw_property_v2', persisted);
    await usePropertyStore.persist.rehydrate();
    expect(usePropertyStore.getState().property.eco).toEqual(eco());
    expect(usePropertyStore.getState().property.engineering?.structuralDesignRef).toBe('S-101');
  });
  it('rejects an invalid edit atomically and does not add eco data to legacy houses', () => {
    const store = usePropertyStore.getState();
    expect(normaliseLoadedProperty(store.property).eco).toBeUndefined();
    store.setEco(eco());
    const before = usePropertyStore.getState().property;
    expect(store.setEco({ ...eco(), trees: [{ ...eco().trees[0], heightM: Infinity }] })).toBe(
      false,
    );
    expect(store.setEngineering({ version: 1, structuralDesignRef: '' })).toBe(false);
    expect(usePropertyStore.getState().property).toBe(before);
    expect(propertyHasContent({ ...before, eco: emptyEco(), rooms: [] })).toBe(false);
    expect(
      propertyHasContent({
        ...before,
        eco: emptyEco(),
        rooms: [],
        engineering: { version: 1, utilityDesignRef: 'M1' },
      }),
    ).toBe(true);
  });
  it('supports undo, redo and reversible Clear while preserving house content', () => {
    const before = usePropertyStore.getState().property;
    stop = installHistorySubscriptions();
    usePropertyStore.getState().setEco(eco());
    useHistoryStore.getState().flush();
    useHistoryStore.getState().undo();
    expect(usePropertyStore.getState().property).toEqual(before);
    useHistoryStore.getState().redo();
    expect(usePropertyStore.getState().property.eco).toEqual(eco());
    clearEntireDesign();
    expect(usePropertyStore.getState().property.eco).toBeUndefined();
    useHistoryStore.getState().undo();
    expect(usePropertyStore.getState().property.eco).toEqual(eco());
  });
});
