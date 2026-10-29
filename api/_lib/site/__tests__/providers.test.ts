import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import {
  clearProviderCacheForTests,
  fetchBounded,
  nearBoundary,
  permittedTerrainSources,
  searchPlace,
  validatePoints,
} from '../providers';
beforeEach(() => clearProviderCacheForTests());
afterEach(() => vi.unstubAllGlobals());
describe('bounded public providers', () => {
  it('only admits a composite when every exact source is allowed', () => {
    expect(permittedTerrainSources('srtm/S21E057.tif, gmted/30S030E.tif')).toBe(true);
    expect(permittedTerrainSources('uk_lidar/LIDAR-DTM-2M-TQ28.tif')).toBe(true);
    expect(permittedTerrainSources('uk_lidar/ok.tif, eudem/unsafe.tif')).toBe(false);
    expect(permittedTerrainSources(null)).toBe(false);
    expect(permittedTerrainSources('')).toBe(false);
  });
  it('rejects malformed/oversized/empty plot parameters', () => {
    expect(() => validatePoints(null)).toThrow();
    expect(() => validatePoints('[]')).toThrow();
    expect(() => validatePoints('[[190,0],[0,0],[0,1]]')).toThrow();
    expect(() =>
      validatePoints('[[179.999,0],[-179.999,0],[-179.999,.0001],[179.999,.0001]]'),
    ).toThrow();
  });
  it('cancels an oversized streaming response without waiting for its full body', async () => {
    const cancel = vi.fn();
    let chunks = 0;
    const stream = new ReadableStream({
      pull(controller) {
        chunks++;
        controller.enqueue(new Uint8Array(2000000));
      },
      cancel,
    });
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(stream)),
    );
    await expect(fetchBounded('https://photon.komoot.io/api')).rejects.toThrow('large');
    expect(cancel).toHaveBeenCalled();
    expect(chunks).toBeLessThanOrEqual(7);
  });
  it('deduplicates simultaneous search and caches subsequent requests', async () => {
    const mock = vi.fn(
      async () =>
        new Response(JSON.stringify({ features: [] }), {
          headers: { 'Content-Type': 'application/json' },
        }),
    );
    vi.stubGlobal('fetch', mock);
    await Promise.all([searchPlace('Tamarin'), searchPlace('Tamarin')]);
    await searchPlace('tamarin');
    expect(mock).toHaveBeenCalledTimes(1);
  });
  it('surfaces throttling rather than issuing an immediate second search', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ features: [] }))),
    );
    await searchPlace('Tamarin');
    await expect(searchPlace('Curepipe')).rejects.toThrow('wait');
  });
  it('has a hard abort timeout and preserves no invented success', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        (_url, options) =>
          new Promise((_resolve, reject) => {
            options.signal.addEventListener('abort', () => reject(new Error('Aborted')));
          }),
      ),
    );
    await expect(fetchBounded('https://photon.komoot.io/api', {}, 5)).rejects.toThrow('timed out');
  });
  it('refuses redirects, provider failure and oversized response', async () => {
    const mock = vi.fn<typeof fetch>(async () => new Response('not ready', { status: 429 }));
    vi.stubGlobal('fetch', mock);
    await expect(fetchBounded('https://photon.komoot.io/api')).rejects.toThrow('429');
    expect(mock.mock.calls[0][1]).toMatchObject({
      redirect: 'error',
      signal: expect.any(AbortSignal),
    });
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('', { headers: { 'Content-Length': '9000000' } })),
    );
    await expect(fetchBounded('https://photon.komoot.io/api')).rejects.toThrow('large');
  });
  it('counts a road crossing the buffer even when endpoints are far away', () => {
    const plot = [
      { x: 0, y: 0 },
      { x: 20, y: 0 },
      { x: 20, y: 20 },
      { x: 0, y: 20 },
    ];
    expect(
      nearBoundary(
        [
          { x: -1000, y: -50 },
          { x: 1000, y: -50 },
        ],
        plot,
      ),
    ).toBe(true);
    expect(
      nearBoundary(
        [
          { x: -1000, y: -150 },
          { x: 1000, y: -150 },
        ],
        plot,
      ),
    ).toBe(false);
  });
});
