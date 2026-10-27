import { describe, expect, it } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { getAllProducts } from '../../data/products';
import { availabilityInfo, catalogFunction, catalogRooms, catalogThumbnailImages, catalogThumbnailUrls, catalogVariants, matchesCatalogBrowse } from '../catalogMetadata';
import manifest from '../../data/catalogModelThumbnails.json';
import models from '../../data/productModels.json';

const product = getAllProducts()[0];
describe('honest catalogue metadata', () => {
  it('unknown stock and historical database zero do not imply availability', () => {
    expect(availabilityInfo({}).label).toBe('Ask supplier');
    expect(availabilityInfo({ stock_qty: 0 }).label).toBe('Ask supplier');
    expect(availabilityInfo({ availability: 'in-stock', stock_qty: 0 }).label).toBe('Ask supplier');
    expect(availabilityInfo({ stock_qty: 9 }).label).toBe('Ask supplier');
  });
  it('shows the explicit supplier report and date, without claiming live stock', () => {
    expect(availabilityInfo({ availability: 'in-stock', stock_qty: 3, last_checked: '2026-10-22' })).toMatchObject({ label: 'In stock', quantity: 3, date: '2026-10-22' });
    expect(availabilityInfo({ availability: 'on-order', lead_time_days: 12 }).label).toBe('On order (12 days)');
    expect(availabilityInfo({ availability: 'made-to-order', lead_time_days: 25 }).label).toBe('Made to order (25 days)');
    expect(availabilityInfo({ availability: 'on-order', lead_time_days: -2 }).label).toBe('On order');
    expect(availabilityInfo({}).note).toContain('supplier last told us');
  });
  it('browses function and room without changing source product data', () => {
    const sofa = { ...product, name: 'Garden sofa', category: 'furniture' as const, outdoor: true };
    const before = JSON.stringify(sofa);
    expect(catalogFunction(sofa)).toBe('seating'); expect(catalogRooms(sofa)).toEqual(['outdoors']);
    expect(matchesCatalogBrowse(sofa, { mode: 'function', value: 'seating' })).toBe(true);
    expect(matchesCatalogBrowse(sofa, { mode: 'room', value: 'bath' })).toBe(false);
    expect(JSON.stringify(sofa)).toBe(before);
  });
  it('offers only explicitly declared variants that resolve to actual SKUs', () => {
    expect(catalogVariants(product, [product])).toEqual([]);
    const variant = { ...product, id: 'variant', sku: 'REAL-BLUE-SKU' };
    const withVariants = { ...product, variants: [{ sku: variant.sku, label: 'Blue', colour_hex: '#234567' }, { sku: 'NOT-ONBOARDED', label: 'Missing' }] };
    expect(catalogVariants(withVariants, [product, variant]).map(row => row.product.id)).toEqual(['variant']);
  });
});

describe('baked model catalogue images', () => {
  it('covers all existing models with cached transparent PNGs at one resolution', () => {
    expect(Object.keys(manifest).sort()).toEqual(Object.keys(models).sort());
    for (const entry of Object.values(manifest)) {
      expect(existsSync(`public${entry.url}`)).toBe(true);
      const png = readFileSync(`public${entry.url}`);
      expect(png.subarray(1, 4).toString()).toBe('PNG');
      expect(png.readUInt32BE(16)).toBe(384); expect(png.readUInt32BE(20)).toBe(384);
      expect(png[25]).toBe(6); // RGBA, transparent background retained.
      expect(entry.hash).toMatch(/^[a-f0-9]{16}$/);
    }
  });
  it('resolves API aliases by SKU and refuses a mismatched model override', () => {
    const p = getAllProducts().find(row => row.id === Object.keys(manifest)[0])!;
    expect(catalogThumbnailUrls(p)[0]).toBe(p.photo_image_url);
    expect(catalogThumbnailImages({ ...p, id: 'm-123' }).find(image => image.kind === 'model')?.url).toBe(manifest[p.id as keyof typeof manifest].url);
    expect(catalogThumbnailImages({ ...p, mesh_url: '/different.glb' }).some(image => image.kind === 'model')).toBe(false);
  });
  it('uses the actual merchant photo before cached models and labels every generated fallback', () => {
    const p = getAllProducts().find(row => row.id === Object.keys(manifest)[0])!;
    const images = catalogThumbnailImages({ ...p, photo_image_url: '/actual-product.jpg', image_url: '/drawing.svg', topdown_image_url: '/overhead.png' });
    expect(images.map(image => image.kind)).toEqual(['photo', 'plan', 'model', 'illustration']);
    expect(images[0].url).toBe('/actual-product.jpg');
    expect(images.slice(1).every(image => image.label.length > 0)).toBe(true);
    expect(catalogThumbnailImages({ ...p, photo_image_url: undefined, image_url: '', topdown_image_url: undefined })[0].kind).toBe('model');
  });
  it('does not call legacy SVG schematics a supplier photo', () => {
    const images = catalogThumbnailImages({ ...product, id: 'no-model', sku: 'no-model', photo_image_url: undefined, image_url: '/symbol.svg', topdown_image_url: undefined });
    expect(images).toEqual([{ url: '/symbol.svg', kind: 'illustration', label: 'Drawing' }]);
  });
});
