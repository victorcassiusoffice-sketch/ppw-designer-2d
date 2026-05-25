/**
 * generateTopDownImage — Phase 5 unit coverage.
 *
 * Covers: successful generation returns + caches the Fal URL; a second
 * call is a cache hit (no second fetch); a quota/non-2xx response falls
 * back to the original image; the browser-with-no-key path never calls
 * Fal; and the prompt template carries the product name + dimensions.
 *
 * Runs in the default node env — pure logic with an injected fetch +
 * in-memory cache, rate-limiter skipped so there are no real delays.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  generateTopDownImage,
  topDownPrompt,
  __resetRateLimitForTests,
  type TopDownCache,
} from '../generateTopDownImage';
import type { Product } from '../../data/products.schema';

const PRODUCT: Product = {
  id: 'k1-test-treadmill',
  sku: 'K1-TM-1',
  name: 'NordicTrack Commercial 2450',
  category: 'fitness',
  supplier: 'K1 Sport',
  dimensions_cm: { length: 200, width: 90, height: 150 },
  weight_kg: 120,
  price: { value: 89000, currency: 'MUR' },
  commission_pct: 0.05,
  shopify_ready: true,
  image_url: 'https://cdn.example.com/treadmill.jpg',
  designer_status: 'Done',
  delivery_regions: ['MU'],
  notes: 'A commercial treadmill.',
};

function memCache(): TopDownCache {
  const m = new Map<string, string>();
  return {
    get: async (k) => m.get(k) ?? null,
    set: async (k, v) => {
      m.set(k, v);
    },
  };
}

beforeEach(() => {
  __resetRateLimitForTests();
});

describe('generateTopDownImage', () => {
  it('generates and returns the Fal image URL on success', async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(JSON.stringify({ images: [{ url: 'https://fal.media/topdown.png' }] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    const url = await generateTopDownImage(PRODUCT, {
      apiKey: 'test-key',
      fetchImpl: fetchImpl as unknown as typeof fetch,
      cache: memCache(),
      skipRateLimit: true,
    });
    expect(url).toBe('https://fal.media/topdown.png');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('returns the cached URL on the second call without re-fetching', async () => {
    const cache = memCache();
    const fetchImpl = vi.fn(async () =>
      new Response(JSON.stringify({ images: [{ url: 'https://fal.media/cached.png' }] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    const opts = {
      apiKey: 'test-key',
      fetchImpl: fetchImpl as unknown as typeof fetch,
      cache,
      skipRateLimit: true,
    };
    const first = await generateTopDownImage(PRODUCT, opts);
    const second = await generateTopDownImage(PRODUCT, opts);
    expect(first).toBe('https://fal.media/cached.png');
    expect(second).toBe('https://fal.media/cached.png');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('falls back to the original image on a quota / non-2xx response', async () => {
    const fetchImpl = vi.fn(async () => new Response('rate limited', { status: 429 }));
    const url = await generateTopDownImage(PRODUCT, {
      apiKey: 'test-key',
      fetchImpl: fetchImpl as unknown as typeof fetch,
      cache: memCache(),
      skipRateLimit: true,
    });
    expect(url).toBe(PRODUCT.image_url);
  });

  it('never calls Fal directly without a key (browser path) and falls back', async () => {
    const fetchImpl = vi.fn();
    const url = await generateTopDownImage(PRODUCT, {
      // no apiKey, default (Fal) endpoint → must not call.
      fetchImpl: fetchImpl as unknown as typeof fetch,
      cache: memCache(),
      skipRateLimit: true,
    });
    expect(url).toBe(PRODUCT.image_url);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('builds a prompt carrying the product name, category and dimensions', () => {
    const prompt = topDownPrompt(PRODUCT);
    expect(prompt).toContain('NordicTrack Commercial 2450');
    expect(prompt).toContain('fitness');
    expect(prompt).toContain('200×90×150 cm');
    expect(prompt.toLowerCase()).toContain('top-down');
  });
});
