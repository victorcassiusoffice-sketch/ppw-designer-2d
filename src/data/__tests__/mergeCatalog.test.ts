import { describe, expect, it } from 'vitest';
import { mergeCatalog } from '../mergeCatalog';
import { getAllProducts } from '../products';
import type { Product } from '../products.schema';

function stub(over: Partial<Product>): Product {
  return {
    id: 'stub',
    sku: 'STUB',
    name: 'Stub',
    category: 'fitness',
    price: 1,
    currency: 'USD',
    dimensions_cm: { length: 100, width: 50, height: 100 },
    region: 'MU',
    ...over,
  } as Product;
}

describe('mergeCatalog — the one blend every product surface renders', () => {
  it('an API row with the same SKU replaces its bundled twin, keeping the API id', () => {
    const treadmill = getAllProducts().find((p) => p.id === 'k1-nordictrack-2450')!;
    const api = stub({ id: 'm-6', sku: treadmill.sku, name: treadmill.name });
    const out = mergeCatalog([api]);
    expect(out.filter((p) => p.sku === treadmill.sku)).toHaveLength(1);
    expect(out.find((p) => p.sku === treadmill.sku)!.id).toBe('m-6');
    expect(out.find((p) => p.id === 'k1-nordictrack-2450')).toBeUndefined();
  });

  it('never shows a product twice — the phone strip regression', () => {
    const bundled = getAllProducts();
    const apiTwins = bundled
      .filter((p) => p.id.startsWith('k1-') && p.sku)
      .map((p, i) => stub({ id: `m-${i}`, sku: p.sku, name: p.name }));
    const out = mergeCatalog(apiTwins);
    const keys = out.map((p) => p.sku || p.id);
    expect(new Set(keys).size).toBe(keys.length);
    expect(out).toHaveLength(bundled.length);
  });

  it('bundled-only products pass through in seed order; a SKU-less row keys on its id', () => {
    const bundled = [
      stub({ id: 'a', sku: '' }),
      stub({ id: 'b', sku: 'B' }),
      stub({ id: 'c', sku: '' }),
    ];
    const out = mergeCatalog([stub({ id: 'a', sku: '' }), stub({ id: 'x', sku: 'B' })], bundled);
    expect(out.map((p) => p.id)).toEqual(['a', 'x', 'c']);
  });
});
