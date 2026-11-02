// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { normaliseSite, usePropertyStore } from '../../store/propertyStore';
import {
  hydrateCurrentSite,
  normaliseHydratedSite,
  siteHydrationWarning,
  startSiteHydration,
} from '../hydration';
import { sampleSite } from '../sample';

const original = usePropertyStore.getState().property;
const envelope = (world: unknown) => ({ widthM: 25, depthM: 20, originM: { x: -5, y: -5 }, world });
let stop = () => {};
beforeEach(() => {
  const property = { ...original };
  delete property.site;
  usePropertyStore.setState({ property });
});
afterEach(() => {
  stop();
  stop = () => {};
  usePropertyStore.setState({ property: original });
});

describe('deferred canonical Site hydration', () => {
  it('does not change a no-site design or its persisted bytes', () => {
    const state = usePropertyStore.getState().property;
    const saved = localStorage.getItem('ppw_property_v2');
    stop = startSiteHydration();
    expect(usePropertyStore.getState().property).toBe(state);
    expect(localStorage.getItem('ppw_property_v2')).toBe(saved);
  });
  it('preserves the opaque payload through early normalization and unrelated writes', () => {
    const world = sampleSite();
    expect(normaliseSite(envelope(world))?.world).toBe(world);
    usePropertyStore.getState().loadProperty({ ...original, site: envelope(world) });
    usePropertyStore.getState().toggleGrid();
    const raw = usePropertyStore.getState().property.site?.world;
    expect(raw).toBe(world);
    expect(Object.isFrozen(raw)).toBe(false);
    expect(JSON.parse(localStorage.getItem('ppw_property_v2')!).state.property.site.world).toEqual(
      world,
    );
    const roomsBeforeHydration = usePropertyStore.getState().property.rooms;
    hydrateCurrentSite();
    const validated = usePropertyStore.getState().property.site?.world;
    expect(validated).toEqual(world);
    expect(validated).not.toBe(world);
    expect(Object.isFrozen(validated)).toBe(true);
    expect(usePropertyStore.getState().property.rooms).toBe(roomsBeforeHydration);
  });
  it('withholds malformed saved geometry until validation, then drops only the failed extension', () => {
    const bad = sampleSite();
    bad.polygon[0].x += 1000;
    usePropertyStore.getState().setSite(envelope(bad));
    expect(usePropertyStore.getState().property.site?.world).toBe(bad);
    expect(Object.isFrozen(bad)).toBe(false);
    stop = startSiteHydration();
    expect(usePropertyStore.getState().property.site).toEqual({
      widthM: 25,
      depthM: 20,
      originM: { x: -5, y: -5 },
    });
    expect(siteHydrationWarning()).toContain('could not be verified');
    expect(normaliseHydratedSite(envelope(bad))).toBeUndefined();
  });
  it('validates later imports and rehydration without losing their source data', async () => {
    stop = startSiteHydration();
    usePropertyStore.getState().loadProperty({ ...original, site: envelope(sampleSite(1)) });
    expect(Object.isFrozen(usePropertyStore.getState().property.site?.world)).toBe(true);
    const persisted = JSON.parse(localStorage.getItem('ppw_property_v2')!);
    persisted.state.property.site = envelope(sampleSite(2));
    localStorage.setItem('ppw_property_v2', JSON.stringify(persisted));
    await usePropertyStore.persist.rehydrate();
    const world = usePropertyStore.getState().property.site?.world;
    expect(world).toEqual(sampleSite(2));
    expect(Object.isFrozen(world)).toBe(true);
  });
  it('does not loop on its own update or revalidate accepted data on unrelated edits', () => {
    let updates = 0;
    const unwatch = usePropertyStore.subscribe(() => updates++);
    stop = startSiteHydration();
    usePropertyStore.getState().setSite(envelope(sampleSite()));
    expect(updates).toBe(2);
    const world = usePropertyStore.getState().property.site?.world;
    usePropertyStore.getState().toggleGrid();
    expect(updates).toBe(3);
    expect(usePropertyStore.getState().property.site?.world).toBe(world);
    unwatch();
  });
  it('disposes its subscription and safely starts again', () => {
    const dispose = startSiteHydration();
    dispose();
    dispose();
    usePropertyStore.getState().setSite(envelope(sampleSite()));
    expect(Object.isFrozen(usePropertyStore.getState().property.site?.world)).toBe(false);
    stop = startSiteHydration();
    expect(Object.isFrozen(usePropertyStore.getState().property.site?.world)).toBe(true);
  });
});
