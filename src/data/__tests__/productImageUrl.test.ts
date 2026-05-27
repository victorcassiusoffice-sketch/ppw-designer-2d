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
import { productImageUrl } from '../products';
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

describe('productImageUrl resolver', () => {
  it('prefers topdown_image_url when present (the baked top-down PNG)', () => {
    const p = makeProduct({
      topdown_image_url: '/products/topdown/k1-nordictrack-2450.png',
      image_url: 'https://placehold.co/600x400',
    });
    expect(productImageUrl(p)).toBe('/products/topdown/k1-nordictrack-2450.png');
  });

  it('falls back to image_url when no top-down asset exists', () => {
    const p = makeProduct({
      topdown_image_url: undefined,
      image_url: 'https://cdn.example.com/photo.jpg',
    });
    expect(productImageUrl(p)).toBe('https://cdn.example.com/photo.jpg');
  });

  it('falls back to an inline SVG data-URI when neither image is set', () => {
    const p = makeProduct({ topdown_image_url: undefined, image_url: '' });
    const url = productImageUrl(p);
    expect(url.startsWith('data:image/svg+xml')).toBe(true);
    // Never empty — the canvas must never get a blank source (regression
    // guard for the no-top-down case).
    expect(url.length).toBeGreaterThan(20);
  });

  it('never returns an empty string for any of the three branches', () => {
    expect(productImageUrl(makeProduct({ topdown_image_url: '/a.png' }))).not.toBe('');
    expect(productImageUrl(makeProduct({ image_url: '/b.jpg' }))).not.toBe('');
    expect(productImageUrl(makeProduct({ image_url: '' }))).not.toBe('');
  });
});
