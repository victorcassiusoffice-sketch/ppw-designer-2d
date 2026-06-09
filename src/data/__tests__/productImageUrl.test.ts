/**
 * V-RENDER-1 (2026-05-27) — render-path resolver tests.
 *
 * Guards the canonical image chooser that the Konva in-room render now
 * binds (RoomCanvas.tsx — `useImageCache(productImageUrl(product))`).
 * Preference order: topdown_image_url → image_url → SVG data-URI.
 *
 * Brief test #1 (top-down preferred) + #5 (no top-down still resolves to
 * a valid string — never a blank canvas).
 */

import { describe, it, expect } from 'vitest';
import { productImageUrl, productTopDownUrl } from '../products';
import type { Product } from '../products.schema';

function makeProduct(overrides: Partial<Product>): Product {
  return {
    id: 'test-1',
    sku: 'TEST-1',
    name: 'Test Product',
    category: 'fitness',
    supplier: 'K1',
    dimensions_cm: { length: 100, width: 60, height: 120 },
    weight_kg: 10,
    price: { value: 1000, currency: 'MUR' },
    commission_pct: 0.05,
    shopify_ready: true,
    image_url: '',
    designer_status: 'Done',
    delivery_regions: ['MU'],
    notes: '',
    ...overrides,
  };
}

// CANVAS footprint resolver — top-down preferred so a rotated placed item
// turns the image, not a perspective photo.
describe('productTopDownUrl resolver (canvas footprint)', () => {
  it('prefers topdown_image_url when present (the baked top-down PNG)', () => {
    const p = makeProduct({
      topdown_image_url: '/products/topdown/k1-nordictrack-2450.png',
      photo_image_url: '/products/photos/k1-nordictrack-2450.png',
      image_url: 'https://placehold.co/600x400',
    });
    expect(productTopDownUrl(p)).toBe('/products/topdown/k1-nordictrack-2450.png');
  });

  it('falls back to the real photo, then image_url, when no top-down asset exists', () => {
    expect(
      productTopDownUrl(makeProduct({ photo_image_url: '/products/photos/x.jpg' })),
    ).toBe('/products/photos/x.jpg');
    expect(
      productTopDownUrl(makeProduct({ image_url: 'https://cdn.example.com/photo.jpg' })),
    ).toBe('https://cdn.example.com/photo.jpg');
  });

  it('falls back to an inline SVG data-URI when no image is set', () => {
    const url = productTopDownUrl(makeProduct({ image_url: '' }));
    expect(url.startsWith('data:image/svg+xml')).toBe(true);
    expect(url.length).toBeGreaterThan(20);
  });
});

// CATALOG / DETAIL resolver — real product PHOTO preferred so shoppers see
// the actual product, falling back to the generated top-down render.
describe('productImageUrl resolver (catalog/detail)', () => {
  it('prefers the real photo over the top-down render', () => {
    const p = makeProduct({
      photo_image_url: '/products/photos/k1-nordictrack-2450.png',
      topdown_image_url: '/products/topdown/k1-nordictrack-2450.png',
      image_url: 'https://placehold.co/600x400',
    });
    expect(productImageUrl(p)).toBe('/products/photos/k1-nordictrack-2450.png');
  });

  it('falls back to the top-down render when no real photo exists', () => {
    const p = makeProduct({
      topdown_image_url: '/products/topdown/x.png',
      image_url: 'https://placehold.co/600x400',
    });
    expect(productImageUrl(p)).toBe('/products/topdown/x.png');
  });

  it('falls back to image_url, then an inline SVG data-URI', () => {
    expect(productImageUrl(makeProduct({ image_url: 'https://cdn.example.com/photo.jpg' }))).toBe(
      'https://cdn.example.com/photo.jpg',
    );
    const url = productImageUrl(makeProduct({ image_url: '' }));
    expect(url.startsWith('data:image/svg+xml')).toBe(true);
  });

  it('never returns an empty string', () => {
    expect(productImageUrl(makeProduct({ photo_image_url: '/p.png' }))).not.toBe('');
    expect(productImageUrl(makeProduct({ topdown_image_url: '/a.png' }))).not.toBe('');
    expect(productImageUrl(makeProduct({ image_url: '' }))).not.toBe('');
  });
});
