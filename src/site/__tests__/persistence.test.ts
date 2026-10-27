// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { normaliseSite, usePropertyStore } from '../../store/propertyStore';
import { sampleSite } from '../sample';
describe('optional Site persistence', () => {
  it('retains legacy site bytes exactly', () => {
    const legacy = { widthM: 20, depthM: 15, originM: { x: 0, y: 0 } };
    expect(JSON.stringify(normaliseSite(legacy))).toBe(JSON.stringify(legacy));
  });
  it('roundtrips the complete payload without moving a room', () => {
    const before = JSON.stringify(usePropertyStore.getState().property.rooms),
      world = sampleSite();
    const payload = { widthM: 25, depthM: 20, originM: { x: -5, y: -5 }, world };
    usePropertyStore.getState().setSite(payload);
    expect(
      normaliseSite(JSON.parse(JSON.stringify(usePropertyStore.getState().property.site))),
    ).toEqual(payload);
    expect(JSON.stringify(usePropertyStore.getState().property.rooms)).toBe(before);
  });
  it('a design without site never gains optional world keys', () => {
    usePropertyStore.getState().setSite(null);
    expect(Object.prototype.hasOwnProperty.call(usePropertyStore.getState().property, 'site')).toBe(false);
    expect(JSON.stringify(usePropertyStore.getState().property)).not.toContain('"world"');
  });
});
