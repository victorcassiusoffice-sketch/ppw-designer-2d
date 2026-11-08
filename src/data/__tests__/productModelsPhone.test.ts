/**
 * productModels — the phone copy and the test candidates (product engine, 2026-11).
 *
 * A body may carry a lighter `phoneUrl`; a phone-class screen fetches that one, everything else
 * fetches the full body. Test candidates are keyed by tool and only appear behind `?bodies=`.
 */
import { describe, expect, it } from 'vitest';
import { bodyUrlFor, productModelFor, wantsPhoneBody } from '../productModels';
import { WALK_CHARACTERS } from '../../walk/characters';

describe('bodyUrlFor', () => {
  const entry = { url: '/models/x.glb', phoneUrl: '/models/x-phone.glb' };
  it('serves the phone copy on a phone-class screen', () => {
    expect(bodyUrlFor(entry, true)).toBe('/models/x-phone.glb');
  });
  it('serves the full body everywhere else', () => {
    expect(bodyUrlFor(entry, false)).toBe('/models/x.glb');
  });
  it('a body without a phone copy is served as is, even on a phone', () => {
    expect(bodyUrlFor({ url: '/models/y.glb' }, true)).toBe('/models/y.glb');
  });
  it('outside a browser nothing is a phone', () => {
    expect(wantsPhoneBody()).toBe(false);
  });
});

describe('candidates', () => {
  it('without ?bodies= the catalogue body is the body', () => {
    expect(productModelFor({ id: 'k1-nordictrack-2450', sku: 'K1-CDIO-NT2450' })?.url).toBe('/models/k1-nordictrack-2450.glb');
  });
});

describe('walk characters', () => {
  it('the Kenney four stay first; generated people, if any, follow with the same shape', () => {
    expect(WALK_CHARACTERS.slice(0, 4).map((c) => c.id)).toEqual(['female-a', 'female-b', 'male-a', 'male-b']);
    for (const c of WALK_CHARACTERS) {
      expect(c.url.startsWith('/models/world-characters/')).toBe(true);
      expect(c.clips.idle && c.clips.walk && c.clips.run).toBeTruthy();
      expect(c.heightM).toBeGreaterThan(0);
      // The Kenney four inline their PNGs through Vite's `?inline` (a path string under vitest);
      // a generated person carries its thumbnail as a data URL in characters.generated.json.
      if (!c.id.match(/^(fe)?male-[ab]$/)) expect(c.thumbnailDataUrl.startsWith('data:image/png;base64,')).toBe(true);
      expect(typeof c.thumbnailDataUrl).toBe('string');
    }
  });
});
