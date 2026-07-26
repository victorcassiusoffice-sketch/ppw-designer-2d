import { describe, it, expect } from 'vitest';
import {
  buildSeedImageryMap,
  enrichImagery,
  isPlaceholderImage,
} from '../_lib/products/seedImagery.js';

const SEED = [
  {
    sku: 'K1-CDIO-NT2450',
    topdown_image_url: '/products/topdown/k1-nordictrack-2450.png',
    photo_image_url: '/products/photos/k1-nordictrack-2450.png',
    notes: 'Foldable commercial treadmill.',
  },
  // Top-down only — no photo (pre-photo-era entry).
  { sku: 'k1-strg-bfxt2se', topdown_image_url: '/products/topdown/k1-bowflex.png', notes: 'Home gym.' },
  { sku: 'K1-NO-ASSET', topdown_image_url: null, notes: null },
];

describe('seedImagery (photo/top-down split, 2026-07-26)', () => {
  it('isPlaceholderImage detects placehold.co + null/empty', () => {
    expect(isPlaceholderImage(null)).toBe(true);
    expect(isPlaceholderImage('')).toBe(true);
    expect(isPlaceholderImage('https://placehold.co/400x400')).toBe(true);
    expect(isPlaceholderImage('/products/topdown/x.png')).toBe(false);
  });

  it('builds a case-insensitive SKU map carrying photo + topdown', () => {
    const m = buildSeedImageryMap(SEED);
    expect(m.size).toBe(2); // K1-NO-ASSET dropped (no assets/notes)
    expect(m.get('K1-CDIO-NT2450')?.topdown).toContain('topdown/k1-nordictrack-2450');
    expect(m.get('K1-CDIO-NT2450')?.photo).toContain('photos/k1-nordictrack-2450');
    expect(m.get('K1-STRG-BFXT2SE')?.description).toBe('Home gym.'); // upper-cased
  });

  it('placeholder imageUrl gets the PHOTO (shop-facing), not the top-down', () => {
    const m = buildSeedImageryMap(SEED);
    const out = enrichImagery(
      [{ id: 6, sku: 'K1-CDIO-NT2450', imageUrl: 'https://placehold.co/400', description: null }],
      m,
    );
    expect(out[0].imageUrl).toBe('/products/photos/k1-nordictrack-2450.png');
    expect(out[0].description).toBe('Foldable commercial treadmill.');
  });

  it('fills topdownImageUrl independently for the designer canvas', () => {
    const m = buildSeedImageryMap(SEED);
    const out = enrichImagery(
      [{ id: 6, sku: 'K1-CDIO-NT2450', imageUrl: 'https://placehold.co/400', description: null }],
      m,
    );
    expect(out[0].topdownImageUrl).toBe('/products/topdown/k1-nordictrack-2450.png');
  });

  it('falls back to the top-down for imageUrl only when no photo exists (never a placeholder)', () => {
    const m = buildSeedImageryMap(SEED);
    const out = enrichImagery(
      [{ id: 7, sku: 'K1-STRG-BFXT2SE', imageUrl: null, description: null }],
      m,
    );
    expect(out[0].imageUrl).toBe('/products/topdown/k1-bowflex.png');
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

  it('preserves a DB topdownImageUrl when the row already has one', () => {
    const m = buildSeedImageryMap(SEED);
    const out = enrichImagery(
      [{ id: 6, sku: 'K1-CDIO-NT2450', imageUrl: null, topdownImageUrl: '/db/topdown.png', description: null }],
      m,
    );
    expect(out[0].topdownImageUrl).toBe('/db/topdown.png');
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
