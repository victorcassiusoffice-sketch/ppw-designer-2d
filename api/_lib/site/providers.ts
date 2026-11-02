/** Fixed-origin, anonymous planning providers. No keys, accounts or arbitrary proxy URLs. */
import {
  boundaryError,
  geographicBoundaryError,
  distance,
  inside,
  intersects,
  toLocal,
} from '../../../src/site/geometry.js';
import type { LonLat, XY } from '../../../src/site/types.js';
const cache = new Map<string, { expires: number; value: unknown }>();
const pending = new Map<string, Promise<unknown>>();
const lastCall = new Map<string, number>();
export class ProviderError extends Error {
  constructor(
    message: string,
    public status = 503,
    public retryAfter?: string,
  ) {
    super(message);
  }
}
export async function fetchBounded(
  url: string,
  init: RequestInit = {},
  timeoutMs = 10000,
): Promise<Response> {
  const controller = new AbortController(),
    timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
      redirect: 'error',
      headers: {
        'User-Agent': 'OneLiveBuild-SitePrototype/1.0 (https://onelivebuild.com)',
        Accept: 'application/json',
        ...init.headers,
      },
    });
    if (!response.ok)
      throw new ProviderError(
        `Provider returned HTTP ${response.status}. ${response.headers.get('retry-after') ? `Retry after ${response.headers.get('retry-after')}.` : 'Try again later.'}`,
        response.status === 429 || response.status === 529 ? 429 : 503,
        response.headers.get('retry-after') ?? undefined,
      );
    if (Number(response.headers.get('content-length') ?? 0) > 8000000)
      throw new ProviderError('Provider response too large.');
    const reader = response.body?.getReader();
    if (!reader) throw new ProviderError('Provider returned an empty body.');
    const chunks: Uint8Array[] = [];
    let length = 0;
    let part = await reader.read();
    while (!part.done) {
      length += part.value.byteLength;
      if (length > 8000000) {
        await reader.cancel();
        controller.abort();
        throw new ProviderError('Provider response too large.');
      }
      chunks.push(part.value);
      part = await reader.read();
    }
    const bytes = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return new Response(bytes, { headers: response.headers, status: response.status });
  } catch (e) {
    if (e instanceof ProviderError) throw e;
    throw new ProviderError(
      'Provider unavailable or timed out. Your boundary and saved report are retained.',
    );
  } finally {
    clearTimeout(timer);
  }
}
async function cached<T>(key: string, ttl: number, run: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit && hit.expires > Date.now()) return hit.value as T;
  if (pending.has(key)) return pending.get(key) as Promise<T>;
  if (pending.size >= 8)
    throw new ProviderError('Public-provider capacity is busy. Try again shortly.', 429, '10');
  const job = run()
    .then((value) => {
      if (cache.size >= 128) cache.delete(cache.keys().next().value!);
      cache.set(key, { value, expires: Date.now() + ttl });
      return value;
    })
    .finally(() => pending.delete(key));
  pending.set(key, job);
  return job;
}
function rate(provider: string, ms: number) {
  const now = Date.now(),
    last = lastCall.get(provider) ?? 0;
  if (now - last < ms)
    throw new ProviderError(
      'Please wait before another public-provider request.',
      429,
      String(Math.ceil((ms - (now - last)) / 1000)),
    );
  lastCall.set(provider, now);
}
export function validatePoints(raw: string | null): LonLat[] {
  let points: unknown;
  try {
    points = JSON.parse(raw ?? 'null');
  } catch {
    throw new ProviderError('Invalid coordinates.', 400);
  }
  if (
    !Array.isArray(points) ||
    points.length < 3 ||
    points.length > 200 ||
    !points.every(
      (p) =>
        Array.isArray(p) &&
        p.length === 2 &&
        p.every(Number.isFinite) &&
        Math.abs(p[0]) <= 180 &&
        Math.abs(p[1]) <= 85,
    )
  )
    throw new ProviderError('Provide 3–200 valid longitude/latitude pairs.', 400);
  const checked = points as LonLat[],
    error =
      geographicBoundaryError(checked) ?? boundaryError(checked.map((p) => toLocal(p, checked[0])));
  if (error) throw new ProviderError(error, 400);
  return checked;
}
export async function searchPlace(query: string) {
  const q = query.trim();
  if (q.length < 3 || q.length > 160)
    throw new ProviderError('Search must contain 3–160 characters.', 400);
  return cached(`search:${q.toLowerCase()}`, 86400000, async () => {
    rate('photon', 1100);
    const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=5`;
    const data = (await (await fetchBounded(url)).json()) as {
      features?: { geometry: { coordinates: number[] }; properties: Record<string, string> }[];
    };
    if (!Array.isArray(data.features))
      throw new ProviderError('Search returned an unexpected format.');
    return {
      results: data.features.slice(0, 5).flatMap((f) => {
        const p = f.geometry?.coordinates;
        if (!p || !p.slice(0, 2).every(Number.isFinite)) return [];
        return [
          {
            center: [p[0], p[1]],
            label: [f.properties.name, f.properties.city, f.properties.state, f.properties.country]
              .filter(Boolean)
              .join(', '),
          },
        ];
      }),
      source: 'Photon / OpenStreetMap',
      sourceUrl: 'https://www.openstreetmap.org/copyright',
      acquiredAt: new Date().toISOString(),
    };
  });
}
export async function solar(points: LonLat[]) {
  const lon = points.reduce((s, p) => s + p[0], 0) / points.length,
    lat = points.reduce((s, p) => s + p[1], 0) / points.length,
    key = `solar:${lat.toFixed(4)},${lon.toFixed(4)}`;
  return cached(key, 2592000000, async () => {
    rate('pvgis', 1000);
    const url = `https://re.jrc.ec.europa.eu/api/v5_3/PVcalc?lat=${lat.toFixed(6)}&lon=${lon.toFixed(6)}&peakpower=1&loss=14&optimalangles=1&outputformat=json`;
    const data = (await (await fetchBounded(url)).json()) as {
      outputs?: { totals?: { fixed?: { E_y?: number } } };
      inputs?: {
        mounting_system?: { fixed?: { slope?: { value?: number } } };
        meteo_data?: { radiation_db?: string; year_min?: number; year_max?: number };
      };
    };
    const annualKwh = data.outputs?.totals?.fixed?.E_y,
      tiltDeg = data.inputs?.mounting_system?.fixed?.slope?.value;
    if (!Number.isFinite(annualKwh) || !Number.isFinite(tiltDeg))
      throw new ProviderError('PVGIS has no usable result for this location.');
    return {
      annualKwh: annualKwh!,
      tiltDeg: tiltDeg!,
      sourceUrl: url,
      acquiredAt: new Date().toISOString(),
      version: 'PVGIS 5.3',
      ...(typeof data.inputs?.meteo_data?.radiation_db === 'string'
        ? { radiationDatabase: data.inputs.meteo_data.radiation_db }
        : {}),
      ...(Number.isInteger(data.inputs?.meteo_data?.year_min)
        ? { periodStartYear: data.inputs!.meteo_data!.year_min }
        : {}),
      ...(Number.isInteger(data.inputs?.meteo_data?.year_max)
        ? { periodEndYear: data.inputs!.meteo_data!.year_max }
        : {}),
    };
  });
}
const pointSegment = (p: XY, a: XY, b: XY) => {
  const dx = b.x - a.x,
    dy = b.y - a.y,
    t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1)));
  return distance(p, { x: a.x + t * dx, y: a.y + t * dy });
};
export function nearBoundary(line: XY[], boundary: XY[], radius = 100) {
  if (line.some((p) => inside(p, boundary))) return true;
  for (let i = 0; i < boundary.length; i++) {
    const a = boundary[i],
      b = boundary[(i + 1) % boundary.length];
    if (line.some((p) => pointSegment(p, a, b) <= radius)) return true;
    for (let j = 1; j < line.length; j++)
      if (
        intersects(a, b, line[j - 1], line[j]) ||
        pointSegment(a, line[j - 1], line[j]) <= radius ||
        pointSegment(b, line[j - 1], line[j]) <= radius
      )
        return true;
  }
  return line.length >= 4 && inside(boundary[0], line);
}
export async function context(points: LonLat[]) {
  const extentError = geographicBoundaryError(points);
  if (extentError) throw new ProviderError(extentError, 400);
  const key = `context:${JSON.stringify(points)}`;
  return cached(key, 86400000, async () => {
    rate('overpass', 10000);
    const xs = points.map((p) => p[0]),
      ys = points.map((p) => p[1]),
      padLat = 101 / 110574,
      padLon = 101 / (111320 * Math.cos((points[0][1] * Math.PI) / 180));
    const bbox = [
      Math.min(...ys) - padLat,
      Math.min(...xs) - padLon,
      Math.max(...ys) + padLat,
      Math.max(...xs) + padLon,
    ]
      .map((v) => v.toFixed(7))
      .join(',');
    const query = `[out:json][timeout:8];(way[highway](${bbox});way[building](${bbox});way[waterway](${bbox});way[power](${bbox});node[power](${bbox});way[landuse](${bbox}););out tags geom;`;
    const data = (await (
      await fetchBounded('https://overpass-api.de/api/interpreter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `data=${encodeURIComponent(query)}`,
      })
    ).json()) as {
      remark?: string;
      elements?: {
        type: string;
        id: number;
        lat?: number;
        lon?: number;
        geometry?: { lat: number; lon: number }[];
        tags?: Record<string, string>;
      }[];
    };
    if (data.remark || !Array.isArray(data.elements))
      throw new ProviderError('OpenStreetMap query was incomplete; counts are withheld.');
    const boundary = points.map((p) => toLocal(p, points[0])),
      seen = new Set<string>(),
      counts = {
        roads: 0,
        buildings: 0,
        waterways: 0,
        power: 0,
        landuse: [] as string[],
        sourceUrl: 'https://www.openstreetmap.org/copyright',
        acquiredAt: new Date().toISOString(),
      };
    for (const e of data.elements) {
      const id = `${e.type}:${e.id}`;
      if (seen.has(id)) continue;
      seen.add(id);
      const geometry =
        e.geometry ??
        (e.lon !== undefined && e.lat !== undefined ? [{ lon: e.lon, lat: e.lat }] : []);
      if (
        !geometry.length ||
        !nearBoundary(
          geometry.map((p) => toLocal([p.lon, p.lat], points[0])),
          boundary,
        )
      )
        continue;
      if (e.tags?.highway) counts.roads++;
      if (e.tags?.building) counts.buildings++;
      if (e.tags?.waterway) counts.waterways++;
      if (e.tags?.power) counts.power++;
      if (e.tags?.landuse && !counts.landuse.includes(e.tags.landuse))
        counts.landuse.push(e.tags.landuse);
    }
    return counts;
  });
}
/** Every source in a composite tile must be allowed. Missing headers fail closed. */
export function permittedTerrainSources(header: string | null) {
  return (
    !!header && header.split(',').every((s) => /^(srtm|gmted|uk_lidar)\/[^\s]+$/i.test(s.trim()))
  );
}
export async function terrain(points: LonLat[]) {
  return cached(`terrain:${JSON.stringify(points)}`, 2592000000, async () => {
    rate('terrain', 1000);
    const started = Date.now();
    const z = 12,
      n = 2 ** z,
      tileCache = new Map<string, { data: Uint8Array; width: number; channels: number }>(),
      headers = new Set<string>();
    const heightsM: number[] = [];
    for (const [lon, lat] of points) {
      const fx = ((lon + 180) / 360) * n,
        fy = ((1 - Math.asinh(Math.tan((lat * Math.PI) / 180)) / Math.PI) / 2) * n,
        x = Math.floor(fx),
        y = Math.floor(fy),
        key = `${x}/${y}`;
      let tile = tileCache.get(key);
      if (!tile) {
        if (tileCache.size >= 4)
          throw new ProviderError('Terrain requires too many tiles for this bounded request.');
        const response = await fetchBounded(
          `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${z}/${x}/${y}.png`,
          {},
          Math.max(1, 10000 - (Date.now() - started)),
        );
        const sources =
          response.headers.get('x-imagery-sources') ??
          response.headers.get('x-amz-meta-x-imagery-sources');
        if (!permittedTerrainSources(sources))
          throw new ProviderError(
            'Public terrain unavailable: exact tile sources are missing or include a source outside the permitted USGS / UK OGL licence set. Copernicus composites are excluded; no terrain numbers are inferred.',
          );
        headers.add(sources!);
        const sharp = (await import('sharp')).default,
          { data, info } = await sharp(Buffer.from(await response.arrayBuffer()), {
            limitInputPixels: 262144,
          })
            .removeAlpha()
            .raw()
            .toBuffer({ resolveWithObject: true });
        if (info.width !== 256 || info.height !== 256 || info.channels < 3)
          throw new ProviderError('Unexpected terrain tile dimensions.');
        tile = { data, width: info.width, channels: info.channels };
        tileCache.set(key, tile);
      }
      const px = Math.min(255, Math.floor((fx - x) * 256)),
        py = Math.min(255, Math.floor((fy - y) * 256)),
        i = (py * tile.width + px) * tile.channels;
      const h = tile.data[i] * 256 + tile.data[i + 1] + tile.data[i + 2] / 256 - 32768;
      if (h <= -1000 || h >= 9000)
        throw new ProviderError(
          'Terrain sample is no-data or outside supported land-height range.',
        );
      heightsM.push(h);
    }
    const coarse = [...headers].some((h) => h.includes('gmted/')),
      uk = [...headers].some((h) => h.includes('uk_lidar/'));
    return {
      heightsM,
      acquiredAt: new Date().toISOString(),
      resolutionM: Math.max(
        coarse ? 250 : 30,
        (156543.03392 * Math.cos((points[0][1] * Math.PI) / 180)) / 4096,
      ),
      sourceUrl: 'https://github.com/tilezen/joerd/blob/master/docs/data-sources.md',
      verticalReference:
        'Public composite orthometric heights; exact benchmark/datum transformation required for survey use',
      sources: [...headers],
      resolutionNote: coarse
        ? 'This tile also contains GMTED2010 fallback, 250 m or coarser; exact contributing source at an individual pixel is not identified.'
        : 'Sampled on a roughly 30 m grid; display precision is not survey accuracy.',
      attribution: `Global GMTED2010 and SRTM terrain data courtesy of the U.S. Geological Survey.${uk ? ' © Environment Agency copyright and/or database right 2015. All rights reserved. Contains public sector information licensed under the Open Government Licence v3.0. AWS archive data, not the current Environment Agency release.' : ''}`,
    };
  });
}
export function clearProviderCacheForTests() {
  cache.clear();
  pending.clear();
  lastCall.clear();
}
