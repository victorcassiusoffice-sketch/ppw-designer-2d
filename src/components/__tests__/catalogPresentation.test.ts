import { describe, expect, it, vi } from 'vitest';
import { getAllProducts } from '../../data/products';
import { filterCatalog } from '../catalogPresentation';
import { macroOf } from '../mobile/catalogMacros';
import { isPitchEmbed } from '../../demo/pitchEmbed';
vi.mock('../../demo/pitchEmbed', () => ({ isPitchEmbed: vi.fn(() => false) }));

describe('catalog browsing', () => {
  const products = getAllProducts();
  it('sorts actual prices within their own currency and never ranks prices in the public demo', () => {
    const cheap = { ...products[0], id: 'cheap', price: { value: 10, currency: 'MUR' as const } };
    const dear = { ...cheap, id: 'dear', price: { value: 90, currency: 'MUR' as const } };
    const quote = { ...cheap, id: 'quote', price_on_request: true };
    expect(filterCatalog([dear, quote, cheap], 'all', '', 'price-asc').map(p => p.id)).toEqual(['cheap', 'dear', 'quote']);
    expect(filterCatalog([cheap, dear], 'all', '', 'price-desc').map(p => p.id)).toEqual(['dear', 'cheap']);
    vi.mocked(isPitchEmbed).mockReturnValue(true);
    expect(filterCatalog([dear, cheap], 'all', '', 'price-asc').map(p => p.id)).toEqual(['dear', 'cheap']);
    vi.mocked(isPitchEmbed).mockReturnValue(false);
  });

  it('keeps the existing catalog and its order when search and sorting are untouched', () => {
    expect(filterCatalog(products, 'all', '   ').map((product) => product.id)).toEqual(products.map((product) => product.id));
  });

  it('combines supplier/SKU search terms and keeps category filtering including Eco', () => {
    const solar = products.find((product) => product.category === 'solar')!;
    expect(solar).toBeDefined();
    const query = `${solar.sku.toLowerCase()} ${solar.supplier.toUpperCase()}`;
    expect(filterCatalog(products, 'eco', query).map((product) => product.id)).toContain(solar.id);
    expect(filterCatalog(products, 'outdoor', query).map((product) => product.id)).not.toContain(solar.id);
    expect(filterCatalog(products, 'eco', '').every((product) => macroOf(product) === 'eco')).toBe(true);
  });

  it('finds accented names and produces an honest empty result for unmatched terms', () => {
    const accented = { ...products[0], name: 'Fauteuil Élégant' };
    expect(filterCatalog([accented], 'all', 'fauteuil elegant')).toEqual([accented]);
    expect(filterCatalog(products, 'all', 'no-such-catalog-product-xyz')).toEqual([]);
  });

  it('sorts by footprint without mutating the shared product range', () => {
    const original = products.map((product) => product.id);
    const filtered = filterCatalog(products, 'all', '', 'footprint');
    const areas = filtered.map((product) => product.dimensions_cm.length * product.dimensions_cm.width);
    expect(areas).toEqual([...areas].sort((a, b) => a - b));
    expect(products.map((product) => product.id)).toEqual(original);
    const names = filterCatalog(products, 'all', '', 'name').map((product) => product.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
  });
});
