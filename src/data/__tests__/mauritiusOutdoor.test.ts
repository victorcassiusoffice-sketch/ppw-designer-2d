import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { MAURITIUS_OUTDOOR_PRODUCTS, MAURITIUS_OUTDOOR_SHAPES, OUTDOOR_SOURCE_REVIEW_DATE } from '../mauritiusOutdoor';
import { getAllProducts, getCatalog, getProductById, getProductsByCategory, searchProducts } from '../products';
import { macroOf } from '../../components/mobile/catalogMacros';
import { catalogPrice } from '../../components/catalogPresentation';

describe('sourced Mauritius outdoor range', () => {
  it('retains exact supplier unit conversions rather than rounded or guessed footprints', () => {
    expect(getProductById('jkalachand-gs1004-swing')?.dimensions_cm).toEqual({ length: 215, width: 128, height: 165 });
    expect(getProductById('jkalachand-1799-w')?.dimensions_cm).toEqual({ length: 42, width: 52, height: 83 });
    expect(getProductById('mrbricolage-aurore-135')?.dimensions_cm).toEqual({ length: 135, width: 90, height: 75 });
    expect(getProductById('mrbricolage-aurore-135')?.notes).toContain('CLOSED');
  });
  it('makes every new supplier row available through all bundled lookup paths and Outdoor', () => {
    expect(new Set(MAURITIUS_OUTDOOR_PRODUCTS.map((product) => product.supplier)).size).toBe(2);
    for (const product of MAURITIUS_OUTDOOR_PRODUCTS) {
      expect(getAllProducts()).toContain(product);
      expect(getCatalog().products).toContain(product);
      expect(getProductsByCategory('furniture')).toContain(product);
      expect(searchProducts(product.sku)).toContain(product);
      expect(macroOf(product)).toBe('outdoor');
      expect(MAURITIUS_OUTDOOR_SHAPES[product.id]).toBeDefined();
    }
  });
  it('labels unknown prices as quotations, never free inventory or fake commercial terms', () => {
    const quote = getProductById('mrbricolage-aurore-135')!;
    expect(quote.price_on_request).toBe(true);
    expect(catalogPrice(quote)).toBe('Price on request');
    for (const product of MAURITIUS_OUTDOOR_PRODUCTS) {
      expect(product.commission_pct).toBe(0);
      expect(product.shopify_ready).toBe(false);
      expect(product.notes).toContain(OUTDOOR_SOURCE_REVIEW_DATE);
      expect(product.notes).toContain('not a stock or price guarantee');
      expect(new URL(product.source_url!).protocol).toBe('https:');
      expect(new URL(product.source_url!).hostname).toMatch(/^(www\.)?(mr-bricolage\.mu|jkalachand\.com)$/);
      expect(Object.values(product.dimensions_cm).every((value) => Number.isFinite(value) && value > 0)).toBe(true);
    }
  });
  it('ships original labelled illustrations and working plan assets without hotlinked product photos', () => {
    for (const product of MAURITIUS_OUTDOOR_PRODUCTS) {
      const asset = `public${product.image_url}`;
      expect(existsSync(asset)).toBe(true);
      expect(readFileSync(asset, 'utf8')).toContain('DIMENSIONAL ILLUSTRATION');
      expect(existsSync(`public${product.topdown_image_url}`)).toBe(true);
      expect(product.photo_image_url).toBeUndefined();
      expect(product.notes).toContain('not a product photograph or manufacturer CAD');
    }
  });
});
