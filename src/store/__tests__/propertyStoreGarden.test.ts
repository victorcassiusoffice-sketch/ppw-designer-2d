import { beforeEach, describe, expect, it } from 'vitest';
import { normaliseLoadedProperty, usePropertyStore } from '../propertyStore';

beforeEach(() => usePropertyStore.getState().resetToDefault());

describe('saved garden editing', () => {
  it('round trips actual garden edits through the same design load path as rooms', () => {
    const store = usePropertyStore.getState();
    const patch = store.addGardenSurface({ kind: 'lawn', x: 6, y: 1, widthM: 5, depthM: 4, elevationM: 0 });
    const fence = store.addGardenFence({ a: { x: 6, y: 0 }, b: { x: 12, y: 0 }, heightM: 1.4, material: 'timber' });
    expect(store.updateGardenSurface(patch!, { kind: 'soil', elevationM: 0.5 })).toBe(true);
    expect(store.updateGardenFence(fence!, { material: 'hedge', heightM: 1.8 })).toBe(true);
    const saved = JSON.parse(JSON.stringify(usePropertyStore.getState().property));
    store.loadProperty(saved);
    expect(usePropertyStore.getState().property.garden).toEqual(saved.garden);
    expect(usePropertyStore.getState().property.garden?.surfaces[0]).toMatchObject({ kind: 'soil', elevationM: 0.5 });
  });

  it('rejects malformed dimensions without destroying previous work', () => {
    const store = usePropertyStore.getState();
    const id = store.addGardenSurface({ kind: 'path', x: 0, y: 0, widthM: 1.2, depthM: 6, elevationM: 0 });
    const before = usePropertyStore.getState().property;
    expect(store.updateGardenSurface(id!, { widthM: 0 })).toBe(false);
    expect(store.updateGardenSurface(id!, { elevationM: -2 })).toBe(false);
    expect(store.addGardenFence({ a: { x: 1, y: 1 }, b: { x: 1, y: 1 }, heightM: 1, material: 'metal' })).toBeNull();
    expect(usePropertyStore.getState().property).toBe(before);
  });

  it('removes one landscape element at a time and keeps old saves free of empty metadata', () => {
    const store = usePropertyStore.getState();
    const id = store.addGardenSurface({ kind: 'gravel', x: 0, y: 0, widthM: 3, depthM: 2, elevationM: 0 });
    store.removeGardenElement(id!);
    expect(usePropertyStore.getState().property.garden).toBeUndefined();
    expect(normaliseLoadedProperty(usePropertyStore.getState().property).garden).toBeUndefined();
  });
});
