import { describe, it, expect } from 'vitest';
import {
  buildSeedImageryMap,
  enrichImagery,
  isPlaceholderImage,
} from '../_lib/products/seedImagery.js';

const SEED = [
  { sku: 'K1-CDIO-NT2450', topdown_image_url: '/products/topdown/k1-nordictrack-2450.png', notes: 'Foldable commercial treadmill.' },
  { sku: 'k1-strg-bfxt2se', topdown_image_url: '/products/topdown/k1-bowflex.png', notes: 'Home gym.' },
  { sku: 'K1-NO-ASSET', topdown_image_url: null, notes: null },
];

describe('seedImagery', () => {
  it('isPlaceholderImage detects placehold.co + null/empty', () => {
    expect(isPlaceholderImage(null)).toBe(true);
    expect(isPlaceholderImage('')).toBe(true);
    expect(isPlaceholderImage('https://placehold.co/400x400')).toBe(true);
    expect(isPlaceholderImage('/products/topdown/x.png')).toBe(false);
  });

  it('builds a case-insensitive SKU map and skips empty entries', () => {
    const m = buildSeedImageryMap(SEED);
    expect(m.size).toBe(2); // K1-NO-ASSET dropped (no topdown/notes)
    expect(m.get('K1-CDIO-NT2450')?.topdown).toContain('k1-nordictrack-2450');
    expect(m.get('K1-STRG-BFXT2SE')?.description).toBe('Home gym.'); // upper-cased
  });

  it('replaces placeholder image + null description on SKU match', () => {
    const m = buildSeedImageryMap(SEED);
    const out = enrichImagery(
      [{ id: 6, sku: 'K1-CDIO-NT2450', imageUrl: 'https://placehold.co/400', description: null }],
      m,
    );
    expect(out[0].imageUrl).toBe('/products/topdown/k1-nordictrack-2450.png');
    expect(out[0].description).toBe('Foldable commercial treadmill.');
  });

  it('preserves real DB image/description when already set (DB wins)', () => {
    const m = buildSeedImageryMap(SEED);
    const out = enrichImagery(
      [{ id: 6, sku: 'K1-CDIO-NT2450', imageUrl: '/real/photo.png', description: 'Real desc.' }],
      m,
    );
    expect(out[0].imageUrl).toBe('/real/photo.png');
    expect(out[0].description).toBe('Real desc.');
  });

  it('leaves rows without a SKU match unchanged', () => {
    const m = buildSeedImageryMap(SEED);
    const row = { id: 1, sku: 'DEMO-MC-01', imageUrl: 'https://placehold.co/400', description: null };
    const out = enrichImagery([row], m);
    expect(out[0]).toBe(row); // same reference, untouched
  });

  it('fills only the missing field (image present, description null)', () => {
    const m = buildSeedImageryMap(SEED);
    const out = enrichImagery(
      [{ id: 6, sku: 'K1-CDIO-NT2450', imageUrl: '/real/photo.png', description: null }],
      m,
    );
    expect(out[0].imageUrl).toBe('/real/photo.png'); // kept
    expect(out[0].description).toBe('Foldable commercial treadmill.'); // filled
  });
});
