/**
 * V-RENDER-4 (2026-05-27) — share-render helper tests.
 *
 * The "Share render" button exports the Konva stage via
 * `stage.toDataURL({ pixelRatio: 2 })` (a data:image/png string) and
 * hands it to the Web Share sheet. The base64 → Blob decode must be
 * synchronous (no await/fetch microtask) or iOS Safari rejects
 * navigator.share() with NotAllowedError. These tests cover that decode
 * — brief test #4's non-empty-render assertion in a node-runnable form.
 */

import { describe, it, expect } from 'vitest';
import { dataUrlToBlob } from '../shareImage';

// A 1x1 transparent PNG — the smallest valid image/png data URL.
const PNG_1x1 =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

describe('dataUrlToBlob', () => {
  it('decodes a data:image/png URL into a non-empty image/png Blob', () => {
    const blob = dataUrlToBlob(PNG_1x1);
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe('image/png');
    expect(blob.size).toBeGreaterThan(0);
  });

  it('preserves the declared mime type from the header', () => {
    const jpeg = 'data:image/jpeg;base64,/9j/4AAQSkZJRg==';
    expect(dataUrlToBlob(jpeg).type).toBe('image/jpeg');
  });

  it('throws on a string that is not a data URL', () => {
    expect(() => dataUrlToBlob('not-a-data-url')).toThrow();
  });

  it('decodes synchronously (returns a Blob, not a Promise)', () => {
    // The iOS gesture rule depends on this being synchronous.
    const result = dataUrlToBlob(PNG_1x1);
    expect(typeof (result as unknown as { then?: unknown }).then).toBe('undefined');
  });
});
