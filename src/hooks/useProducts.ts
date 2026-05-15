/**
 * OMS Wave 2.1 — Catalog → Designer wiring.
 *
 * Bridges the static `src/data/products.json` catalog (Designer source
 * of truth for placement/scale/region) with the Neon-backed
 * `/api/products` (Phase 3 marketplace). Returns a merged list:
 *
 *   - Static products always included (Designer has rendered them since
 *     Week 1; deleting them would break saved layouts).
 *   - API products appended; identified by a synthetic string id
 *     `api:<numericId>` so the placedItem layer doesn't collide with
 *     hand-curated SKUs.
 *
 * Filtering by category + region works against the merged set.
 * Loading + error states surface so the Designer palette can show a
 * skeleton / banner.
 */

import { useEffect, useMemo, useState } from 'react';
import { getAllProducts as getStaticProducts } from '../data/products';
import type { Product } from '../data/products.schema';

interface ApiProduct {
  id: number;
  sku: string;
  name: string;
  category: string;
  description: string | null;
  widthMm: number | null;
  depthMm: number | null;
  heightMm: number | null;
  weightG: number | null;
  priceMinor: number;
  currency: string;
  imageUrl: string | null;
  region: string | null;
}

export interface UseProductsResult {
  products: Product[];
  loading: boolean;
  error: string | null;
  source: 'static' | 'merged';
  /** API-side products keyed by their static-bridged id. */
  apiProducts: Map<string, ApiProduct>;
}

/**
 * Map an API product into the static-catalog Product shape so the
 * palette + canvas can render it without a new code path. Width/depth
 * are converted mm → metres; category falls back to "eco-office-kit"
 * for unknown API categories.
 */
function apiToStaticShape(api: ApiProduct): { product: Product; raw: ApiProduct } {
  // mm → cm for the static schema's `dimensions_cm`.
  const lengthCm = (api.widthMm ?? 600) / 10;
  const widthCm = (api.depthMm ?? 600) / 10;
  const heightCm = (api.heightMm ?? 600) / 10;
  const validCategories = new Set([
    'ice-bath',
    'sleep-pod',
    'ergo-chair',
    'plant',
    'eco-office-kit',
  ]);
  const cat = validCategories.has(api.category)
    ? (api.category as Product['category'])
    : 'eco-office-kit';
  const validRegions = new Set(['MU', 'global', 'EU', 'UK', 'US', 'ME', 'APAC']);
  const region =
    api.region && validRegions.has(api.region)
      ? (api.region as Product['delivery_regions'][number])
      : 'MU';
  const product: Product = {
    id: `api:${api.id}`,
    sku: api.sku,
    name: api.name,
    category: cat,
    supplier: 'PPW Marketplace',
    dimensions_cm: { length: lengthCm, width: widthCm, height: heightCm },
    weight_kg: (api.weightG ?? 0) / 1000,
    price: {
      value: api.priceMinor,
      currency: (api.currency as Product['price']['currency']) ?? 'USD',
    },
    commission_pct: 0.07,
    shopify_ready: false,
    image_url: api.imageUrl ?? '',
    designer_status: 'Done',
    delivery_regions: [region],
    notes: api.description ?? '',
  };
  return { product, raw: api };
}

export function useProducts(): UseProductsResult {
  const staticProducts = useMemo(() => getStaticProducts(), []);
  const [api, setApi] = useState<ApiProduct[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch('/api/products?limit=100')
      .then(async (res) => {
        const j = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok) {
          setError((j as { error?: string }).error ?? `HTTP ${res.status}`);
          setApi([]);
        } else {
          setApi(((j as { products?: ApiProduct[] }).products ?? []) as ApiProduct[]);
        }
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : 'API products unavailable.');
        setApi([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const merged = useMemo(() => {
    if (!api) return staticProducts;
    const bridged = api.map((a) => apiToStaticShape(a));
    return [...staticProducts, ...bridged.map((b) => b.product)];
  }, [staticProducts, api]);

  const apiMap = useMemo(() => {
    const m = new Map<string, ApiProduct>();
    for (const a of api ?? []) m.set(`api:${a.id}`, a);
    return m;
  }, [api]);

  return {
    products: merged,
    loading,
    error,
    source: api ? 'merged' : 'static',
    apiProducts: apiMap,
  };
}
