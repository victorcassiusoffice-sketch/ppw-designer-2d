/** @vitest-environment jsdom */
import { beforeEach, describe, expect, it } from 'vitest';
import { normaliseLoadedProperty, usePropertyStore, type Property } from '../propertyStore';
import type { ShadeModel } from '../../designer/shade';

const shade: ShadeModel = {
  version: 1, enabled: true, sails: [{
    id: 'sail', name: 'Terrace sail', fabric: 'hdpe-knit', cornerGapM: 0.3, edgeCurvePct: 7, colour: '#e9e3d4',
    anchors: [
      { id: 'a', x: 1, y: 1, heightM: 3, support: 'post' }, { id: 'b', x: 5, y: 1, heightM: 2.4, support: 'post' },
      { id: 'c', x: 5, y: 5, heightM: 3, support: 'wall' }, { id: 'd', x: 1, y: 5, heightM: 2.4, support: 'post' },
    ],
  }],
};
const base = (): Property => ({ id: 'p', name: 'P', activeRoomId: 'room', rooms: [{ id: 'room', name: 'Room', polygon: [{ x: 0, y: 0 }, { x: 6, y: 0 }, { x: 6, y: 6 }, { x: 0, y: 6 }], placedItems: [], openings: [] }] } as unknown as Property);

describe('shade sails in the saved design', () => {
  beforeEach(() => { usePropertyStore.setState({ property: base() }); });
  it('is absent from a design that never had one, byte for byte', () => {
    const loaded = normaliseLoadedProperty(base());
    expect('shade' in loaded).toBe(false);
    expect(JSON.stringify(loaded)).not.toContain('shade');
  });
  it('loads a valid shade model unchanged and drops an invalid one', () => {
    expect(normaliseLoadedProperty({ ...base(), shade }).shade).toEqual(shade);
    expect(normaliseLoadedProperty({ ...base(), shade: { version: 1, enabled: true, sails: [{ ...shade.sails[0], anchors: shade.sails[0].anchors.slice(0, 2) }] } as unknown as ShadeModel }).shade).toBeUndefined();
  });
  it('store actions keep the model valid: move a point, refuse a crossing-free but out-of-range height, add and remove points', () => {
    const store = usePropertyStore.getState();
    expect(store.setShade(shade)).toBe(true);
    expect(store.updateShadeAnchor('sail', 'a', { x: 0.5, y: 0.5 })).toBe(true);
    expect(usePropertyStore.getState().property.shade!.sails[0].anchors[0]).toEqual({ id: 'a', x: 0.5, y: 0.5, heightM: 3, support: 'post' });
    expect(store.updateShadeAnchor('sail', 'a', { heightM: 20 })).toBe(false);
    expect(store.updateShadeAnchor('sail', 'missing', { x: 1 })).toBe(false);
    expect(store.addShadeAnchor('sail', { id: 'e', x: 3, y: 6, heightM: 2.8, support: 'post' }, 'c')).toBe(true);
    expect(usePropertyStore.getState().property.shade!.sails[0].anchors.map(a => a.id)).toEqual(['a', 'b', 'c', 'e', 'd']);
    for (const id of ['e', 'd']) expect(store.removeShadeAnchor('sail', id)).toBe(true);
    expect(store.removeShadeAnchor('sail', 'c')).toBe(false);
    expect(usePropertyStore.getState().property.shade!.sails[0].anchors).toHaveLength(3);
    expect(store.updateShadeSail('sail', { fabric: 'pvc-coated', edgeCurvePct: 5 })).toBe(true);
    expect(store.updateShadeSail('sail', { cornerGapM: 9 })).toBe(false);
    expect(store.removeShadeSail('sail')).toBe(true);
    expect(usePropertyStore.getState().property.shade!.sails).toHaveLength(0);
  });
  it('keeps a made sail\'s edge list in step with its points', () => {
    const store = usePropertyStore.getState();
    expect(store.setShade({ ...shade, sails: [{ ...shade.sails[0], made: { edgesM: [3, 3, 3, 3] } }] })).toBe(true);
    expect(store.addShadeAnchor('sail', { id: 'e', x: 3, y: 6, heightM: 2.8, support: 'post' })).toBe(true);
    expect(usePropertyStore.getState().property.shade!.sails[0].made!.edgesM).toHaveLength(5);
    expect(store.removeShadeAnchor('sail', 'e')).toBe(true);
    expect(usePropertyStore.getState().property.shade!.sails[0].made!.edgesM).toHaveLength(4);
  });
});
