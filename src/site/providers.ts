import type { GeoSite, PublicSnapshot } from './types';
import { isOfflineDemo } from './previewMode';
const cache = new Map<string, { expires: number; value: unknown }>();
export function demoSiteMode() {
  return isOfflineDemo();
}
export async function siteRequest<T>(path: string, signal?: AbortSignal): Promise<T> {
  if (demoSiteMode()) throw new Error('The demo is a local sample. Live providers are disabled.');
  const cached = cache.get(path);
  if (cached && cached.expires > Date.now()) return cached.value as T;
  const controller = new AbortController(),
    cancel = () => controller.abort();
  signal?.addEventListener('abort', cancel, { once: true });
  if (signal?.aborted) controller.abort();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(`/api/site/${path}`, {
      signal: controller.signal,
      credentials: 'omit',
      headers: { Accept: 'application/json' },
    });
    if (!response.headers.get('content-type')?.includes('application/json'))
      throw new Error('Provider API is unavailable on this host. Your boundary remains usable.');
    const body = (await response.json()) as T & { error?: string };
    if (!response.ok) throw new Error(body.error ?? `Provider returned ${response.status}.`);
    if (cache.size > 64) cache.delete(cache.keys().next().value!);
    cache.set(path, { expires: Date.now() + 3600000, value: body });
    return body;
  } catch (e) {
    if (controller.signal.aborted)
      throw new Error('Provider request cancelled or timed out. Saved data is retained.');
    throw e;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', cancel);
  }
}
export async function loadPublicData(site: GeoSite, signal?: AbortSignal): Promise<PublicSnapshot> {
  if (demoSiteMode() || site.sample)
    throw new Error('Offline sample: no public requests are made.');
  const query = `points=${encodeURIComponent(JSON.stringify(site.boundary))}`,
    out: PublicSnapshot = { ...site.publicData, fetchedAt: new Date().toISOString(), errors: [] };
  const results = await Promise.allSettled([
    siteRequest<NonNullable<PublicSnapshot['solar']>>(`solar?${query}`, signal),
    siteRequest<NonNullable<PublicSnapshot['context']>>(`context?${query}`, signal),
    siteRequest<NonNullable<PublicSnapshot['terrain']>>(`terrain?${query}`, signal),
  ]);
  const keys = ['solar', 'context', 'terrain'] as const;
  results.forEach((r, i) => {
    if (r.status === 'fulfilled') Object.assign(out, { [keys[i]]: r.value });
    else
      out.errors!.push(
        `${keys[i]}: ${r.reason instanceof Error ? r.reason.message : 'unavailable'}${site.publicData?.[keys[i]] ? ' Previous saved result retained with its original acquisition time.' : ''}`,
      );
  });
  return out;
}
