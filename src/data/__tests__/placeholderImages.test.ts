import { describe, expect, it } from 'vitest';
import { getAllProducts, productImageUrl, productTopDownUrl } from '../products';
import { usableProductImage } from '../productImageSafety';
import { apiProductToProduct, type ApiProductSummary } from '../apiCatalogAdapter';
import { catalogThumbnailImages } from '../../components/catalogMetadata';
import { enrichImagery } from '../../../api/_lib/products/seedImagery';
import planDrawings from '../catalogPlanDrawings.json';
import courts from '../../demo/courts/products.json';
import { existsSync, readFileSync } from 'node:fs';
import type { Product } from '../products.schema';

describe('no runtime external placeholder dependency', () => {
  it.each(['https://placehold.co/400x400', '//placehold.co/100', 'https://PLACEHOLD.CO/image.png', 'https://placehold.co?text=test'])('rejects %s in every image position', url => {
    const product = { ...getAllProducts()[0], id: 'no-model', sku: 'no-model', image_url: url, photo_image_url: url, topdown_image_url: url };
    expect(usableProductImage(url)).toBeUndefined();
    expect(productImageUrl(product)).toMatch(/^data:image\/svg/);
    expect(productTopDownUrl(product)).toMatch(/^data:image\/svg/);
    expect(catalogThumbnailImages(product)).toEqual([]);
  });
  it('keeps real supplier photos and labels drawings without overwriting source dimensions', () => {
    const photos = getAllProducts().filter(product => product.photo_image_url);
    expect(photos.length).toBeGreaterThanOrEqual(22);
    for (const product of photos) expect(catalogThumbnailImages(product)[0]).toMatchObject({ url: product.photo_image_url, kind: 'photo', label: '' });
    for (const product of getAllProducts()) {
      expect(product.image_url).not.toMatch(/placehold\.co/i);
      expect(catalogThumbnailImages(product).some(image => /placehold\.co/i.test(image.url))).toBe(false);
    }
  });
  it('strips legacy DB placeholders at both the API enrichment and client adapter boundaries', () => {
    const imageUrl = 'https://placehold.co/200';
    expect(enrichImagery([{ sku: 'known', imageUrl, description: null }], new Map([['KNOWN', { photo: null, topdown: null, description: 'Saved product' }]]))[0].imageUrl).toBeNull();
    const row = { id: 12345, sku: 'unknown', name: 'Sample', category: 'other', imageUrl, topdownImageUrl: imageUrl } as ApiProductSummary;
    expect(apiProductToProduct(row)).toMatchObject({ image_url: '', topdown_image_url: undefined });
  });
  it('all thirteen former placeholder cards use existing local plan art labelled Drawing', () => {
    const ids = ['k1-floor-eva-combat', 'k1-floor-eva-kids', 'k1-floor-gym-interlock', 'k1-floor-ifit-vinyl', 'k1-floor-rubber-interlock', 'k1-floor-outdoor-rubber-1m', 'k1-floor-outdoor-rubber-50', 'k1-floor-epdm-roll', 'demo-console-table', 'demo-wall-shelf', 'demo-wall-mirror', 'demo-aroma-diffuser', 'demo-potted-plant'];
    for (const id of ids) {
      const product = getAllProducts().find(row => row.id === id)!;
      expect(catalogThumbnailImages(product)[0]).toEqual({ url: product.topdown_image_url, kind: 'plan', label: 'Drawing' });
      expect(existsSync(`public${product.topdown_image_url}`)).toBe(true);
    }
  });
  it('baked overhead drawings match all existing Courts model dimensions and reject custom mesh or dimension changes', () => {
    expect(Object.keys(planDrawings)).toHaveLength(courts.products.length);
    for (const row of courts.products) {
      const product = row as Product, entry = planDrawings[product.id as keyof typeof planDrawings];
      expect(entry.dimensions).toEqual(product.dimensions_cm);
      const png = readFileSync(`public${entry.url}`);
      expect(png.subarray(1, 4).toString()).toBe('PNG');
      expect(png.readUInt32BE(16)).toBe(entry.width); expect(png.readUInt32BE(20)).toBe(entry.height);
      expect(catalogThumbnailImages(product)[0]).toMatchObject({ url: entry.url, kind: 'plan', label: 'Drawing' });
      expect(catalogThumbnailImages({ ...product, mesh_url: '/new.glb' }).some(image => image.url === entry.url)).toBe(false);
      expect(catalogThumbnailImages({ ...product, dimensions_cm: { ...product.dimensions_cm, length: product.dimensions_cm.length + 1 } }).some(image => image.url === entry.url)).toBe(false);
    }
  });
});
