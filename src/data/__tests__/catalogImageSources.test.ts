import { describe, expect, it } from 'vitest';
import { readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import sharp from 'sharp';
import { catalogImageSources } from '../catalogImageSources';
import manifest from '../catalogImageThumbnails.json';
import plans from '../catalogPlanDrawings.json';
import { catalogDragImageUrl, catalogDetailImageUrl, catalogThumbnailImages } from '../../components/catalogMetadata';
import { getAllProducts } from '../products';
import courts from '../../demo/courts/products.json';
import type { Product } from '../products.schema';

describe('cached catalogue image sizes', () => {
  it('uses 128/256 density candidates for each registered source without changing detail images', () => {
    expect(Object.keys(manifest)).toHaveLength(106);
    for (const [source, pair] of Object.entries(manifest)) {
      expect(catalogImageSources(source)).toEqual({ src: pair.small, srcSet: `${pair.small} 1x, ${pair.large} 2x` });
      expect(catalogImageSources(source, true)).toEqual({ src: source });
    }
  });
  it('preserves vector and newly onboarded image URLs until a cached variant exists', () => {
    for (const source of ['data:image/svg+xml;utf8,%3Csvg%2F%3E', '/products/outdoor/table-plan.svg', 'https://supplier.example/photo.webp']) {
      expect(catalogImageSources(source)).toEqual({ src: source });
    }
  });
  it('preserves exact image precedence and labels for API aliases and uses a small drag picture', () => {
    const product = getAllProducts().find(row => row.photo_image_url)!;
    const alias = { ...product, id: 'm-fresh-api' };
    expect(catalogThumbnailImages(alias)[0]).toEqual(catalogThumbnailImages(product)[0]);
    expect(catalogThumbnailImages(alias)[0].kind).toBe('photo');
    expect(catalogDragImageUrl(alias)).toBe(catalogImageSources(product.photo_image_url!).src);
  });
  it('opens the same measured drawing at full resolution in product details', () => {
    const product = courts.products[0] as unknown as Product;
    const source = catalogThumbnailImages(product)[0];
    expect(source.kind).toBe('plan'); expect(source.label).toBe('Drawing');
    expect(catalogDetailImageUrl(product)).toBe(source.url);
    expect(catalogDetailImageUrl(product)).toContain('/catalog-plans/');
    expect(catalogDragImageUrl(product)).toContain('/products/thumbs/');
  });
  it('stores real WebP files within the declared edges and substantially reduces all 33 Courts drawings', async () => {
    let oldBytes = 0, smallBytes = 0, largeBytes = 0;
    for (const plan of Object.values(plans)) {
      const pair = (manifest as Record<string, { small: string; large: string }>)[plan.url];
      expect(pair).toBeDefined();
      const original = resolve('public', `.${plan.url}`);
      oldBytes += statSync(original).size;
      for (const [edge, url] of [[128, pair.small], [256, pair.large]] as const) {
        const path = resolve('public', `.${url}`), bytes = readFileSync(path), metadata = await sharp(bytes).metadata();
        expect(metadata.format).toBe('webp');
        expect(metadata.width).toBeLessThanOrEqual(edge); expect(metadata.height).toBeLessThanOrEqual(edge);
        if (edge === 128) smallBytes += bytes.length; else largeBytes += bytes.length;
      }
    }
    expect(smallBytes).toBeLessThan(oldBytes * 0.15);
    expect(largeBytes).toBeLessThan(oldBytes * 0.25);
  });
});
