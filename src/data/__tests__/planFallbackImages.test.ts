import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { readFileSync } from 'node:fs';
import { COURTS_PRODUCTS } from '../../demo/courts';
import { productTopDownUrl, thumbnailFor, CATEGORY_LABELS } from '../products';
import type { ProductCategory } from '../products.schema';
import { contentBoxFromRGBA } from '../../designer/imageContent';
import { planImageFit } from '../../designer/imageFit';

describe('SVG plan images without product photography', () => {
  it('supplies an explicit canvas pixel size for every category and every Courts fallback', () => {
    for (const category of Object.keys(CATEGORY_LABELS) as ProductCategory[]) {
      expect(thumbnailFor(category)).toMatch(/<svg\b[^>]*width="64"[^>]*height="64"[^>]*viewBox="0 0 64 64"/);
    }
    for (const product of COURTS_PRODUCTS) {
      const url = productTopDownUrl(product);
      if (!url.startsWith('data:image/svg+xml;utf8,')) continue;
      const svg = decodeURIComponent(url.split(',')[1]);
      expect(svg).toContain('width="64" height="64"');
    }
  });

  it('provides visible furniture pixels whose crop fits the real sofa footprint', async () => {
    const sofa = COURTS_PRODUCTS.find(product => product.id === 'courts-marco-sofa-corner')!;
    const svg = decodeURIComponent(productTopDownUrl(sofa).split(',')[1]);
    const { data, info } = await sharp(Buffer.from(svg)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    expect(info.width).toBe(64);
    expect(info.height).toBe(64);
    const crop = contentBoxFromRGBA(data, info.width, info.height, { whiteKey: false });
    expect(crop.w).toBeGreaterThan(30);
    expect(crop.h).toBeGreaterThan(20);
    const fit = planImageFit({ contentW: crop.w, contentH: crop.h, footW: sofa.dimensions_cm.length, footH: sofa.dimensions_cm.width });
    expect(fit.drawW).toBeGreaterThan(0);
    expect(fit.drawH).toBeGreaterThan(0);
    expect(fit.drawW).toBeLessThanOrEqual(sofa.dimensions_cm.length);
    expect(fit.drawH).toBeLessThanOrEqual(sofa.dimensions_cm.width);
  });

  it('gives the tank plan art the same explicit pixel bounds as its viewBox', () => {
    const svg = readFileSync(new URL('../../../public/products/illustrations/duraco-water-tank-1000-plan.svg', import.meta.url), 'utf8');
    expect(svg).toMatch(/<svg\b[^>]*width="200"[^>]*height="200"/);
    expect(svg).toContain('viewBox="0 0 200 200"');
  });
});
